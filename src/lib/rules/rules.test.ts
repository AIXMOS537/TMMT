import { describe, expect, it } from "vitest";

import {
  BG_CHECK_DECISIONS,
  BG_DECISION,
  BusinessPolicyRequiredError,
  LEGACY_ELIGIBILITY_ARTEFACT,
  MissingInputError,
  decideEligibility,
  eq,
  gateCheck,
  ifThen,
  isBlank,
  neq,
  normalizeEligibilityStatus,
  normalizeOwnInsurance,
  ownerNetAfterNotePerMonth,
  ownerPayoutPerWeek,
  partnerChurnRisk,
  requiredScreeningDocuments,
  tmmtGrossPerWeek,
  truthy,
} from "./index";

describe("Airtable evaluation semantics", () => {
  it("treats null, undefined and empty string as blank — but not 0 or false", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank("")).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(isBlank(false)).toBe(false);
  });

  it("treats blank, 0 and false as falsy; other values as truthy", () => {
    expect(truthy(null)).toBe(false);
    expect(truthy(0)).toBe(false);
    expect(truthy(false)).toBe(false);
    expect(truthy("Leased")).toBe(true);
    expect(truthy(-1)).toBe(true);
  });

  it("returns BLANK, not 0 or '', when IF has no else branch", () => {
    // Load-bearing: ownerNetAfterNotePerMonth relies on this so a missing rate never
    // surfaces as a payout of zero.
    expect(ifThen(false, "yes")).toBeNull();
    expect(ifThen(true, "yes")).toBe("yes");
  });

  it("says a blank field is NOT equal to a string literal", () => {
    // This single behaviour is what lets a blank Finance Status pass the onboarding gate.
    expect(neq(null, "Leased")).toBe(true);
    expect(eq(null, "Leased")).toBe(false);
    expect(eq(null, null)).toBe(true);
  });
});

describe("partner economics — payout formulas", () => {
  it("computes owner payout and TMMT gross at each split on file", () => {
    // Values verified present in public.fleet: 0.60 (1 vehicle), 0.65 (2), 0.70 (4).
    expect(ownerPayoutPerWeek(500, 0.7)).toBeCloseTo(350, 6);
    expect(tmmtGrossPerWeek(500, 0.7)).toBeCloseTo(150, 6);

    expect(ownerPayoutPerWeek(500, 0.65)).toBeCloseTo(325, 6);
    expect(tmmtGrossPerWeek(500, 0.65)).toBeCloseTo(175, 6);

    expect(ownerPayoutPerWeek(500, 0.6)).toBeCloseTo(300, 6);
    expect(tmmtGrossPerWeek(500, 0.6)).toBeCloseTo(200, 6);
  });

  it("splits the whole weekly rate between owner and TMMT", () => {
    for (const pct of [0.6, 0.65, 0.7]) {
      expect(ownerPayoutPerWeek(450, pct) + tmmtGrossPerWeek(450, pct)).toBeCloseTo(450, 6);
    }
  });

  it("uses 4.33 weeks per month and subtracts the car note", () => {
    // 500 * 0.70 * 4.33 = 1515.5 ; minus a 400 note = 1115.5
    expect(ownerNetAfterNotePerMonth(500, 0.7, 400)).toBeCloseTo(1115.5, 6);
  });

  it("treats a missing car note as zero, per the legacy inner IF", () => {
    expect(ownerNetAfterNotePerMonth(500, 0.7, null)).toBeCloseTo(1515.5, 6);
    expect(ownerNetAfterNotePerMonth(500, 0.7, 0)).toBeCloseTo(1515.5, 6);
  });

  it("returns null — never 0 — when the weekly rate is blank", () => {
    expect(ownerNetAfterNotePerMonth(null, 0.7, 400)).toBeNull();
    expect(ownerNetAfterNotePerMonth(0, 0.7, 400)).toBeNull();
  });
});

