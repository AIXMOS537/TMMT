import { describe, it, expect } from "vitest";
import { assessFinancingReadiness, bandFor, type RentalRecord } from "./financing-readiness";
import { findBannedPhrases } from "@/lib/agent/compliance/banned-phrases";
import type { CreditProfile, NegativeItem } from "@/lib/credit-dispute/types";

const profile = (e?: number, q?: number, t?: number): CreditProfile =>
  ({
    id: "p1",
    fullName: "Test Renter",
    scoreExperian: e,
    scoreEquifax: q,
    scoreTransunion: t,
  }) as CreditProfile;

const item = (itemType: string, status = "active"): NegativeItem =>
  ({ id: `i-${itemType}-${status}`, itemType, furnisherName: "X", currentRound: 1, status }) as
    unknown as NegativeItem;

const NO_RENTAL: RentalRecord = {
  goodStandingDays: null,
  goodStanding: null,
  paymentsFurnished: null,
};
const GOOD_RENTAL: RentalRecord = {
  goodStandingDays: 120,
  goodStanding: true,
  paymentsFurnished: true,
};

describe("no report is its own answer, never a bad one", () => {
  it("a renter who has not pulled a report is `no_report`, not `building`", () => {
    const r = assessFinancingReadiness(null, null, NO_RENTAL);
    expect(r.stage).toBe("no_report");
    expect(r.band).toBe("unknown");
    expect(r.minScore).toBeNull();
  });

  it("every credit factor is unknown rather than judged", () => {
    const r = assessFinancingReadiness(null, null, NO_RENTAL);
    for (const key of ["score_band", "repossession", "public_records", "derogatories"]) {
      expect(r.factors.find(f => f.key === key)!.state, key).toBe("unknown");
    }
  });

  it("the first step offered is pulling the report", () => {
    expect(assessFinancingReadiness(null, null, NO_RENTAL).nextSteps[0]).toMatch(
      /myfreescorenow/i,
    );
  });
});

describe("score bands", () => {
  it.each([
    [null, "unknown"],
    [450, "deep_subprime"],
    [520, "subprime"],
    [620, "near_prime"],
    [700, "prime"],
    [800, "super_prime"],
  ])("score %s is %s", (score, expected) => {
    expect(bandFor(score as number | null).band).toBe(expected);
  });

  it("judges on the LOWEST bureau, not the average", () => {
    // 800 + 800 + 520 averages to prime but a lender sees the 520.
    const r = assessFinancingReadiness(profile(800, 800, 520), [], NO_RENTAL);
    expect(r.minScore).toBe(520);
    expect(r.band).toBe("subprime");
    expect(r.factors.find(f => f.key === "score_band")!.state).toBe("blocker");
  });
});

describe("a repossession is weighted as the auto-lending blocker it is", () => {
  it("flags an active repossession", () => {
    const r = assessFinancingReadiness(profile(700, 700, 700), [item("repossession")], NO_RENTAL);
    const f = r.factors.find(f => f.key === "repossession")!;
    expect(f.state).toBe("blocker");
    expect(r.stage).toBe("building");
  });

  it("a removed repossession no longer blocks", () => {
    const r = assessFinancingReadiness(
      profile(700, 700, 700),
      [item("repossession", "removed")],
      GOOD_RENTAL,
    );
    expect(r.factors.find(f => f.key === "repossession")!.state).toBe("strength");
  });

  it("does not tell the renter it will be removed or how fast", () => {
    const r = assessFinancingReadiness(profile(700, 700, 700), [item("repossession")], NO_RENTAL);
    const detail = r.factors.find(f => f.key === "repossession")!.detail;
    expect(detail).not.toMatch(/will be removed|guarantee|we can remove/i);
  });
});

describe("the TMMT rental record is treated as the asset it is", () => {
  it("90+ days of on-time payments is a strength", () => {
    const r = assessFinancingReadiness(profile(700, 700, 700), [], GOOD_RENTAL);
    const f = r.factors.find(f => f.key === "rental_record")!;
    expect(f.state).toBe("strength");
    expect(f.detail).toMatch(/120 days/);
    expect(f.detail).toMatch(/reported to the bureaus/);
  });

  it("says plainly when the payments are NOT being furnished", () => {
    const r = assessFinancingReadiness(profile(700, 700, 700), [], {
      ...GOOD_RENTAL,
      paymentsFurnished: false,
    });
    expect(r.factors.find(f => f.key === "rental_record")!.detail).toMatch(/not yet reported/i);
  });

  it("being behind is a blocker, and named as the fastest fix", () => {
    const r = assessFinancingReadiness(profile(700, 700, 700), [], {
      goodStandingDays: 200,
      goodStanding: false,
      paymentsFurnished: true,
    });
    const f = r.factors.find(f => f.key === "rental_record")!;
    expect(f.state).toBe("blocker");
    expect(f.detail).toMatch(/behind/i);
    expect(r.stage).toBe("building");
  });
});

describe("the top of the ladder is still not an approval", () => {
  it("a clean strong file reaches ready_to_apply and says the lender decides", () => {
    const r = assessFinancingReadiness(profile(760, 770, 780), [], GOOD_RENTAL);
    expect(r.stage).toBe("ready_to_apply");
    expect(r.approvalIsLenderDecision).toBe(true);
    expect(r.nextSteps.join(" ")).toMatch(/lender makes the final decision/i);
  });

  it("there is no field anywhere that means approved or likely to be approved", () => {
    const r = assessFinancingReadiness(profile(800, 800, 800), [], GOOD_RENTAL);
    const keys = Object.keys(r).join(" ").toLowerCase();
    expect(keys).not.toMatch(/approved|approval_chance|probability|odds|guarantee/);
    expect(JSON.stringify(r).toLowerCase()).not.toMatch(/you will be approved|guaranteed/);
  });

  it("only two missing bureaus keeps a perfect file at `close`, not ready", () => {
    const r = assessFinancingReadiness(profile(800), [], GOOD_RENTAL);
    expect(r.bureausReporting).toBe(1);
    expect(r.stage).toBe("close");
  });
});

describe("nothing it says to a renter may breach the language gate", () => {
  it("no factor or next step contains banned phrasing", () => {
    const cases = [
      assessFinancingReadiness(null, null, NO_RENTAL),
      assessFinancingReadiness(profile(450, 460, 470), [item("repossession"), item("judgment")], {
        goodStandingDays: 10,
        goodStanding: true,
        paymentsFurnished: false,
      }),
      assessFinancingReadiness(profile(800, 800, 800), [], GOOD_RENTAL),
      assessFinancingReadiness(profile(620, 640, 660), [item("collection")], {
        goodStandingDays: 200,
        goodStanding: false,
        paymentsFurnished: true,
      }),
    ];
    for (const r of cases) {
      for (const f of r.factors) {
        expect(findBannedPhrases(`${f.label}. ${f.detail}`), f.detail).toHaveLength(0);
      }
      for (const s of r.nextSteps) {
        expect(findBannedPhrases(s), s).toHaveLength(0);
      }
    }
  });
});
