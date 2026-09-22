import { describe, expect, it, vi } from "vitest";

/**
 * C1-004 — every fact a letter states must trace to a source; missing facts are
 * NEEDS_INFORMATION, never prose.
 *
 * These tests have to READ rendered letters, so the CROA gate is stubbed OPEN in
 * this file only (a test double; the real gate config is untouched and still
 * closed — gate-coverage.test.ts and generator.gate.test.ts prove that). Nothing
 * here can reach production: the stub lives in this module graph alone.
 */
vi.mock("../../../../shared/compliance-gates/gate", async (orig) => {
  const real = await orig<typeof import("../../../../shared/compliance-gates/gate")>();
  return { ...real, requireGate: () => undefined, isGateOpen: () => true };
});

import type { CreditProfile, NegativeItem, NegativeItemType } from "../types";
import type { CustomerAssertion, DecisionContext, EvidenceRef, ItemRoundHistory } from "../policy/assertion";
import type { FactualBasis, ItemAssessment } from "../policy/dispute-policy";
import { renderFromDecision } from "./render-from-decision";
import { generateLetter, LetterFactsMissingError } from "./generator";

const NOW = "2026-09-22T00:00:00.000Z";

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
    accountNumberMasked: "****1111",
    reportedBalanceCents: 120000,
    dateOfFirstDelinquency: "2025-06-01",
    dateReported: "2026-08-01",
    currentRound: 0,
    status: "pending",
    ...over,
  } as NegativeItem;
}

function assertion(basis: FactualBasis, over: Partial<CustomerAssertion> = {}): CustomerAssertion {
  return {
    id: "a1",
    negativeItemId: "i1",
    basis,
    statement: "Customer words: I paid this off in March and have the receipt.",
    source: "customer",
    customerConfirmed: true,
    evidenceIds: [],
    recordedBy: "owner@example.test",
    recordedAt: NOW,
    status: "active",
    ...over,
  };
}

const inaccurate = (basis: FactualBasis): ItemAssessment => ({ accuracy: "inaccurate", basis });

function render(i: NegativeItem, basis: FactualBasis, ctx: DecisionContext) {
  return renderFromDecision(profile, i, inaccurate(basis), { context: ctx });
}

const FABRICATIONS = [
  /I did not authori[sz]e/i,
  /CFPB complaint filed/i,
  /I received a response indicating the item was verified/i,
  /in response to a notice I received/i,
  /does not match my records/i,
  /SENT VIA CERTIFIED MAIL/i,
  /^CC:/im,
  /Copy of government-issued ID/i,
  /multiple times without resolution/i,
];

describe("hard inquiries: negative is not the same as disputed", () => {
  it("writes nothing for a hard inquiry the customer has said nothing about", () => {
    const r = renderFromDecision(profile, item({ itemType: "hard_inquiry" }), { accuracy: "unknown" });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.decision.action).toBe("needs_information");
  });

  it("writes nothing when an operator picked 'no permissible purpose' but the customer never said so", () => {
    const r = render(item({ itemType: "hard_inquiry" }), "no_permissible_purpose", {});
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("customer_assertion");
  });

  it("writes the authorisation sentence only when the customer confirmed that exact claim", () => {
    const r = render(item({ itemType: "hard_inquiry" }), "no_permissible_purpose", {
      assertion: assertion("no_permissible_purpose", { statement: "I never applied for credit with Example Bank." }),
    });
    expect(r.kind).toBe("letter");
    if (r.kind !== "letter") return;
    expect(r.rendered.letter.body).toMatch(/I did not authorise this inquiry/);
    expect(r.rendered.letter.body).toMatch(/I never applied for credit with Example Bank/);
    const stmt = r.rendered.trace.find((t) => t.source === "basis_statement");
    expect(stmt?.ref).toBe("assertion:a1");
  });
});

