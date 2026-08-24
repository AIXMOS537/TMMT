/**
 * GHL tag canon — aligned with TMMT-LIVE ghl-payment-sync, CREDIT-GUIDANCE-SOP, FUNDING-HANDOFF-SOP
 */
export const CREDIT_GHL_TAGS = {
  guidanceActive: "credit-guidance-active",
  consultBooked: "credit-consult-booked",
  fundingPrep: "funding-prep",
  fundingReady: "funding-ready",
  mfsnEnrolled: "mfsn-enrolled",
  disputefoxActive: "disputefox-active",
  repairComplete: "credit-repair-complete",
  member97: "member-97",
} as const;

export const CREDIT_GHL_STAGES = [
  "Member $97",
  "Credit Consult Booked",
  "Credit Guidance Active",
  "Funding Prep",
  "Funded / Closed Won",
] as const;

/** Map funding readiness tier → GHL tag (from funding-readiness.ts) */
export function ghlTagForFundingTier(tier: string): string {
  switch (tier) {
    case "elite":
    case "funding_ready":
      return CREDIT_GHL_TAGS.fundingPrep;
    case "almost":
    case "warming":
    case "not_ready":
    default:
      return CREDIT_GHL_TAGS.guidanceActive;
  }
}

export function disputeRoundTag(roundNumber: number): string {
  return `dispute-round-${roundNumber}-sent`;
}
