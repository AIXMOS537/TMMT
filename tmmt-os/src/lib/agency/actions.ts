"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { suggestDefaultTier, tierAllowedForSegment } from "@/lib/revenue-split/resolve";
import {
  PARTNER_CLIENT_SEGMENTS,
  PARTNER_REVENUE_SPLIT_TIERS,
  type PartnerClientSegment,
  type PartnerRevenueSplitTier,
} from "@/lib/revenue-split/types";

type Result = { success: true } | { success: false; error: string };

export async function suspendClientOrganization(orgId: string): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      suspended_at: new Date().toISOString(),
      billing_status: "canceled",
    })
    .eq("id", orgId)
    .not("parent_agency_id", "is", null);

  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/agency");
  return { success: true };
}

export async function unsuspendClientOrganization(orgId: string): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      suspended_at: null,
      billing_status: "trialing",
    })
    .eq("id", orgId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/agency");
  return { success: true };
}

export async function provisionClientOrganization(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const name = formData.get("name")?.toString()?.trim();
  const vertical = formData.get("vertical")?.toString() ?? "dealer";
  const parentAgencyId = formData.get("parent_agency_id")?.toString()?.trim();

  if (!name) return { success: false, error: "Organization name is required." };
  if (vertical !== "dealer" && vertical !== "rental") {
    return { success: false, error: "Vertical must be dealer or rental." };
  }

  const segmentRaw = formData.get("partner_client_segment")?.toString() ?? "retail";
  const segment = (PARTNER_CLIENT_SEGMENTS as readonly string[]).includes(segmentRaw)
    ? (segmentRaw as PartnerClientSegment)
    : "retail";
  const hasOwnSystem = formData.get("partner_has_own_system") === "on";
  const vehicleCount = Math.max(
    0,
    Math.round(Number(formData.get("partner_qualified_vehicle_count") ?? 0))
  );
  const tierRaw = formData.get("partner_revenue_split_tier")?.toString()?.trim();
  let tier: PartnerRevenueSplitTier | null =
    tierRaw && (PARTNER_REVENUE_SPLIT_TIERS as readonly string[]).includes(tierRaw)
      ? (tierRaw as PartnerRevenueSplitTier)
      : null;
  if (!tier) {
    tier = suggestDefaultTier(segment, { hasOwnSystem });
  }
  if (!tier) {
    return {
      success: false,
      error: "Retail splits require the partner to have their own system.",
    };
  }
  if (!tierAllowedForSegment(segment, tier, { hasOwnSystem })) {
    return { success: false, error: "That split tier is not allowed for this partner type." };
  }

  const supabase = createSupabaseServerClient();
  const insertPayload: Record<string, unknown> = {
    name,
    vertical,
    parent_agency_id: parentAgencyId || null,
    plan_tier: "starter",
    billing_status: "trialing",
    onboarding_step: "not_started",
    partner_client_segment: segment,
    partner_has_own_system: segment === "retail" ? hasOwnSystem : false,
    partner_qualified_vehicle_count: vehicleCount,
    partner_split_auto_track: true,
  };
  if (tier) insertPayload.partner_revenue_split_tier = tier;

  const { error } = await supabase.from("organizations").insert(insertPayload);

  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/agency");
  return { success: true };
}