describe("who said it matters", () => {
  it("refuses an operator's own reading as the customer's first-person claim", () => {
    const r = render(item(), "wrong_balance", { assertion: assertion("wrong_balance", { source: "operator", customerConfirmed: false }) });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("customer_confirmation");
  });

  it("refuses a customer statement the customer has not confirmed", () => {
    const r = render(item(), "wrong_balance", { assertion: assertion("wrong_balance", { customerConfirmed: false }) });
    expect(r.kind).toBe("no_letter");
  });

  it("refuses when the customer's stated problem and the accuracy call disagree", () => {
    const r = render(item(), "wrong_balance", { assertion: assertion("not_mine") });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("assertion_basis_mismatch");
  });

  it("refuses a withdrawn assertion", () => {
    const r = render(item(), "wrong_balance", { assertion: assertion("wrong_balance", { status: "withdrawn" }) });
    expect(r.kind).toBe("no_letter");
  });

  it("a decision handed in from outside cannot override the policy", () => {
    const r = renderFromDecision(profile, item(), inaccurate("wrong_balance"), {
      decision: { action: "dispute", basis: "wrong_balance", sequence: ["initial_611"], rationale: "trust me", ruleId: "forged" },
    });
    expect(r.kind).toBe("no_letter");
  });
});

describe("grounds that need a document or our own history", () => {
  const report: EvidenceRef = {
    id: "e1",
    kind: "identity_theft_report",
    description: "FTC identity theft report dated 2026-08-02",
    negativeItemId: "i1",
    assertionId: "a1",
    source: "customer",
    uploadedBy: "owner",
    uploadedAt: NOW,
  };

  it("will not say 'an identity theft report has been filed' without one on file", () => {
    const r = render(item(), "identity_theft", { assertion: assertion("identity_theft") });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("identity_theft_report");
  });

  it("with the report on file, encloses exactly that document and traces it", () => {
    const r = render(item(), "identity_theft", { assertion: assertion("identity_theft", { evidenceIds: ["e1"] }), evidence: [report] });
    expect(r.kind).toBe("letter");
    if (r.kind !== "letter") return;
    expect(r.rendered.letter.body).toMatch(/Enclosures: FTC identity theft report dated 2026-08-02/);
    expect(r.rendered.evidenceIds).toEqual(["e1"]);
    expect(r.rendered.trace.some((t) => t.source === "evidence" && t.ref === "evidence:e1")).toBe(true);
  });

  it("will not claim a prior 'verified' response that is not recorded", () => {
    const r = render(item(), "unverifiable", { assertion: assertion("unverifiable") });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("prior_verified_response");
  });

  it("with a recorded verified response and a documented reason, writes round 2 quoting that response", () => {
    const history: ItemRoundHistory[] = [
      {
        roundId: "r1",
        roundType: "initial_611",
        roundNumber: 1,
        status: "response_received",
        response: { outcome: "verified", summary: "Bureau letter says information verified", receivedAt: "2026-07-01", recordedBy: "o", recordedAt: NOW, followUpReason: "No method of verification was given." },
      },
    ];
    const r = render(item(), "unverifiable", { assertion: assertion("unverifiable"), history });
    expect(r.kind).toBe("letter");
    if (r.kind !== "letter") return;
    expect(r.rendered.roundNumber).toBe(2);
    expect(r.rendered.roundType).toBe("method_of_verification");
    expect(r.rendered.letter.body).toMatch(/verified — Bureau letter says information verified/);
    expect(r.rendered.letter.body).toMatch(/Prior Dispute Reference: Round 1/);
  });

  it("will not claim 'I disputed this account' without a recorded, sent earlier round", () => {
    const r = render(item(), "dispute_not_notated", { assertion: assertion("dispute_not_notated") });
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("prior_dispute_record");
  });
});

