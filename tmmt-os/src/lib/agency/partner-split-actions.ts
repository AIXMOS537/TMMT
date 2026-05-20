"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  suggestDefaultTier,
  tierAllowedForSegment,
} from "@/lib/revenue-split/resolve";
import {
  PARTNER_CLIENT_SEGMENTS,
  PARTNER_REVENUE_SPLIT_TIERS,
  type PartnerClientSegment,
  type PartnerRevenueSplitTier,
} from "@/lib/revenue-split/types";

type Result = { success: true } | { success: false; error: string };

function parseSegment(raw: string | null): PartnerClientSegment | null {
  if (!raw) return null;
  return (PARTNER_CLIENT_SEGMENTS as readonly string[]).includes(raw)
    ? (raw as PartnerClientSegment)
    : null;
}

function parseTier(raw: string | null): PartnerRevenueSplitTier | null {
  if (!raw) return null;
  return (PARTNER_REVENUE_SPLIT_TIERS as readonly string[]).includes(raw)
    ? (raw as PartnerRevenueSplitTier)
    : null;
}

export async function updateOrganizationPartnerSplit(
  orgId: string,
  formData: FormData
): Promise<Result> {
  await requireRole(["admin", "internal_team"]);

  const segment = parseSegment(formData.get("partner_client_segment")?.toString() ?? null);
  const tier = parseTier(formData.get("partner_revenue_split_tier")?.toString() ?? null);
  const hasOwnSystem = formData.get("partner_has_own_system") === "on";
  const vehicleCount = Math.max(
    0,
    Math.round(Number(formData.get("partner_qualified_vehicle_count") ?? 0))
  );

  if (!segment) {
    return {
      success: false,
      error: "Select relationship/retail or passive/managed partner type.",
    };
  }

  const resolvedTier =
    tier ??
    suggestDefaultTier(segment, {
      hasOwnSystem,
    });

  if (!resolvedTier) {
    return {
      success: false,
      error: "Retail splits require the partner to have their own system.",
    };
  }

  if (
    !tierAllowedForSegment(segment, resolvedTier, {
      hasOwnSystem,
    })
  ) {
    return { success: false, error: "That split tier is not allowed for this partner type." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      partner_client_segment: segment,
      partner_revenue_split_tier: resolvedTier,
      partner_has_own_system: segment === "retail" ? hasOwnSystem : false,
      partner_qualified_vehicle_count: vehicleCount,
    })
    .eq("id", orgId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/agency");
  return { success: true };
}