describe("partner economics — refuses to invent a split", () => {
  it("throws rather than defaulting when the partner percentage is missing", () => {
    // 36 of 43 fleet vehicles are in exactly this state.
    expect(() => ownerPayoutPerWeek(500, null)).toThrow(MissingInputError);
    expect(() => tmmtGrossPerWeek(500, null)).toThrow(MissingInputError);
    expect(() => ownerNetAfterNotePerMonth(500, null, 400)).toThrow(MissingInputError);
  });

  it("points the caller at the owner decision rather than failing opaquely", () => {
    expect(() => ownerPayoutPerWeek(500, null)).toThrow(/explicit partner split/);
    expect(() => ownerPayoutPerWeek(500, null)).toThrow(/36 of 43/);
  });

  it("catches the integer-percent mistake before it becomes a 100x payout error", () => {
    expect(() => ownerPayoutPerWeek(500, 70)).toThrow(/DECIMAL/);
  });

  it("requires a weekly rate", () => {
    expect(() => ownerPayoutPerWeek(null, 0.7)).toThrow(MissingInputError);
  });
});

describe("partner churn risk", () => {
  it("classifies against an owner-supplied threshold and never invents one", () => {
    // The threshold is a required argument precisely because the business never set a number.
    expect(partnerChurnRisk(-50, 100)).toBe("negative");
    expect(partnerChurnRisk(50, 100)).toBe("near_zero");
    expect(partnerChurnRisk(900, 100)).toBe("acceptable");
    expect(partnerChurnRisk(null, 100)).toBe("unknown");
  });
});

describe("onboarding gate check", () => {
  it("reads CLEAR only when all three hard stops pass", () => {
    const result = gateCheck({
      commercialUseCleared: "Yes – Verified",
      titleInOwnersName: true,
      financeStatus: "Paid Off",
    });
    expect(result.clear).toBe(true);
    expect(result.legacyValue).toBe("CLEAR");
    expect(result.blockers).toEqual([]);
    expect(result.fidelityWarning).toBeUndefined();
  });

  it("flags insurance when commercial use is not verified", () => {
    const result = gateCheck({
      commercialUseCleared: "In Review",
      titleInOwnersName: true,
      financeStatus: "Financed",
    });
    expect(result.clear).toBe(false);
    expect(result.blockers).toEqual(["INSURANCE"]);
    expect(result.legacyValue).toBe("INSURANCE ");
  });

  it("flags title, and finance for a leased vehicle", () => {
    const result = gateCheck({
      commercialUseCleared: "Yes – Verified",
      titleInOwnersName: false,
      financeStatus: "Leased",
    });
    expect(result.blockers).toEqual(["TITLE", "FINANCE"]);
    expect(result.legacyValue).toBe("TITLE FINANCE ");
  });

  it("reproduces the legacy flag string exactly, trailing spaces included", () => {
    const result = gateCheck({
      commercialUseCleared: "No",
      titleInOwnersName: false,
      financeStatus: "Unknown",
    });
    expect(result.legacyValue).toBe("INSURANCE TITLE FINANCE ");
  });

  it("FIDELITY FINDING: a blank Finance Status slips through the finance hard stop", () => {
    // blank != "Leased" and blank != "Unknown" are both TRUE in Airtable, so the gate reads
    // CLEAR without the finance status ever having been established. Reproduced deliberately;
    // whether blank should block is BUSINESS POLICY REQUIRED.
    const result = gateCheck({
      commercialUseCleared: "Yes – Verified",
      titleInOwnersName: true,
      financeStatus: null,
    });

    expect(result.clear).toBe(true);
    expect(result.legacyValue).toBe("CLEAR");
    expect(result.blockers).toEqual([]);
    expect(result.fidelityWarning).toMatch(/BUSINESS POLICY REQUIRED/);
  });
});

