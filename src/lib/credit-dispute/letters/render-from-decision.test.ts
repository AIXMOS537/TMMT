import { describe, it, expect } from "vitest";
import type { CreditProfile, NegativeItem, NegativeItemType } from "../types";
import type { ItemAssessment } from "../policy/dispute-policy";
import {
  assertNoBannedLanguage,
  describePacket,
  renderFromDecision,
  renderPacket,
  BANNED_PHRASES,
} from "./render-from-decision";

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

const profile: CreditProfile = {
  id: "p1",
  fullName: "Jordan Ellis",
  currentAddress: { street: "12 Example Way", city: "Springfield", state: "VA", zip: "22150" },
};

function item(over: Partial<NegativeItem> = {}): NegativeItem {
  return {
    id: "i1",
    bureau: "experian",
    itemType: "charge_off" as NegativeItemType,
    furnisherName: "Example Bank",
    dateOfFirstDelinquency: monthsAgo(12),
    currentRound: 0,
    status: "pending",
    ...over,
  } as NegativeItem;
}

describe("the renderer refuses when the policy says no", () => {
  it("produces guidance, not a letter, for an accurate item", () => {
    const r = renderFromDecision(profile, item(), { accuracy: "accurate" });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") {
      expect(r.clientMessage).toMatch(/accurate/i);
      expect(r.nextStep).toMatch(/behaviour and time/i);
    }
  });

  it("produces no letter when accuracy was never assessed", () => {
    expect(renderFromDecision(profile, item(), { accuracy: "unknown" }).kind).toBe("no_letter");
  });

  it("produces no letter when the item is wrong but nobody said how", () => {
    const r = renderFromDecision(profile, item(), { accuracy: "inaccurate" });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.clientMessage).toMatch(/no specific factual reason|not enough recorded/i);
  });

  it("gives the client a reason they could actually be shown", () => {
    const r = renderFromDecision(profile, item(), { accuracy: "accurate" });
    if (r.kind !== "no_letter") throw new Error("expected no_letter");
    expect(r.clientMessage.length).toBeGreaterThan(30);
    expect(r.clientMessage).not.toMatch(/undefined|null|\[object/);
  });
});

describe("the renderer produces a letter when there is a real ground", () => {
  const assessment: ItemAssessment = { accuracy: "inaccurate", basis: "never_late" };

  it("renders", () => {
    const r = renderFromDecision(profile, item(), assessment);
    expect(r.kind).toBe("letter");
  });

  it("carries the citation and the target", () => {
    const r = renderFromDecision(profile, item(), assessment);
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.citation).toMatch(/1666b/i);
    expect(r.rendered.target).toBe("furnisher");
  });

  it("states the actual ground instead of the generator's hedge", () => {
    const r = renderFromDecision(profile, item(), assessment);
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.letter.body).toMatch(/made on time/i);
  });

  it("includes the supporting note when one was recorded", () => {
    const r = renderFromDecision(profile, item(), {
      ...assessment,
      basisNote: "Bank statements for March and April show cleared payments.",
    });
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.letter.body).toMatch(/bank statements for march/i);
  });

  it("numbers the round from what has already been sent", () => {
    const r = renderFromDecision(profile, item(), {
      accuracy: "inaccurate",
      basis: "wrong_balance",
      roundsSent: ["initial_611"],
    });
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.roundNumber).toBe(2);
    expect(r.rendered.roundType).not.toBe("initial_611");
  });

  it("reports what is still to come", () => {
    const r = renderFromDecision(profile, item(), { accuracy: "inaccurate", basis: "wrong_balance" });
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.remainingSequence.length).toBeGreaterThan(0);
    expect(r.rendered.remainingSequence).not.toContain(r.rendered.roundType);
  });

  it("sends an obsolete item on one letter, not a campaign", () => {
    const r = renderFromDecision(
      profile,
      item({ dateOfFirstDelinquency: monthsAgo(100) }),
      { accuracy: "accurate" }
    );
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.basis).toBe("obsolete");
    expect(r.rendered.remainingSequence).toEqual(["cfpb_escalation"]);
  });
});

describe("the safety net", () => {
  it("throws on quarantined language", () => {
    expect(() =>
      assertNoBannedLanguage({
        subject: "Dispute",
        body: "Under penalty of perjury, I swear this account is false and misleading.",
        recipient: "Experian",
        recipientAddress: { street: "x", city: "y", state: "z", zip: "1" },
        roundType: "initial_611",
        bureau: "experian",
        roundNumber: 1,
        responseDueDays: 30,
      })
    ).toThrow(/quarantined language/i);
  });

  it("names the reason so the failure is actionable", () => {
    expect(() =>
      assertNoBannedLanguage({
        subject: "x",
        body: "estoppel by silence Engelhardt v. Gravens",
        recipient: "Experian",
        recipientAddress: { street: "x", city: "y", state: "z", zip: "1" },
        roundType: "initial_611",
        bureau: "experian",
        roundNumber: 1,
        responseDueDays: 30,
      })
    ).toThrow(/not an FCRA or FDCPA authority/i);
  });

  it("passes a clean letter through", () => {
    const r = renderFromDecision(profile, item(), { accuracy: "inaccurate", basis: "not_mine" });
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(() => assertNoBannedLanguage(r.rendered.letter)).not.toThrow();
  });

  it("keeps every real rendered letter clean of all banned phrases", () => {
    const grounds = [
      "not_mine", "never_late", "wrong_balance", "wrong_dates", "wrong_status",
      "duplicate", "paid_in_full_reported_unpaid", "no_permissible_purpose", "unverifiable",
    ] as const;
    for (const basis of grounds) {
      for (const t of ["collection", "charge_off", "late_payment", "hard_inquiry"] as NegativeItemType[]) {
        const r = renderFromDecision(profile, item({ itemType: t }), { accuracy: "inaccurate", basis });
        if (r.kind !== "letter") continue;
        const hay = r.rendered.letter.body;
        for (const { pattern } of BANNED_PHRASES) {
          expect(pattern.test(hay), `${basis}/${t} matched ${pattern.source}`).toBe(false);
        }
      }
    }
  });
});

describe("the desk packet", () => {
  it("splits a profile into letters and reasons not to write one", () => {
    const items = [
      item({ id: "a" }),
      item({ id: "b" }),
      item({ id: "c", dateOfFirstDelinquency: monthsAgo(100) }),
    ];
    const assessments: Record<string, ItemAssessment> = {
      a: { accuracy: "inaccurate", basis: "not_mine" },
      b: { accuracy: "accurate" },
    };
    const packet = renderPacket(profile, items, assessments);
    expect(packet.counts.letters).toBe(2); // not_mine + the obsolete one
    expect(packet.counts.coach).toBe(1);
    expect(packet.notDisputed).toHaveLength(1);
    expect(packet.notDisputed[0].reason).toMatch(/accurate/i);
  });

  it("writes nothing at all when nothing has been assessed", () => {
    const packet = renderPacket(profile, [item({ id: "x" }), item({ id: "y" })], {});
    expect(packet.counts.letters).toBe(0);
    expect(packet.counts.hold).toBe(2);
  });

  it("summarises for the desk header", () => {
    const packet = renderPacket(
      profile,
      [item({ id: "a" }), item({ id: "b" })],
      { a: { accuracy: "inaccurate", basis: "duplicate" }, b: { accuracy: "accurate" } }
    );
    expect(describePacket(packet)).toMatch(/1 letter/);
    expect(describePacket(packet)).toMatch(/1 to coach/);
  });
});
