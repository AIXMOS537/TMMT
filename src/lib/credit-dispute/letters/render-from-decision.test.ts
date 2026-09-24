import { describe, it, expect } from "vitest";
import type { CreditProfile, NegativeItem, NegativeItemType } from "../types";
import type { FactualBasis, ItemAssessment } from "../policy/dispute-policy";
import type { DecisionContext } from "../policy/assertion";
import {
  assertNoBannedLanguage,
  describePacket,
  renderFromDecision,
  renderPacket,
  BANNED_PHRASES,
} from "./render-from-decision";
import {
  ComplianceGateError,
  isGateOpen,
} from "../../../../shared/compliance-gates/gate";

/**
 * Rendering a letter runs generateLetter(), which is behind the CROA gate
 * (15 U.S.C. 1679a). While that gate is closed these blocks CANNOT run --
 * not because they are broken, but because producing an addressed dispute
 * letter is the regulated act itself. See generator.gate.test.ts.
 *
 * They are skipped, never deleted, and never made to pass by relaxing the
 * gate. `refusesWhileGateClosed` below watches the refusal so a skip can
 * never be mistaken for a pass -- exactly one of these two runs, always.
 */
const CROA_OPEN = isGateOpen("croa_contracts_attorney_approved");
const whenGateOpen = describe.skipIf(!CROA_OPEN);

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

/** C1: letters need the customer's confirmed statement for the ground. */
function confirmed(basis: FactualBasis, negativeItemId = "i1"): DecisionContext {
  return {
    assertion: {
      id: `a-${negativeItemId}`,
      negativeItemId,
      basis,
      statement: "In my own words: this is what is wrong with the account.",
      source: "customer",
      customerConfirmed: true,
      evidenceIds: [],
      recordedBy: "owner@example.test",
      recordedAt: "2026-09-22T00:00:00.000Z",
      status: "active",
    },
  };
}
const ctx = (basis: FactualBasis) => ({ context: confirmed(basis) });

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

whenGateOpen("the renderer produces a letter when there is a real ground (CROA gate open)", () => {
  const assessment: ItemAssessment = { accuracy: "inaccurate", basis: "never_late" };

  it("renders", () => {
    const r = renderFromDecision(profile, item(), assessment, ctx("never_late"));
    expect(r.kind).toBe("letter");
  });

  it("carries the citation and the target", () => {
    const r = renderFromDecision(profile, item(), assessment, ctx("never_late"));
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.citation).toMatch(/1666b/i);
    expect(r.rendered.target).toBe("furnisher");
  });

  it("states the actual ground instead of the generator's hedge", () => {
    const r = renderFromDecision(profile, item(), assessment, ctx("never_late"));
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.letter.body).toMatch(/made on time/i);
  });

  // C1: the operator's basisNote is an internal note, not the customer's claim.
  // The customer's own words go in instead, with a trace entry.
  it("states the customer's own words and keeps the operator's note out of the letter", () => {
    const r = renderFromDecision(profile, item(), {
      ...assessment,
      basisNote: "Operator note: bank statements for March and April show cleared payments.",
    }, ctx("never_late"));
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.letter.body).toMatch(/in my own words/i);
    expect(r.rendered.letter.body).not.toMatch(/operator note/i);
    expect(r.rendered.trace.some((t) => t.source === "customer_assertion")).toBe(true);
  });

  it("numbers the round from what has already been sent", () => {
    const r = renderFromDecision(profile, item(), {
      accuracy: "inaccurate",
      basis: "wrong_balance",
      roundsSent: ["initial_611"],
    }, ctx("wrong_balance"));
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.roundNumber).toBe(2);
    expect(r.rendered.roundType).not.toBe("initial_611");
  });

  it("reports what is still to come", () => {
    const r = renderFromDecision(profile, item(), { accuracy: "inaccurate", basis: "wrong_balance" }, ctx("wrong_balance"));
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

whenGateOpen("the safety net (CROA gate open)", () => {
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
    const r = renderFromDecision(profile, item(), { accuracy: "inaccurate", basis: "not_mine" }, ctx("not_mine"));
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
        const r = renderFromDecision(profile, item({ itemType: t }), { accuracy: "inaccurate", basis }, ctx(basis));
        if (r.kind !== "letter") continue;
        const hay = r.rendered.letter.body;
        for (const { pattern } of BANNED_PHRASES) {
          expect(pattern.test(hay), `${basis}/${t} matched ${pattern.source}`).toBe(false);
        }
      }
    }
  });
});

whenGateOpen("the desk packet (CROA gate open)", () => {
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
    const packet = renderPacket(profile, items, assessments, undefined, { a: confirmed("not_mine", "a") });
    expect(packet.counts.letters).toBe(2); // not_mine + the obsolete one
    expect(packet.counts.coach).toBe(1);
    expect(packet.notDisputed).toHaveLength(1);
    expect(packet.notDisputed[0].reason).toMatch(/accurate/i);
  });

  it("writes nothing at all when nothing has been assessed", () => {
    const packet = renderPacket(profile, [item({ id: "x" }), item({ id: "y" })], {});
    expect(packet.counts.letters).toBe(0);
    expect(packet.counts.needs_information).toBe(2);
  });

  it("summarises for the desk header", () => {
    const packet = renderPacket(
      profile,
      [item({ id: "a" }), item({ id: "b" })],
      { a: { accuracy: "inaccurate", basis: "duplicate" }, b: { accuracy: "accurate" } },
      undefined,
      { a: confirmed("duplicate", "a") }
    );
    expect(describePacket(packet)).toMatch(/1 letter/);
    expect(describePacket(packet)).toMatch(/1 to coach/);
  });
});

describe.skipIf(CROA_OPEN)("while the CROA gate is closed", () => {
  // A ground that WOULD produce a letter if the act were permitted -- the same
  // shape the skipped blocks above use, so this proves the gate stops it and
  // not a malformed input.
  const realGround: ItemAssessment = { accuracy: "inaccurate", basis: "wrong_balance" };

  // C1: the ground must be fully grounded (customer's confirmed statement) for the
  // policy to clear it, so that it is the GATE, not a missing fact, that refuses.
  it("refuses to render a letter instead of quietly producing one", () => {
    expect(() => renderFromDecision(profile, item(), realGround, ctx("wrong_balance"))).toThrow(ComplianceGateError);
  });

  it("refuses the whole desk packet, not just one letter", () => {
    expect(() =>
      renderPacket(profile, [item({ id: "a" })], { a: realGround }, undefined, { a: confirmed("wrong_balance", "a") })
    ).toThrow(ComplianceGateError);
  });
});
