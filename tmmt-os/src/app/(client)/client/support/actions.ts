"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireEntitlement } from "@/lib/auth-portals";

export async function createSupportCase(formData: FormData) {
  const access = await requireEntitlement("support_tickets", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) throw new Error("Profile email required for support tickets");

  const subject = String(formData.get("subject") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!subject) throw new Error("Subject is required");

  const supabase = createSupabaseServerClient();
  const { data: c, error } = await supabase
    .from("cases")
    .insert({
      customer_name: me.full_name || me.email,
      customer_email: me.email,
      customer_phone: null,
      request_type: "rental_support",
      subject,
      description: details || null,
      status: "intake_submitted",
      metadata: { source: "client_portal", profile_id: access.profile.id },
    })
    .select("id, ref_code")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: me.id,
    entity: "case",
    entity_id: c.id,
    action: "client_support_opened",
    data: { ref_code: c.ref_code },
  });

  revalidatePath("/client/support");
}
