import { describe, it, expect } from "vitest";
import { evaluateLadder, type LadderEvidence } from "./ladder";
import { GOOD_STANDING_DAYS_REQUIRED } from "./checkpoints";

/** Nothing wired — the state of every one of the 35 real journeys today. */
const NOTHING: LadderEvidence = {
  goodStandingDays: null,
  goodStanding: null,
  educationSectionsAcknowledged: null,
  educationSectionsRequired: null,
  creditEnrollmentActive: null,
  coreModulesComplete: null,
  coreModulesTotal: null,
  anyModuleStarted: null,
  mentorshipDfyActive: null,
  ltoAgreementSigned: null,
  vehicleTurnoverComplete: null,
};

/** A renter who has genuinely done everything. */
const ALL_DONE: LadderEvidence = {
  goodStandingDays: 120,
  goodStanding: true,
  educationSectionsAcknowledged: 3,
  educationSectionsRequired: 3,
  creditEnrollmentActive: true,
  coreModulesComplete: 8,
  coreModulesTotal: 8,
  anyModuleStarted: true,
  mentorshipDfyActive: false, // optional, deliberately NOT bought
  ltoAgreementSigned: false,
  vehicleTurnoverComplete: false,
};

const gate = (p: ReturnType<typeof evaluateLadder>, slug: string) =>
  p.gates.find(g => g.slug === slug)!;

describe("UNKNOWN IS NOT NO — the rule that protects the customer", () => {
  it("an unwired source is reported as unknown, never as the renter failing", () => {
    const p = evaluateLadder(NOTHING);
    for (const g of p.gates) {
      if (g.slug === "lto_eligible") continue; // computed, not evidenced
      expect(g.state, `${g.slug} must not be judged`).toBe("unknown");
    }
  });

  it("names every gate held up by a source nobody writes", () => {
    const p = evaluateLadder(NOTHING);
    expect(p.blockedByUnknown).toContain("credit_education_acknowledged");
    expect(p.blockedByUnknown).toContain("day_90_good_standing");
    // The optional gate is never listed as a blocker.
    expect(p.blockedByUnknown).not.toContain("mentorship_dfy_active");
  });

  it("unknown still blocks lease-to-own — it is not a free pass either", () => {
    expect(evaluateLadder(NOTHING).ltoEligible).toBe(false);
  });

  it("says nothing is tracked rather than inventing a shortfall", () => {
    expect(gate(evaluateLadder(NOTHING), "credit_enrollment_active").detail).toMatch(/not tracked/i);
  });
});

describe("the ladder pays out when it is genuinely earned", () => {
  it("clears lease-to-own without the optional paid mentorship", () => {
    const p = evaluateLadder(ALL_DONE);
    expect(gate(p, "mentorship_dfy_active").state).toBe("not_met");
    expect(gate(p, "mentorship_dfy_active").optional).toBe(true);
    expect(p.ltoEligible).toBe(true);
    expect(p.nextGate).toBe("vehicle_turnover_complete");
  });

  it("a Path C buyer is not penalised either", () => {
    const p = evaluateLadder({ ...ALL_DONE, mentorshipDfyActive: true });
    expect(gate(p, "mentorship_dfy_active").state).toBe("met");
    expect(p.ltoEligible).toBe(true);
  });

  it("is complete only once the car has actually changed hands", () => {
    expect(evaluateLadder(ALL_DONE).complete).toBe(false);
    expect(evaluateLadder({ ...ALL_DONE, vehicleTurnoverComplete: true }).complete).toBe(true);
  });
});

describe("one missing gate stops the car", () => {
  it.each([
    ["education", { educationSectionsAcknowledged: 2 }],
    ["enrollment", { creditEnrollmentActive: false }],
    ["training started", { anyModuleStarted: false }],
    ["core training", { coreModulesComplete: 7 }],
  ])("%s short — not eligible", (_label, patch) => {
    const p = evaluateLadder({ ...ALL_DONE, ...patch } as LadderEvidence);
    expect(p.ltoEligible).toBe(false);
  });
});

describe("90 consecutive days means consecutive", () => {
  it(`${GOOD_STANDING_DAYS_REQUIRED - 1} days is not enough`, () => {
    const p = evaluateLadder({ ...ALL_DONE, goodStandingDays: GOOD_STANDING_DAYS_REQUIRED - 1 });
    expect(gate(p, "day_90_good_standing").state).toBe("not_met");
    expect(p.ltoEligible).toBe(false);
  });

  it(`exactly ${GOOD_STANDING_DAYS_REQUIRED} days is enough`, () => {
    const p = evaluateLadder({ ...ALL_DONE, goodStandingDays: GOOD_STANDING_DAYS_REQUIRED });
    expect(gate(p, "day_90_good_standing").state).toBe("met");
  });

  it("a long counter does not survive standing having lapsed", () => {
    // The counter can read high while the renter is currently out of standing. The gate
    // says CONSECUTIVE, so a lapse restarts it — otherwise a defaulting renter keeps a car.
    const p = evaluateLadder({ ...ALL_DONE, goodStandingDays: 400, goodStanding: false });
    expect(gate(p, "day_90_good_standing").state).toBe("not_met");
    expect(gate(p, "day_90_good_standing").detail).toMatch(/lapsed/i);
    expect(p.ltoEligible).toBe(false);
  });
});

describe("eligibility is computed, never taken on trust", () => {
  it("a signed LTO agreement does not by itself grant eligibility", () => {
    // Guards against a hand-edited or stale row handing someone a car.
    const p = evaluateLadder({ ...NOTHING, ltoAgreementSigned: true });
    expect(p.ltoEligible).toBe(false);
  });

  it("an unseeded programme is unknown, not passed by doing nothing", () => {
    const p = evaluateLadder({
      ...ALL_DONE,
      educationSectionsAcknowledged: 0,
      educationSectionsRequired: 0,
    });
    expect(gate(p, "credit_education_acknowledged").state).toBe("unknown");
    expect(p.ltoEligible).toBe(false);
  });
});

describe("the ladder reports a position a human can act on", () => {
  it("points at the first thing to work on", () => {
    const p = evaluateLadder({ ...ALL_DONE, coreModulesComplete: 3 });
    expect(p.nextGate).toBe("training_core_complete");
    expect(gate(p, "training_core_complete").detail).toBe("3 of 8 core rebuild modules complete.");
  });

  it("reports how far they have got", () => {
    const p = evaluateLadder({ ...ALL_DONE, anyModuleStarted: false, coreModulesComplete: 0 });
    expect(p.clearedThrough).toBe("credit_enrollment_active");
  });

  it("returns the gates in ladder order", () => {
    const orders = evaluateLadder(NOTHING).gates.map(g => g.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(orders).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });
});
