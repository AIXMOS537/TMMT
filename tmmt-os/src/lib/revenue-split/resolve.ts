import {
  BUSINESS_SPLIT_TIERS,
  PASSIVE_DEFAULT_TIER,
  PARTNER_PCT_BY_TIER,
  PARTNER_SEGMENT_LABELS,
  RETAIL_DEFAULT_TIER,
  RETAIL_SPLIT_TIERS,
  type PartnerClientSegment,
  type PartnerRevenueSplitTier,
  type PartnerSplitConfig,
  type ResolvedPartnerSplit,
} from "./types";

export function agencyPctFromTier(tier: PartnerRevenueSplitTier): number {
  return 100 - PARTNER_PCT_BY_TIER[tier];
}

export function formatSplitLabel(tier: PartnerRevenueSplitTier): string {
  const p = PARTNER_PCT_BY_TIER[tier];
  return `${p}/${100 - p}`;
}

export function formatPartnerSegmentLabel(segment: PartnerClientSegment): string {
  return PARTNER_SEGMENT_LABELS[segment];
}

export function tiersForSegment(segment: PartnerClientSegment): readonly PartnerRevenueSplitTier[] {
  return segment === "retail" ? RETAIL_SPLIT_TIERS : BUSINESS_SPLIT_TIERS;
}

export function retailPartnerEligible(hasOwnSystem: boolean): boolean {
  return hasOwnSystem;
}

export function passivePartnerEligible(): boolean {
  return true;
}

export function tierAllowedForSegment(
  segment: PartnerClientSegment,
  tier: PartnerRevenueSplitTier,
  config: Pick<PartnerSplitConfig, "hasOwnSystem">
): boolean {
  if (segment === "retail") {
    return (
      (RETAIL_SPLIT_TIERS as readonly string[]).includes(tier) &&
      retailPartnerEligible(config.hasOwnSystem)
    );
  }
  return (BUSINESS_SPLIT_TIERS as readonly string[]).includes(tier);
}

/** Default tier when staff has not picked one yet. */
export function suggestDefaultTier(
  segment: PartnerClientSegment,
  config: Pick<PartnerSplitConfig, "hasOwnSystem">
): PartnerRevenueSplitTier | null {
  if (segment === "retail") {
    return retailPartnerEligible(config.hasOwnSystem) ? RETAIL_DEFAULT_TIER : null;
  }
  return PASSIVE_DEFAULT_TIER;
}

export function resolvePartnerSplit(
  config: PartnerSplitConfig,
  source: ResolvedPartnerSplit["source"] = "organization"
): ResolvedPartnerSplit | null {
  if (!config.segment) return null;

  let tier = config.tier;
  if (!tier || !tierAllowedForSegment(config.segment, tier, config)) {
    tier = suggestDefaultTier(config.segment, config);
  }
  if (!tier) return null;

  const partnerPct = PARTNER_PCT_BY_TIER[tier];
  return {
    segment: config.segment,
    tier,
    partnerPct,
    agencyPct: agencyPctFromTier(tier),
    eligible: true,
    source,
  };
}
