/** Partner (investor/operator) vs TMMT agency — partner share listed first (e.g. 60/40). */

export const PARTNER_CLIENT_SEGMENTS = ["retail", "business_owner"] as const;
export type PartnerClientSegment = (typeof PARTNER_CLIENT_SEGMENTS)[number];

export const PARTNER_SEGMENT_LABELS: Record<PartnerClientSegment, string> = {
  retail: "Relationship / retail partner",
  business_owner: "Passive / managed partner",
};

export const RETAIL_SPLIT_TIERS = ["90_10", "80_20", "70_30"] as const;
export const BUSINESS_SPLIT_TIERS = ["60_40", "50_50"] as const;

export const PARTNER_REVENUE_SPLIT_TIERS = [
  ...RETAIL_SPLIT_TIERS,
  ...BUSINESS_SPLIT_TIERS,
] as const;
export type PartnerRevenueSplitTier = (typeof PARTNER_REVENUE_SPLIT_TIERS)[number];

export const PARTNER_PCT_BY_TIER: Record<PartnerRevenueSplitTier, number> = {
  "90_10": 90,
  "80_20": 80,
  "70_30": 70,
  "60_40": 60,
  "50_50": 50,
};

export const RETAIL_DEFAULT_TIER: PartnerRevenueSplitTier = "80_20";
export const PASSIVE_DEFAULT_TIER: PartnerRevenueSplitTier = "50_50";

export type PartnerSplitConfig = {
  segment: PartnerClientSegment | null;
  tier: PartnerRevenueSplitTier | null;
  hasOwnSystem: boolean;
  qualifiedVehicleCount: number;
};

export type ResolvedPartnerSplit = {
  segment: PartnerClientSegment;
  tier: PartnerRevenueSplitTier;
  partnerPct: number;
  agencyPct: number;
  eligible: boolean;
  source: "organization" | "journey" | "operator_fallback";
};

export type SplitAmounts = {
  grossCents: number;
  partnerCents: number;
  agencyCents: number;
  partnerPct: number;
  agencyPct: number;
};
