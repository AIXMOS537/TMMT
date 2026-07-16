import { describe, it, expect } from "vitest";
import { canRelease, discountApprovalTier, type ReleaseFacts } from "@/lib/rentals/release-gate";

/** A booking that is genuinely ready to go. Each test spoils exactly ONE thing. */
const CLEAN: ReleaseFacts = {
  insurance_coverage_source: "tmmt_internal",
  insurance_verified: true,
  background_approved: true,
  agreement_signed: true,
  deposit_collected_cents: 50000,
  deposit_required_cents: 50000,
  quoted_daily_cents: 8900,
};

describe("canRelease — GREEN half (an alarm stuck ON is as useless as one stuck OFF)", () => {
  it("releases a fully-proven booking", () => {
    expect(canRelease(CLEAN)).toEqual({ allowed: true });
  });

  it("accepts each real coverage source", () => {
    for (const src of ["renter_own", "tmmt_internal", "corporate_non_owner"] as const) {
      expect(canRelease({ ...CLEAN, insurance_coverage_source: src }).allowed).toBe(true);
    }
  });

  it("allows an overpaid deposit", () => {
    expect(canRelease({ ...CLEAN, deposit_collected_cents: 60000 }).allowed).toBe(true);
  });
});

describe("canRelease — RED half: the car must NOT move", () => {
  const denied = (f: Partial<ReleaseFacts>) => {
    const d = canRelease({ ...CLEAN, ...f });
    expect(d.allowed).toBe(false);
    return d.allowed === false ? d.blockers : [];
  };

  it("blocks when coverage is pending — 'pending' is the absence of insurance, not a kind of it", () => {
    expect(denied({ insurance_coverage_source: "pending" })[0]).toMatch(/coverage source/i);
  });

  it("blocks when coverage source is null", () => {
    expect(denied({ insurance_coverage_source: null }).length).toBeGreaterThan(0);
  });

  it("blocks a CLAIMED but unverified policy", () => {
    expect(denied({ insurance_verified: false })[0]).toMatch(/not verified/i);
  });

  it("blocks when insurance_verified is null (never checked ≠ fine)", () => {
    expect(denied({ insurance_verified: null }).length).toBeGreaterThan(0);
  });

  it("blocks when the background check never ran — every insurance product requires it", () => {
    expect(denied({ background_approved: null })[0]).toMatch(/background/i);
  });

  it("blocks an unsigned agreement", () => {
    expect(denied({ agreement_signed: false })[0]).toMatch(/agreement/i);
  });

  it("blocks a short deposit", () => {
    expect(denied({ deposit_collected_cents: 49999 })[0]).toMatch(/deposit short/i);
  });

  it("blocks when no deposit was collected at all", () => {
    expect(denied({ deposit_collected_cents: null })[0]).toMatch(/deposit short/i);
  });

  it("blocks an unpriced car", () => {
    expect(denied({ quoted_daily_cents: null })[0]).toMatch(/unpriced|no quote/i);
  });

  it("THE SUPRA CASE: uninsured car, no background, no paper — every blocker fires at once", () => {
    // A real car went out this way to a 19-year-old. This test is that incident, frozen.
    const blockers = denied({
      insurance_coverage_source: "pending",
      insurance_verified: false,
      background_approved: false,
      agreement_signed: false,
      deposit_collected_cents: 0,
      quoted_daily_cents: null,
    });
    expect(blockers.length).toBe(6);
  });

  it("an empty-ish booking is DENIED, not allowed by default (fail closed)", () => {
    const d = canRelease({
      insurance_coverage_source: undefined,
      insurance_verified: undefined,
      background_approved: undefined,
      agreement_signed: undefined,
      deposit_collected_cents: undefined,
      deposit_required_cents: 50000,
      quoted_daily_cents: undefined,
    });
    expect(d.allowed).toBe(false);
  });
});

describe("discountApprovalTier", () => {
  it("no discount needs no signature", () => {
    expect(discountApprovalTier(0)).toBe("none");
  });
  it("routes shallow cuts to a manager", () => {
    expect(discountApprovalTier(5)).toBe("manager");
    expect(discountApprovalTier(10)).toBe("manager");
  });
  it("routes deeper cuts to a supervisor", () => {
    expect(discountApprovalTier(10.01)).toBe("supervisor");
    expect(discountApprovalTier(25)).toBe("supervisor");
  });
  it("routes anything past 25% to the owner — nobody discounts their own deal to zero", () => {
    expect(discountApprovalTier(25.01)).toBe("owner");
    expect(discountApprovalTier(100)).toBe("owner");
  });
});
