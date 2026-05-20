"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function addDamageReportAction(formData: FormData) {
  await requireRole(["admin", "internal_team"]);

  const caseId = String(formData.get("case_id"));
  const customerEmail = String(formData.get("customer_email")).trim();
  const title = String(formData.get("title")).trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const severity = String(formData.get("severity") || "minor");
  const visibleToClient = formData.get("visible_to_client") !== "off";

  if (!caseId || !customerEmail || !title) throw new Error("Missing required fields");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("vehicle_damage_reports").insert({
    case_id: caseId,
    customer_email: customerEmail,
    title,
    description,
    severity,
    visible_to_client: visibleToClient,
    reported_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: user?.id ?? null,
    entity: "case",
    entity_id: caseId,
    action: "damage_reported",
    data: { title, severity, visible_to_client: visibleToClient },
  });

  revalidatePath(`/internal/cases/${caseId}`);
  revalidatePath("/client/vehicle");
}

export async function uploadCaseMediaAction(formData: FormData) {
  await requireRole(["admin", "internal_team"]);

  const caseId = String(formData.get("case_id"));
  const customerEmail = String(formData.get("customer_email")).trim();
  const caption = (formData.get("caption") as string)?.trim() || null;
  const visibleToClient = formData.get("visible_to_client") !== "off";
  const file = formData.get("file");

  if (!caseId || !customerEmail || !(file instanceof File) || file.size === 0) {
    throw new Error("Photo file required");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `${caseId}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from("vehicle-media")
    .upload(storagePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadErr) throw new Error(uploadErr.message);

  const { error } = await supabase.from("vehicle_media").insert({
    case_id: caseId,
    customer_email: customerEmail,
    storage_path: storagePath,
    file_name: file.name,
    caption,
    media_type: file.type.startsWith("image/") ? "photo" : "document",
    visible_to_client: visibleToClient,
    uploaded_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: user?.id ?? null,
    entity: "case",
    entity_id: caseId,
    action: "media_uploaded",
    data: { file_name: file.name, visible_to_client: visibleToClient },
  });

  revalidatePath(`/internal/cases/${caseId}`);
  revalidatePath("/client/vehicle");
}
