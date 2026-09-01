import { describe, it, expect } from "vitest";
import type { NegativeItem, NegativeItemType } from "../types";
import {
  DEFAULT_DISPUTE_POLICY,
  decideForItem,
  decideForProfile,
  inferAssessment,
  isObsolete,
  sequenceFor,
  summarise,
  routeFor,
  STATUTORY_ROUTES,
  type ItemAssessment,
} from "./dispute-policy";

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function item(over: Partial<NegativeItem> = {}): NegativeItem {
  return {
    id: "item-1",
    bureau: "experian",
    itemType: "charge_off" as NegativeItemType,
    furnisherName: "Example Bank",
    dateOfFirstDelinquency: monthsAgo(12),
    currentRound: 0,
    status: "pending",
    ...over,
  } as NegativeItem;
}

describe("the hard rule — accurate items are coached, never disputed", () => {
  it("refuses to dispute an item a human has assessed as accurate", () => {
    const d = decideForItem(item(), { accuracy: "accurate" });
    expect(d.action).toBe("coach");
    expect(d.ruleId).toBe("accurate-item-coach-not-dispute");
    expect(d.sequence).toBeUndefined();
  });

  it("still coaches when the client is adamant — accuracy decides, not pressure", () => {
    const d = decideForItem(item(), { accuracy: "accurate", basis: "wrong_balance" });
    expect(d.action).toBe("coach");
  });

  it("tells a person what to do instead of disputing", () => {
    const d = decideForItem(item(), { accuracy: "accurate" });
    expect(d.nextStep).toMatch(/behaviour and time/i);
  });

  it("diaries the obsolescence date for an older accurate item", () => {
    const d = decideForItem(
      item({ dateOfFirstDelinquency: monthsAgo(48) }),
      { accuracy: "accurate" }
    );
    expect(d.action).toBe("coach");
    expect(d.nextStep).toMatch(/obsolete/i);
  });
});

describe("no letter without a recorded factual basis", () => {
  it("holds when the item is inaccurate but nobody said why", () => {
    const d = decideForItem(item(), { accuracy: "inaccurate" });
    expect(d.action).toBe("hold");
    expect(d.ruleId).toBe("basis-missing");
  });

  it("holds when accuracy was never assessed at all", () => {
    const d = decideForItem(item(), { accuracy: "unknown" });
    expect(d.action).toBe("hold");
    expect(d.ruleId).toBe("accuracy-unknown");
  });

  it("proceeds once a basis is recorded", () => {
    const d = decideForItem(item(), { accuracy: "inaccurate", basis: "never_late" });
    expect(d.action).toBe("dispute");
    expect(d.basis).toBe("never_late");
    expect(d.sequence?.length).toBeGreaterThan(0);
  });
});

describe("obsolete items", () => {
  it("treats an item past the 7-year period as obsolete", () => {
    expect(isObsolete(item({ dateOfFirstDelinquency: monthsAgo(90) }))).toBe(true);
  });

  it("does not treat a 3-year-old item as obsolete", () => {
    expect(isObsolete(item({ dateOfFirstDelinquency: monthsAgo(36) }))).toBe(false);
  });

  it("allows bankruptcy 10 years, not 7", () => {
    const bk = item({ itemType: "bankruptcy", dateOfFirstDelinquency: monthsAgo(96) });
    expect(isObsolete(bk)).toBe(false);
    expect(isObsolete(item({ ...bk, dateOfFirstDelinquency: monthsAgo(126) }))).toBe(true);
  });

  it("disputes an obsolete item EVEN IF it is accurate — the violation is the reporting", () => {
    const d = decideForItem(
      item({ dateOfFirstDelinquency: monthsAgo(100) }),
      { accuracy: "accurate" }
    );
    expect(d.action).toBe("dispute");
    expect(d.basis).toBe("obsolete");
    expect(d.rationale).toMatch(/605/);
  });

  it("does not run a six-round campaign for an obsolete item", () => {
    const d = decideForItem(item({ dateOfFirstDelinquency: monthsAgo(100) }), { accuracy: "accurate" });
    expect(d.sequence).toEqual(["initial_611", "cfpb_escalation"]);
  });
});

describe("sequencing follows the basis, not just the item type", () => {
  it("leads with FDCPA validation on a collection — the cheapest win", () => {
    expect(sequenceFor("wrong_balance", "collection")[0]).toBe("fdcpa_validation");
  });

  it("does not use FDCPA validation on a charge-off", () => {
    expect(sequenceFor("wrong_balance", "charge_off")).not.toContain("fdcpa_validation");
  });

  it("goes to method-of-verification first when a prior round came back unverifiable", () => {
    expect(sequenceFor("unverifiable", "charge_off")[0]).toBe("method_of_verification");
  });

  it("never emits a litigation threat automatically", () => {
    for (const t of ["collection", "charge_off", "bankruptcy", "hard_inquiry"] as NegativeItemType[]) {
      expect(sequenceFor("not_mine", t)).not.toContain("intent_to_litigate");
    }
  });

  it("emits one only when a human explicitly enables it", () => {
    const cfg = { ...DEFAULT_DISPUTE_POLICY, allowAutomaticLitigationThreat: true };
    // Still absent unless a sequence actually includes it — the flag permits, it does not add.
    expect(sequenceFor("not_mine", "collection", cfg)).not.toContain("intent_to_litigate");
  });
});

