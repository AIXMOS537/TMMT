"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isClickUpEnabled } from "@/lib/clickup/client";
import {
  notifyClickUpVendorAssignment,
  syncCaseToClickUp,
} from "@/lib/clickup/sync-case";
import { isStaffUser, isVendorUser } from "@/lib/auth-roles";
import {
  assertVendorUploadFile,
  vendorJobObjectKey,
  VENDOR_FILES_BUCKET,
} from "@/lib/vendor-storage";
import { CASE_STATUSES, VENDOR_JOB_STATUSES } from "@/lib/workflow";
import { linkFormToPerson } from "@/lib/people/upsert";

type ActionResult = { success: true; id?: string } | { success: false; error: string };

// ─── Public customer intake ───────────────────────────────────────

const intakeSchema = z.object({
  contact_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
  email: z.string().email().max(254).optional().or(z.literal("")),
  request_type: z.string().min(1).max(100),
  description: z.string().max(4000).optional(),
  priority: z.enum(["Urgent", "Moderate", "Standard", ""]).optional(),
});

export async function submitCustomerIntake(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Please check your entries and try again." };
  }

  const d = parsed.data;
  const supabase = await createSSRClient();
  const { data, error } = await supabase.rpc("submit_customer_intake", {
    p_contact_name: d.contact_name.trim(),
    p_phone: d.phone || null,
    p_email: d.email || null,
    p_request_type: d.request_type,
    p_description: d.description || null,
    p_priority: d.priority || null,
  });

  if (error) {
    console.error("[submit_customer_intake]", error.message);
    return { success: false, error: "Submission failed. Please try again." };
  }

  const caseId = data as string;
  void linkFormToPerson({
    fullName: d.contact_name.trim(),
    email: d.email || null,
    phone: d.phone || null,
    formSlug: "customer-intake",
    destinationTable: "cases",
    destinationId: caseId || null,
    payload: { request_type: d.request_type, priority: d.priority },
  }).catch((err) => console.warn("[people] link failed:", err));
  if (isClickUpEnabled() && caseId) {
    try {
      const service = createServiceRoleClient();
      await syncCaseToClickUp(service, caseId);
    } catch (e) {
      console.error("[clickup intake sync]", e instanceof Error ? e.message : e);
    }
  }

  return { success: true, id: caseId };
}

// ─── Staff: case + vendor job management ──────────────────────────

const caseUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CASE_STATUSES),
  internal_notes: z.string().max(8000).optional(),
  clickup_task_id: z.string().max(200).optional(),
  clickup_url: z.string().url().max(500).optional().or(z.literal("")),
});

export async function staffUpdateCase(formData: FormData): Promise<ActionResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaffUser(user)) redirect("/login");

  const parsed = caseUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "Invalid case data." };

  const d = parsed.data;
  const { data: existing, error: fetchErr } = await supabase
    .from("cases")
    .select("metadata")
    .eq("id", d.id)
    .single();
  if (fetchErr) {
    console.error("[staffUpdateCase fetch]", fetchErr.message);
    return { success: false, error: "Failed to update case." };
  }

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    internal_notes: d.internal_notes ?? null,
  };

  const { error } = await supabase
    .from("cases")
    .update({
      status: d.status,
      clickup_task_id: d.clickup_task_id || null,
      clickup_task_url: d.clickup_url || null,
      metadata,
    })
    .eq("id", d.id);

  if (error) {
    console.error("[staffUpdateCase]", error.message);
    return { success: false, error: "Failed to update case." };
  }
  return { success: true };
}

export async function staffSyncCaseToClickUp(formData: FormData): Promise<
  ActionResult & { clickupUrl?: string }
> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaffUser(user)) redirect("/login");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { success: false, error: "Missing case id." };
  }
  if (!isClickUpEnabled()) {
    return { success: false, error: "CLICKUP_API_TOKEN not configured in Vercel." };
  }

  try {
    const service = createServiceRoleClient();
    const result = await syncCaseToClickUp(service, id, { force: true });
    return { success: true, clickupUrl: result.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : "ClickUp sync failed.";
    return { success: false, error: message };
  }
}

const assignVendorJobSchema = z.object({
  case_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
});

