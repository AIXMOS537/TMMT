"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notifyClientPortalUpdate } from "@/lib/ghl/portal-notify";

export async function postClientUpdateAction(formData: FormData) {
  await requireRole(["admin", "internal_team"]);

  const caseId = String(formData.get("case_id"));
  const customerEmail = String(formData.get("customer_email")).trim();
  const refCode = String(formData.get("ref_code") ?? "").trim();
  const message = String(formData.get("message")).trim();

  if (!caseId || !customerEmail || !message) throw new Error("Message required");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("case_client_updates").insert({
    case_id: caseId,
    customer_email: customerEmail,
    message,
    posted_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);

  const service = createSupabaseServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", customerEmail)
    .maybeSingle();

  if (profile?.id) {
    await service.from("notifications").insert({
      recipient: profile.id,
      case_id: caseId,
      kind: "team_message",
      title: "Update from TMMT",
      body: message,
    });
  }

  void notifyClientPortalUpdate({
    caseId,
    refCode: refCode || caseId.slice(0, 8),
    customerEmail,
    title: "Update from TMMT",
    body: message,
    kind: "team_message",
  });

  await supabase.from("activity_logs").insert({
    actor_id: user?.id ?? null,
    entity: "case",
    entity_id: caseId,
    action: "client_update_posted",
    data: { preview: message.slice(0, 120) },
  });

  revalidatePath(`/internal/cases/${caseId}`);
  revalidatePath("/client/updates");
  revalidatePath(`/client/support/${caseId}`);
}
