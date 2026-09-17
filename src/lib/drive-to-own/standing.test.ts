import { describe, it, expect } from "vitest";
import {
  assessStanding,
  DEFAULT_STANDING_POLICY,
  type StandingEvidence,
} from "./standing";
import { findBannedPhrases } from "@/lib/agent/compliance/banned-phrases";

/** Production's real state: tickets exist but none are attributable to a renter. */
const UNLINKED_TOLLS = { attributable: false, unpaidCount: null, oldestUnpaidDays: null };

const CLEAN: StandingEvidence = {
  overduePayments: 0,
  oldestOverdueDays: null,
  obligations: { attributable: true, unpaidCount: 0, oldestUnpaidDays: null },
  missedInspections: 0,
  onRestrictionList: false,
};

const NOTHING_TRACKED: StandingEvidence = {
  overduePayments: null,
  oldestOverdueDays: null,
  obligations: UNLINKED_TOLLS,
  missedInspections: null,
  onRestrictionList: null,
};

const check = (s: ReturnType<typeof assessStanding>, key: string) =>
  s.checks.find(c => c.key === key)!;

describe("a control that cannot see must not convict", () => {
  it("nothing tracked means nobody is penalised", () => {
    const s = assessStanding(NOTHING_TRACKED);
    expect(s.standing).toBe("good");
    expect(s.breaches).toHaveLength(0);
    expect(s.restartsClock).toBe(false);
    expect(s.removedFromPath).toBe(false);
  });

  it("but it is reported loudly rather than hidden", () => {
    const s = assessStanding(NOTHING_TRACKED);
    expect(s.unenforceable.map(c => c.key)).toEqual(
      expect.arrayContaining(["payments", "obligations", "inspections", "restriction_list"]),
    );
  });

  it("unlinked tolls abstain — production has 0 of 308 tickets linked to a renter", () => {
    const s = assessStanding({ ...CLEAN, obligations: UNLINKED_TOLLS });
    expect(check(s, "obligations").state).toBe("unenforceable");
    expect(check(s, "obligations").detail).toMatch(/not currently linked/i);
    // And it costs the renter nothing.
    expect(s.standing).toBe("good");
  });
});

describe("owing is not the failure — being reluctant to settle is", () => {
  it("a payment missed yesterday is inside the cure window, not a breach", () => {
    const s = assessStanding({ ...CLEAN, overduePayments: 1, oldestOverdueDays: 1 });
    expect(check(s, "payments").state).toBe("clear");
    expect(s.standing).toBe("at_risk");
    expect(s.restartsClock).toBe(false);
    expect(check(s, "payments").detail).toMatch(/13 days to catch up/);
  });

  it("the same payment past the window is a breach", () => {
    const s = assessStanding({
      ...CLEAN,
      overduePayments: 1,
      oldestOverdueDays: DEFAULT_STANDING_POLICY.cureWindowDays + 1,
    });
    expect(check(s, "payments").state).toBe("breach");
    expect(s.standing).toBe("lapsed");
    expect(s.restartsClock).toBe(true);
  });

  it("a fresh toll does not cost anything either", () => {
    const s = assessStanding({
      ...CLEAN,
      obligations: { attributable: true, unpaidCount: 2, oldestUnpaidDays: 3 },
    });
    expect(check(s, "obligations").state).toBe("clear");
    expect(s.standing).toBe("at_risk");
  });

  it("an old unsettled toll does", () => {
    const s = assessStanding({
      ...CLEAN,
      obligations: { attributable: true, unpaidCount: 2, oldestUnpaidDays: 60 },
    });
    expect(check(s, "obligations").state).toBe("breach");
    expect(s.restartsClock).toBe(true);
  });
});

describe("missing inspections", () => {
  it("one missed is a nudge, not a penalty", () => {
    const s = assessStanding({ ...CLEAN, missedInspections: 1 });
    expect(check(s, "inspections").state).toBe("clear");
    expect(check(s, "inspections").detail).toMatch(/book the next one/i);
  });

  it("repeatedly not showing up restarts the clock", () => {
    const s = assessStanding({ ...CLEAN, missedInspections: 3 });
    expect(check(s, "inspections").state).toBe("breach");
    expect(s.standing).toBe("lapsed");
    expect(check(s, "inspections").detail).toMatch(/safe and in working order/i);
  });
});

describe("a lapse is recoverable — removal is not, so it needs real evidence", () => {
  it("a missed payment restarts the clock, it does not end the journey", () => {
    const s = assessStanding({ ...CLEAN, overduePayments: 2, oldestOverdueDays: 90 });
    expect(s.standing).toBe("lapsed");
    expect(s.removedFromPath).toBe(false);
    expect(s.nextSteps.join(" ")).toMatch(/nothing you've already earned is lost/i);
  });

  it("only the restriction list removes someone from the path", () => {
    const s = assessStanding({ ...CLEAN, onRestrictionList: true });
    expect(s.standing).toBe("removed_from_path");
    expect(s.removedFromPath).toBe(true);
    // Removal supersedes the clock — there is no clock left to restart.
    expect(s.restartsClock).toBe(false);
  });

  it("the harsher policy is available but is NOT the default", () => {
    expect(DEFAULT_STANDING_POLICY.missedPaymentRemovesFromPath).toBe(false);
    const s = assessStanding(
      { ...CLEAN, overduePayments: 1, oldestOverdueDays: 60 },
      { ...DEFAULT_STANDING_POLICY, missedPaymentRemovesFromPath: true },
    );
    expect(s.removedFromPath).toBe(true);
  });
});

describe("a clean renter is simply clear", () => {
  it("everything current is good standing with no noise", () => {
    const s = assessStanding(CLEAN);
    expect(s.standing).toBe("good");
    expect(s.breaches).toHaveLength(0);
    expect(s.unenforceable).toHaveLength(0);
    expect(s.nextSteps).toHaveLength(0);
  });
});

describe("nothing said to the renter breaches the language gate", () => {
  it("no check or next step contains banned phrasing", () => {
    const cases: StandingEvidence[] = [
      CLEAN,
      NOTHING_TRACKED,
      { ...CLEAN, overduePayments: 1, oldestOverdueDays: 1 },
      { ...CLEAN, overduePayments: 3, oldestOverdueDays: 120 },
      { ...CLEAN, missedInspections: 4 },
      { ...CLEAN, onRestrictionList: true },
    ];
    for (const e of cases) {
      const s = assessStanding(e);
      for (const c of s.checks) {
        expect(findBannedPhrases(`${c.label}. ${c.detail}`), c.detail).toHaveLength(0);
      }
      for (const n of s.nextSteps) expect(findBannedPhrases(n), n).toHaveLength(0);
    }
  });

  it("never shames the renter", () => {
    const s = assessStanding({ ...CLEAN, overduePayments: 3, oldestOverdueDays: 120 });
    const all = s.checks.map(c => c.detail).join(" ").toLowerCase();
    expect(all).not.toMatch(/delinquent|deadbeat|failed to|you failed/);
  });
});
