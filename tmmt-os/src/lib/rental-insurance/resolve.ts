import type { InsuranceCoverageSource, VehicleTier } from "@/lib/rental-pricing/types";

export type InsuranceProductRow = {
  tier: VehicleTier;
  coverage_source: InsuranceCoverageSource;
  name: string;
  weekly_premium_cents: number;
  min_liability_cents: number | null;
  requires_background_approved: boolean;
  corporate_carrier_name: string | null;
  corporate_policy_template: string | null;
};

export type InsuranceResolutionInput = {
  tier: VehicleTier;
  requestedSource: InsuranceCoverageSource;
  backgroundCheckStatus?: string | null;
  riskScore?: number | null;
  policyNumber?: string | null;
  carrierName?: string | null;
  corporatePolicyId?: string | null;
  verifiedAt?: string | null;
  products: InsuranceProductRow[];
};

export type InsuranceResolution = {
  source: InsuranceCoverageSource;
  productName: string | null;
  weeklyPremiumCents: number;
  lotReleaseEligible: boolean;
  blockers: string[];
  requiresStaffVerification: boolean;
};

const APPROVED_BG = new Set(["approved", "cleared", "passed", "complete", "completed"]);

function isBackgroundApproved(status: string | null | undefined): boolean {
  if (!status) return false;
  return APPROVED_BG.has(status.trim().toLowerCase());
}

function pickProduct(
  products: InsuranceProductRow[],
  tier: VehicleTier,
  source: InsuranceCoverageSource
): InsuranceProductRow | undefined {
  return products.find((p) => p.tier === tier && p.coverage_source === source);
}

/** Decide coverage path: own policy, TMMT internal (risk-based), or corporate non-owner. */
export function resolveInsuranceForQuote(
  input: InsuranceResolutionInput
): InsuranceResolution {
  const blockers: string[] = [];
  let source = input.requestedSource;

  if (source === "pending") {
    blockers.push("Select an insurance option before pickup.");
    return {
      source: "pending",
      productName: null,
      weeklyPremiumCents: 0,
      lotReleaseEligible: false,
      blockers,
      requiresStaffVerification: true,
    };
  }

  if (source === "renter_own") {
    const hasProof = Boolean(input.policyNumber?.trim() && input.carrierName?.trim());
    if (!hasProof) {
      blockers.push("Upload proof of your own auto policy (carrier + policy number).");
    }
    if (!input.verifiedAt) {
      blockers.push("Staff must verify renter policy before lot release.");
    }
    return {
      source: "renter_own",
      productName: "Renter-provided policy",
      weeklyPremiumCents: 0,
      lotReleaseEligible: hasProof && Boolean(input.verifiedAt),
      blockers,
      requiresStaffVerification: !input.verifiedAt,
    };
  }

  const bgOk = isBackgroundApproved(input.backgroundCheckStatus);
  if (!bgOk) {
    blockers.push("Background check must be approved before internal or corporate coverage.");
  }

  if (source === "tmmt_internal") {
    const risk = input.riskScore ?? 50;
    if (risk > 75) {
      blockers.push("Risk score too high for TMMT internal policy — corporate non-owner required.");
      source = "corporate_non_owner";
    }
  }

  if (source === "corporate_non_owner") {
    const product = pickProduct(input.products, input.tier, "corporate_non_owner");
    if (!product) {
      blockers.push("No corporate non-owner product configured for this tier.");
      return {
        source: "corporate_non_owner",
        productName: null,
        weeklyPremiumCents: 0,
        lotReleaseEligible: false,
        blockers,
        requiresStaffVerification: true,
      };
    }
    if (!input.corporatePolicyId?.trim()) {
      blockers.push(
        `Corporate non-owner policy must be issued by ${product.corporate_carrier_name ?? "fleet carrier"} before lot release.`
      );
    }
    const eligible =
      bgOk && Boolean(input.corporatePolicyId?.trim()) && Boolean(input.verifiedAt);
    if (!input.verifiedAt) {
      blockers.push("Staff must confirm corporate policy bind before vehicle leaves the lot.");
    }
    return {
      source: "corporate_non_owner",
      productName: product.name,
      weeklyPremiumCents: product.weekly_premium_cents,
      lotReleaseEligible: eligible,
      blockers,
      requiresStaffVerification: !input.verifiedAt,
    };
  }

  const internal = pickProduct(input.products, input.tier, "tmmt_internal")!;
  const risk = input.riskScore ?? 50;
  const premiumMultiplier = risk <= 40 ? 0.9 : risk <= 60 ? 1 : risk <= 75 ? 1.15 : 1.35;
  const weeklyPremiumCents = Math.round(internal.weekly_premium_cents * premiumMultiplier);

  const eligible = bgOk && risk <= 75 && Boolean(input.verifiedAt);
  if (!input.verifiedAt) {
    blockers.push("Staff must approve internal policy bind after background review.");
  }

  return {
    source: "tmmt_internal",
    productName: internal.name,
    weeklyPremiumCents,
    lotReleaseEligible: eligible,
    blockers,
    requiresStaffVerification: !input.verifiedAt,
  };
}

/** Map legacy background-check Yes/No to coverage source. */
export function legacyOwnInsuranceToSource(
  ownInsurance: string | null | undefined,
  explicit?: string | null
): InsuranceCoverageSource {
  if (explicit && explicit !== "pending") {
    return explicit as InsuranceCoverageSource;
  }
  if (ownInsurance?.toLowerCase() === "yes") return "renter_own";
  return "pending";
}

/** Suggest coverage when renter has no own policy. */
export function suggestCoverageWithoutOwnPolicy(
  backgroundCheckStatus: string | null | undefined,
  riskScore: number | null | undefined
): InsuranceCoverageSource {
  if (!isBackgroundApproved(backgroundCheckStatus)) return "pending";
  const risk = riskScore ?? 50;
  if (risk <= 75) return "tmmt_internal";
  return "corporate_non_owner";
}

export function computeRiskScoreFromBackground(input: {
  backgroundCheckStatus?: string | null;
  insuranceCheckStatus?: string | null;
  earningsVerificationStatus?: string | null;
}): number {
  let score = 50;
  const bg = (input.backgroundCheckStatus ?? "").toLowerCase();
  const ins = (input.insuranceCheckStatus ?? "").toLowerCase();
  const earn = (input.earningsVerificationStatus ?? "").toLowerCase();

  if (APPROVED_BG.has(bg)) score -= 15;
  else if (bg === "pending") score += 5;
  else if (bg) score += 25;

  if (APPROVED_BG.has(ins)) score -= 10;
  else if (ins === "pending") score += 5;
  else if (ins) score += 15;

  if (APPROVED_BG.has(earn)) score -= 10;
  else if (earn === "pending") score += 5;
  else if (earn) score += 10;

  return Math.min(100, Math.max(0, score));
}