export async function staffAssignVendorJob(formData: FormData): Promise<ActionResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaffUser(user)) redirect("/login");

  const parsed = assignVendorJobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "Invalid assignment." };

  const d = parsed.data;
  const { data: job, error: jobErr } = await supabase
    .from("vendor_jobs")
    .insert({
      case_id: d.case_id,
      vendor_id: d.vendor_id,
      title: d.title,
      description: d.description || null,
      status: "offered",
    })
    .select("id")
    .single();

  if (jobErr) {
    console.error("[staffAssignVendorJob]", jobErr.message);
    return { success: false, error: "Failed to assign vendor job." };
  }

  const { data: vendorRow } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", d.vendor_id)
    .single();

  const { data: caseRow } = await supabase
    .from("cases")
    .select("clickup_task_id")
    .eq("id", d.case_id)
    .single();

  if (isClickUpEnabled()) {
    try {
      const service = createServiceRoleClient();
      let taskId = caseRow?.clickup_task_id as string | null;
      if (!taskId) {
        const synced = await syncCaseToClickUp(service, d.case_id);
        taskId = synced.taskId;
      }
      if (taskId) {
        await notifyClickUpVendorAssignment({
          clickupTaskId: taskId,
          vendorName: String(vendorRow?.name ?? "Vendor"),
          jobTitle: d.title,
          description: d.description,
        });
      }
    } catch (e) {
      console.error("[clickup vendor assign]", e instanceof Error ? e.message : e);
    }
  }

  await supabase.from("cases").update({ status: "vendor_assigned" }).eq("id", d.case_id);

  await supabase.from("vendor_job_updates").insert({
    vendor_job_id: job.id,
    status: "offered",
    note: "Job offered to vendor",
    created_by: user.id,
  });

  return { success: true, id: job.id };
}

// ─── Vendor: accept / decline / status ────────────────────────────

const vendorStatusSchema = z.object({
  vendor_job_id: z.string().uuid(),
  status: z.enum(VENDOR_JOB_STATUSES),
  note: z.string().max(2000).optional(),
});

export async function vendorUpdateJobStatus(formData: FormData): Promise<ActionResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isVendorUser(user)) redirect("/login");

  const parsed = vendorStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "Invalid status update." };

  const d = parsed.data;
  const patch: Record<string, unknown> = {
    status: d.status,
    updated_at: new Date().toISOString(),
  };
  if (d.status === "accepted") patch.accepted_at = new Date().toISOString();
  if (d.status === "scheduled") patch.scheduled_at = new Date().toISOString();
  if (d.status === "completed" || d.status === "pending_review") {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("vendor_jobs")
    .update(patch)
    .eq("id", d.vendor_job_id);

  if (error) {
    console.error("[vendorUpdateJobStatus]", error.message);
    return { success: false, error: "Failed to update job." };
  }

  await supabase.from("vendor_job_updates").insert({
    vendor_job_id: d.vendor_job_id,
    status: d.status,
    note: d.note || null,
    created_by: user.id,
  });

  if (d.status === "completed" || d.status === "pending_review") {
    const { data: job } = await supabase
      .from("vendor_jobs")
      .select("case_id")
      .eq("id", d.vendor_job_id)
      .single();
    if (job?.case_id) {
      await supabase
        .from("cases")
        .update({ status: "vendor_completed" })
        .eq("id", job.case_id);
    }
  }

  return { success: true };
}

export async function vendorUploadJobFile(formData: FormData): Promise<ActionResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isVendorUser(user)) redirect("/login");

  const jobId = formData.get("vendor_job_id");
  const file = formData.get("file");
  if (typeof jobId !== "string" || !(file instanceof File)) {
    return { success: false, error: "Missing file or job." };
  }

  const check = assertVendorUploadFile(file);
  if (!check.ok) return { success: false, error: check.error };

  const storagePath = vendorJobObjectKey(jobId, file.name, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const service = createServiceRoleClient();

  const { error: uploadErr } = await service.storage
    .from(VENDOR_FILES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("[vendorUploadJobFile]", uploadErr.message);
    return { success: false, error: "Upload failed." };
  }

  const { error: rowErr } = await supabase.from("vendor_files").insert({
    vendor_job_id: jobId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    uploaded_by: user.id,
  });

  if (rowErr) {
    console.error("[vendor_files insert]", rowErr.message);
    return { success: false, error: "File saved to storage but record failed." };
  }

  return { success: true };
}
