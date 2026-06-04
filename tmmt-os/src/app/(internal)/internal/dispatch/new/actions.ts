"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStaffDispatchJob } from "@/lib/job-dispatch/create-dispatch-job";
import { DISPATCH_WORK_TYPES } from "@/lib/job-dispatch/types";

const DispatchSchema = z.object({
  vendor_company: z.string().min(1).max(200),
  vendor_contact_name: z.string().max(120).optional().or(z.literal("")),
  vendor_contact_email: z.string().email().optional().or(z.literal("")),
  vendor_contact_phone: z.string().max(40).optional().or(z.literal("")),
  assign_vendor_id: z.string().uuid().optional().or(z.literal("")),
  work_type: z.enum(DISPATCH_WORK_TYPES),
  subject: z.string().min(1).max(200),
  details: z.string().max(5000).optional().or(z.literal("")),
  pickup: z.string().max(500).optional().or(z.literal("")),
  dropoff: z.string().max(500).optional().or(z.literal("")),
  window_start: z.string().optional().or(z.literal("")),
  window_end: z.string().optional().or(z.literal("")),
  offered_price: z.coerce.number().optional(),
  due_at: z.string().optional().or(z.literal("")),
});

export async function submitDispatchJobAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal_team"].includes(profile.role as string)) {
    redirect("/internal/dispatch/new?error=" + encodeURIComponent("Staff access required."));
  }

  const parsed = DispatchSchema.safeParse({
    vendor_company: formData.get("vendor_company"),
    vendor_contact_name: formData.get("vendor_contact_name") || undefined,
    vendor_contact_email: formData.get("vendor_contact_email") || undefined,
    vendor_contact_phone: formData.get("vendor_contact_phone") || undefined,
    assign_vendor_id: formData.get("assign_vendor_id") || undefined,
    work_type: formData.get("work_type"),
    subject: formData.get("subject"),
    details: formData.get("details") || undefined,
    pickup: formData.get("pickup") || undefined,
    dropoff: formData.get("dropoff") || undefined,
    window_start: formData.get("window_start") || undefined,
    window_end: formData.get("window_end") || undefined,
    offered_price: formData.get("offered_price") || undefined,
    due_at: formData.get("due_at") || undefined,
  });

  if (!parsed.success) {
    redirect(
      "/internal/dispatch/new?error=" + encodeURIComponent(parsed.error.issues[0].message)
    );
  }

  const data = parsed.data;

  try {
    const result = await createStaffDispatchJob({
      vendor_company: data.vendor_company,
      vendor_contact_name: data.vendor_contact_name || undefined,
      vendor_contact_email: data.vendor_contact_email || undefined,
      vendor_contact_phone: data.vendor_contact_phone || undefined,
      assign_vendor_id: data.assign_vendor_id || undefined,
      work_type: data.work_type,
      subject: data.subject,
      details: data.details || undefined,
      pickup: data.pickup || undefined,
      dropoff: data.dropoff || undefined,
      window_start: data.window_start || undefined,
      window_end: data.window_end || undefined,
      offered_price: data.offered_price,
      due_at: data.due_at || undefined,
      actor_id: user.id,
    });

    redirect(
      `/internal/cases/${result.caseId}?dispatched=1&ref=${encodeURIComponent(result.refCode)}`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "dispatch failed";
    redirect("/internal/dispatch/new?error=" + encodeURIComponent(message));
  }
}