describe("escalation has a ceiling", () => {
  it("hands to a human after the configured number of rounds", () => {
    const d = decideForItem(item(), {
      accuracy: "inaccurate",
      basis: "wrong_balance",
      roundsSent: ["initial_611", "method_of_verification", "furnisher_623", "cfpb_escalation"],
    });
    expect(d.action).toBe("hold");
    expect(d.ruleId).toBe("max-rounds-reached");
  });

  it("skips rounds already sent", () => {
    const d = decideForItem(item(), {
      accuracy: "inaccurate",
      basis: "wrong_balance",
      roundsSent: ["initial_611"],
    });
    expect(d.action).toBe("dispute");
    expect(d.sequence).not.toContain("initial_611");
  });
});

describe("reading the flags the app already collects", () => {
  it("maps isOutdated to an obsolete basis", () => {
    expect(inferAssessment(item({ isOutdated: true })).basis).toBe("obsolete");
  });

  it("maps isUnverifiable to an unverifiable basis", () => {
    expect(inferAssessment(item({ isUnverifiable: true })).basis).toBe("unverifiable");
  });

  it("treats isInaccurate without detail as inaccurate-but-no-basis, so the gate holds", () => {
    const a = inferAssessment(item({ isInaccurate: true }));
    expect(a.accuracy).toBe("inaccurate");
    expect(a.basis).toBeUndefined();
    expect(decideForItem(item({ isInaccurate: true }), a).action).toBe("hold");
  });

  it("treats an unticked box as UNKNOWN, not as accurate", () => {
    // An unticked checkbox is not a human saying the item is correct.
    const a = inferAssessment(item({ isInaccurate: false }));
    expect(a.accuracy).toBe("unknown");
    expect(a.accuracy).not.toBe("accurate");
  });
});

describe("whole-profile view", () => {
  it("sorts a mixed profile into dispute / coach / hold", () => {
    const items = [
      item({ id: "a", isOutdated: true }),
      item({ id: "b" }),
      item({ id: "c" }),
    ];
    const assessments: Record<string, ItemAssessment> = {
      b: { accuracy: "accurate" },
      c: { accuracy: "inaccurate", basis: "not_mine" },
    };
    const results = decideForProfile(items, assessments);
    const counts = summarise(results);
    expect(counts.dispute).toBe(2); // the obsolete one and the not-mine one
    expect(counts.coach).toBe(1);
    expect(counts.hold).toBe(0);
  });

  it("holds every item when nothing has been assessed", () => {
    const results = decideForProfile([item({ id: "x" }), item({ id: "y" })], {});
    expect(summarise(results).hold).toBe(2);
    expect(summarise(results).dispute).toBe(0);
  });
});

describe("statutory routes recovered from the letter library", () => {
  it("aims failure-to-notate at the furnisher, never the bureau", () => {
    const r = routeFor("dispute_not_notated");
    expect(r?.target).toBe("furnisher");
    expect(r?.citation).toMatch(/1681s-2/);
  });

  it("routes a failure-to-notate letter to the furnisher, not the bureau", () => {
    expect(sequenceFor("dispute_not_notated", "charge_off")[0]).toBe("furnisher_623");
  });

  it("keeps permissible-purpose scoped to inquiries in its own summary", () => {
    expect(routeFor("no_permissible_purpose")?.summary).toMatch(/do not extend/i);
  });

  it("sends an unverifiable item straight to method of verification", () => {
    expect(routeFor("unverifiable")?.citation).toMatch(/1681i\(7\)/);
    expect(sequenceFor("unverifiable", "charge_off")[0]).toBe("method_of_verification");
  });

  it("treats reinsertion as a self-contained violation, not a campaign", () => {
    expect(sequenceFor("reinserted_without_notice", "charge_off")).toEqual([
      "initial_611",
      "cfpb_escalation",
    ]);
  });

  it("flags never_late as valid only when the payment really was on time", () => {
    expect(routeFor("never_late")?.summary).toMatch(/ONLY where the payment genuinely was on time/);
  });

  it("gives obsolete a route that does not depend on accuracy", () => {
    expect(routeFor("obsolete")?.summary).toMatch(/Accuracy is irrelevant/i);
  });

  it("requires an actual report for identity theft, not just a denial", () => {
    expect(routeFor("identity_theft")?.summary).toMatch(/not merely a denial/i);
  });

  it("defines a route for every ground the gate can emit", () => {
    const grounds = [
      "not_mine", "identity_theft", "never_late", "wrong_balance", "wrong_dates",
      "wrong_status", "duplicate", "obsolete", "paid_in_full_reported_unpaid",
      "settled_reported_unsettled", "included_in_bankruptcy", "no_permissible_purpose",
      "reinserted_without_notice", "dispute_not_notated", "unverifiable",
    ] as const;
    for (const g of grounds) expect(routeFor(g), g).toBeDefined();
  });

  it("carries no quarantined theory into the routes", () => {
    const blob = JSON.stringify(STATUTORY_ROUTES).toLowerCase();
    for (const bad of ["perjury", "estoppel", "engelhardt", "1605", "litigious", "1681a(2)(b)"]) {
      expect(blob).not.toContain(bad);
    }
  });
});

describe("FDCPA validation is used where it helps, not reflexively", () => {
  it("leads with validation on a collection disputed on the facts", () => {
    expect(sequenceFor("wrong_balance", "collection")[0]).toBe("fdcpa_validation");
  });

  it("does NOT validate a time-barred collection — that is a bureau matter", () => {
    expect(sequenceFor("obsolete", "collection")).toEqual(["initial_611", "cfpb_escalation"]);
  });

  it("does not validate an identity-theft collection", () => {
    expect(sequenceFor("identity_theft", "collection")).not.toContain("fdcpa_validation");
  });

  it("keeps the round and the citation target consistent for an obsolete collection", () => {
    const seq = sequenceFor("obsolete", "collection");
    expect(routeFor("obsolete")?.target).toBe("bureau");
    expect(seq[0]).toBe("initial_611");
  });
});