describe("eligibility — refuses to reconstruct a rule that never existed", () => {
  it("throws for every signal combination, including the obvious ones", () => {
    const allVerified = {
      backgroundCheck: "Verified" as const,
      insuranceCheck: "Verified" as const,
      earningsVerification: "Verified" as const,
    };
    const allFailed = {
      backgroundCheck: "Failed" as const,
      insuranceCheck: "Failed" as const,
      earningsVerification: "Failed" as const,
    };

    // "All three verified" looks obviously eligible. It is still a guess, so it still refuses.
    expect(() => decideEligibility(allVerified)).toThrow(BusinessPolicyRequiredError);
    expect(() => decideEligibility(allFailed)).toThrow(BusinessPolicyRequiredError);
  });

  it("names the policy and where the gap is documented", () => {
    const signals = {
      backgroundCheck: "Verified" as const,
      insuranceCheck: "Pending" as const,
      earningsVerification: null,
    };
    try {
      decideEligibility(signals);
      expect.unreachable("decideEligibility must throw");
    } catch (err) {
      expect(err).toBeInstanceOf(BusinessPolicyRequiredError);
      const e = err as BusinessPolicyRequiredError;
      expect(e.policyKey).toBe("eligibility_truth_table");
      expect(e.docRef).toMatch(/business-rules/);
      // The refusal now cites the decisive fact: the signals were never recorded at all,
      // so no rule is derivable from history even in principle.
      expect(e.message).toMatch(/ZERO records/);
      expect(e.message).toMatch(/OWNER-DECISION-PACK/);
    }
  });

  it("refuses to state which screening documents are mandatory", () => {
    expect(() => requiredScreeningDocuments()).toThrow(BusinessPolicyRequiredError);
  });
});

describe("legacy vocabulary normalisation", () => {
  it("maps the three real verdicts", () => {
    expect(normalizeEligibilityStatus("Eligible").verdict).toBe("eligible");
    expect(normalizeEligibilityStatus("Not Eligible").verdict).toBe("not_eligible");
    expect(normalizeEligibilityStatus("Need Manager's Review").verdict).toBe("manager_review");
  });

  it("separates reason from verdict instead of conflating them", () => {
    const r = normalizeEligibilityStatus("out of radius");
    expect(r.verdict).toBeNull();
    expect(r.reasonCode).toBe("out_of_radius");
  });

  it("recognises 'ou' as the truncated artefact and flags that the RPC rejects it", () => {
    const r = normalizeEligibilityStatus("ou");
    expect(r.reasonCode).toBe("out_of_radius");
    expect(r.dataQualityFlag).toMatch(/truncated/);
    // VERIFIED against the live bg_check_decide definition: 'ou' is not one of the five
    // accepted decisions, so these rows cannot be written through the decision contract.
    expect(r.dataQualityFlag).toMatch(/REJECTS/);
  });

  it("uses the canonical vocabulary rather than a private copy of it", () => {
    // Guard test F-16 forbids re-spelling these values; this asserts the rules engine reads
    // the same five decisions the DB CHECK constraint enforces.
    expect([...BG_CHECK_DECISIONS]).toHaveLength(5);
    expect(normalizeEligibilityStatus(BG_DECISION.eligible).verdict).toBe("eligible");
    expect(normalizeEligibilityStatus(BG_DECISION.notEligible).verdict).toBe("not_eligible");
    expect(normalizeEligibilityStatus(BG_DECISION.needsReview).verdict).toBe("manager_review");
    expect([...BG_CHECK_DECISIONS]).not.toContain(LEGACY_ELIGIBILITY_ARTEFACT);
  });

  it("flags 'Not found' as ambiguous rather than guessing", () => {
    const r = normalizeEligibilityStatus("Not found");
    expect(r.verdict).toBeNull();
    expect(r.dataQualityFlag).toMatch(/ambiguous/);
  });

  it("collapses all five Own Insurance? spellings, including the 'lno' typo", () => {
    expect(normalizeOwnInsurance("Yes")).toBe(true);
    expect(normalizeOwnInsurance("Y")).toBe(true);
    expect(normalizeOwnInsurance("No")).toBe(false);
    expect(normalizeOwnInsurance("N")).toBe(false);
    expect(normalizeOwnInsurance("lno")).toBe(false);
    expect(normalizeOwnInsurance(null)).toBeNull();
  });
});
