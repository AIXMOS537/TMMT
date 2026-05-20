"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import { notifyClientPortalUpdate } from "@/lib/ghl/portal-notify";

export async function requestInvestorUpdate(formData: FormData) {
  await requireRole(["investor", "admin"]);
  const me = await getCurrentUser();
  if (!me?.email) throw new Error("Profile email required");

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
      request_type: "investor_inquiry",
      subject,
      description: details || null,
      status: "intake_submitted",
      metadata: { source: "investor_portal", profile_id: me.id },
    })
    .select("id, ref_code")
    .single();

  if (error) throw new Error(error.message);

  void notifyClientPortalUpdate({
    caseId: c.id,
    refCode: c.ref_code,
    customerEmail: me.email,
    title: "Investor update request",
    body: subject,
    kind: "team_message",
  });

  revalidatePath("/investor/contact");
}
