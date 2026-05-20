import type { InsuranceCoverageSource } from "@/lib/rental-pricing/types";

export type LotReleaseCheck = {
  approved: boolean;
  blockers: string[];
  coverageSource: InsuranceCoverageSource;
};

/** Gate vehicle leaving the lot — insurance must be verified per source rules. */
export function checkLotRelease(input: {
  coverageSource: InsuranceCoverageSource;
  insuranceVerified: boolean;
  lotReleaseApproved: boolean;
  corporatePolicyId?: string | null;
  policyNumber?: string | null;
  carrierName?: string | null;
}): LotReleaseCheck {
  const blockers: string[] = [];

  if (input.coverageSource === "pending") {
    blockers.push("Insurance coverage not selected.");
  }

  if (input.coverageSource === "renter_own") {
    if (!input.policyNumber?.trim() || !input.carrierName?.trim()) {
      blockers.push("Renter policy carrier and number required.");
    }
  }

  if (input.coverageSource === "corporate_non_owner" && !input.corporatePolicyId?.trim()) {
    blockers.push("Corporate non-owner policy must be bound before lot release.");
  }

  if (!input.insuranceVerified) {
    blockers.push("Insurance verification pending staff approval.");
  }

  if (!input.lotReleaseApproved) {
    blockers.push("Lot release not approved.");
  }

  return {
    approved: blockers.length === 0,
    blockers,
    coverageSource: input.coverageSource,
  };
}
