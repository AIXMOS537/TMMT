import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PartnerSplitConfig } from "./types";

export async function fetchPartnerSplitConfigForEmail(
  email: string
): Promise<{ config: PartnerSplitConfig; organizationId: string | null }> {
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select(
        "partner_client_segment, partner_revenue_split_tier, partner_has_own_system, partner_qualified_vehicle_count"
      )
      .eq("id", profile.organization_id)
      .maybeSingle();

    if (org) {
      return {
        organizationId: profile.organization_id,
        config: {
          segment: org.partner_client_segment,
          tier: org.partner_revenue_split_tier,
          hasOwnSystem: Boolean(org.partner_has_own_system),
          qualifiedVehicleCount: Number(org.partner_qualified_vehicle_count) || 0,
        },
      };
    }
  }

  const { data: journey } = await supabase
    .from("client_journey")
    .select(
      "partner_client_segment, partner_revenue_split_tier, partner_has_own_system, partner_qualified_vehicle_count"
    )
    .ilike("customer_email", normalized)
    .maybeSingle();

  return {
    organizationId: profile?.organization_id ?? null,
    config: {
      segment: journey?.partner_client_segment ?? null,
      tier: journey?.partner_revenue_split_tier ?? null,
      hasOwnSystem: Boolean(journey?.partner_has_own_system),
      qualifiedVehicleCount: Number(journey?.partner_qualified_vehicle_count) || 0,
    },
  };
}
