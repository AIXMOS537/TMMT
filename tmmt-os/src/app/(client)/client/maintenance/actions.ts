"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireEntitlement } from "@/lib/auth-portals";

export async function createMaintenanceRequest(formData: FormData) {
  await requireEntitlement("maintenance_requests", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) throw new Error("Profile email required");

  const subject = String(formData.get("subject") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const urgency = String(formData.get("urgency") ?? "normal");
  const vehicle = String(formData.get("vehicle") ?? "").trim();

  if (!subject) throw new Error("Subject is required");

  const supabase = createSupabaseServerClient();
  const description = [
    details,
    vehicle ? `Vehicle: ${vehicle}` : null,
    `Urgency: ${urgency}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: c, error } = await supabase
    .from("cases")
    .insert({
      customer_name: me.full_name || me.email,
      customer_email: me.email,
      request_type: "maintenance",
      subject,
      description: description || null,
      status: "intake_submitted",
      priority: urgency === "urgent" ? "high" : urgency === "soon" ? "normal" : "low",
      metadata: {
        source: "client_portal",
        maintenance: true,
        urgency,
        vehicle_hint: vehicle || null,
        profile_id: me.id,
      },
    })
    .select("id, ref_code")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: me.id,
    entity: "case",
    entity_id: c.id,
    action: "client_maintenance_requested",
    data: { ref_code: c.ref_code, urgency },
  });

  revalidatePath("/client/maintenance");
  revalidatePath("/client/rental");
  revalidatePath("/client/support");
}