describe("the templates invent nothing", () => {
  const grounds: FactualBasis[] = ["not_mine", "never_late", "wrong_balance", "wrong_dates", "wrong_status", "duplicate", "paid_in_full_reported_unpaid", "settled_reported_unsettled", "included_in_bankruptcy", "no_permissible_purpose"];
  const types: NegativeItemType[] = ["collection", "charge_off", "late_payment", "hard_inquiry"];

  it("no rendered first-round letter contains a known fabrication, for any ground × item type", () => {
    let rendered = 0;
    for (const basis of grounds) {
      for (const t of types) {
        const r = render(item({ itemType: t }), basis, { assertion: assertion(basis) });
        if (r.kind !== "letter") continue;
        rendered += 1;
        for (const f of FABRICATIONS) {
          // The one legitimate authorisation sentence is the confirmed no_permissible_purpose claim.
          if (basis === "no_permissible_purpose" && f.source.startsWith("I did not")) continue;
          expect(f.test(r.rendered.letter.body), `${basis}/${t} matched ${f.source}`).toBe(false);
        }
      }
    }
    expect(rendered).toBeGreaterThan(20);
  });

  it("claims no enclosure when no document is on file", () => {
    const r = render(item(), "wrong_balance", { assertion: assertion("wrong_balance") });
    if (r.kind !== "letter") throw new Error("expected letter");
    expect(r.rendered.letter.body).not.toMatch(/Enclosures:/);
  });

  it("every customer-voice sentence in the letter has a traced source", () => {
    const r = render(item(), "wrong_balance", { assertion: assertion("wrong_balance") });
    if (r.kind !== "letter") throw new Error("expected letter");
    for (const t of r.rendered.trace) {
      expect(t.ref).toMatch(/^(assertion|evidence|round|dateOfFirstDelinquency|dateReported)/);
      if (t.source === "customer_assertion" || t.source === "basis_statement") {
        expect(r.rendered.letter.body).toContain(t.text);
      }
    }
    expect(r.rendered.templateVersion).toMatch(/^c1-/);
  });

  it("an obsolete item is stated from the report's own dates, with no assertion needed", () => {
    const r = renderFromDecision(profile, item({ dateOfFirstDelinquency: "2017-01-01" }), { accuracy: "accurate" });
    expect(r.kind).toBe("letter");
    if (r.kind !== "letter") return;
    expect(r.rendered.basis).toBe("obsolete");
    expect(r.rendered.trace[0]).toMatchObject({ source: "report_field", ref: "dateOfFirstDelinquency" });
  });

  it("does not call an item obsolete from its last-reported date", () => {
    const r = renderFromDecision(profile, item({ dateOfFirstDelinquency: undefined, dateReported: "2015-01-01" }), { accuracy: "unknown" });
    expect(r.kind).toBe("no_letter");
  });
});

describe("the generator refuses instead of filling gaps", () => {
  const p = profile;
  const it1 = item();
  const cases: Array<[string, () => unknown]> = [
    ["initial 611 with no stated problem", () => generateLetter("initial_611", p, it1, 1)],
    ["furnisher 623 with no stated problem", () => generateLetter("furnisher_623", p, it1, 1)],
    ["method of verification with no recorded response", () => generateLetter("method_of_verification", p, it1, 2)],
    ["method of verification in round 1", () => generateLetter("method_of_verification", p, it1, 1, { priorResponseSummary: "verified" })],
    ["factual confrontation with no facts", () => generateLetter("factual_confrontation", p, it1, 1, { facts: ["  "] })],
    ["CFPB escalation with no recorded history", () => generateLetter("cfpb_escalation", p, it1, 3)],
    ["intent to litigate with no recorded history", () => generateLetter("intent_to_litigate", p, it1, 5)],
  ];
  it.each(cases)("%s -> LetterFactsMissingError", (_label, run) => {
    expect(run).toThrow(LetterFactsMissingError);
  });

  it("the FDCPA letter describes the reported debt instead of inventing a notice", () => {
    const l = generateLetter("fdcpa_validation", p, item({ itemType: "collection" }), 1);
    expect(l.body).not.toMatch(/notice I received/i);
    expect(l.body).toMatch(/reporting on my consumer credit file/);
  });

  it("the CFPB letter lists only the history it was given", () => {
    const l = generateLetter("cfpb_escalation", p, it1, 3, { priorAttempts: ["Round 1: initial 611 — response received 2026-07-01: verified"] });
    expect(l.body).toMatch(/Round 1: initial 611/);
    expect(l.body).not.toMatch(/CFPB complaint filed|multiple times without resolution|Failed to delete unverifiable/i);
  });
});
