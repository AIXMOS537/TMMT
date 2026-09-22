import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { NegativeItem, NegativeItemType } from "../types";
import type { StoredClient, StoredDisputeRound } from "../data/store";
import type { CustomerAssertion } from "../policy/assertion";
import { decideForItem } from "../policy/dispute-policy";
import {
  activeAssertion,
  addAssertion,
  addEvidence,
  appendRounds,
  authorizeFollowUp,
  caseQueueRow,
  contextFor,
  creditCrmStatus,
  itemHistory,
  markSent,
  recordResponse,
  resolveForPlanning,
  reviewRound,
} from "./case-state";

// The fixtures use fixed September 2026 dates; pin the clock after them so the
// "not in the future" checks are deterministic whatever day the suite runs.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());

/**
 * C1 case-state rules, without a database.
 *   - rounds are appended; round N+1 never changes round N
 *   - round numbers come from the stored history
 *   - only needs_review rounds can be reviewed; a response needs a sent round
 *   - no automatic escalation: a follow-up needs a recorded response + reason
 *   - the queue and the CRM status carry counts / a label, never PII
 */

const NOW = "2026-09-22T12:00:00.000Z";

function item(over: Partial<NegativeItem> = {}): NegativeItem {
  return {
    id: "i1",
    bureau: "experian",
    itemType: "charge_off" as NegativeItemType,
    furnisherName: "Example Bank",
    dateOfFirstDelinquency: "2025-09-01",
    currentRound: 0,
    status: "pending",
    ...over,
  } as NegativeItem;
}

function round(over: Partial<StoredDisputeRound> = {}): StoredDisputeRound {
  return {
    id: "r1",
    negativeItemId: "i1",
    roundNumber: 1,
    roundType: "initial_611",
    bureau: "experian",
    status: "needs_review",
    letterSubject: "FCRA Dispute",
    letterBody: "Body of round one.",
    furnisherName: "Example Bank",
    createdAt: NOW,
    ...over,
  };
}

function client(over: Partial<StoredClient> = {}): StoredClient {
  return {
    profile: {
      id: "p1",
      fullName: "Jordan Ellis",
      ssnLast4: "1234",
      dateOfBirth: "1990-01-01",
      currentAddress: { street: "12 Example Way", city: "Springfield", state: "VA", zip: "22150" },
    },
    source: "myfreescorenow",
    negativeItems: [item()],
    disputeRounds: [],
    importedAt: NOW,
    ...over,
  };
}

const assertion = (over: Partial<CustomerAssertion> = {}): CustomerAssertion => ({
  id: "a1",
  negativeItemId: "i1",
  basis: "wrong_balance",
  statement: "The balance is $400 more than I owe.",
  source: "customer",
  customerConfirmed: true,
  evidenceIds: [],
  recordedBy: "owner@example.test",
  recordedAt: NOW,
  status: "active",
  ...over,
});

describe("round history and numbering", () => {
  it("reads pre-C1 'draft' rounds as awaiting review and ignores cancelled/returned ones", () => {
    const c = client({
      disputeRounds: [
        round({ id: "a", status: "draft" }),
        round({ id: "b", roundNumber: 2, status: "cancelled" }),
        round({ id: "c", roundNumber: 2, status: "returned_for_information" }),
      ],
    });
    const h = itemHistory(c, "i1");
    expect(h.map((x) => x.roundId)).toEqual(["a"]);
    expect(h[0].status).toBe("needs_review");
  });

  it("derives roundsSent from the stored rounds, not from a tampered assessment", () => {
    const c = client({
      assessments: { i1: { accuracy: "inaccurate", basis: "wrong_balance", roundsSent: ["initial_611", "furnisher_623", "method_of_verification", "cfpb_escalation"] } },
      disputeRounds: [],
    });
    const { assessments } = resolveForPlanning(c);
    expect(assessments.i1.roundsSent).toEqual([]);
  });
});

describe("appending rounds never overwrites earlier ones", () => {
  const sent = round({ status: "sent" });

  it("appends round 2 and leaves round 1 exactly as it was", () => {
    const before = client({ disputeRounds: [sent] });
    const snapshot = structuredClone(before.disputeRounds[0]);
    const after = appendRounds(before, [round({ id: "r2", roundNumber: 2, roundType: "method_of_verification" })]);
    expect(after.disputeRounds).toHaveLength(2);
    expect(after.disputeRounds[0]).toEqual(snapshot);
    expect(after.disputeRounds[0]).toBe(before.disputeRounds[0]);
    expect(before.disputeRounds).toHaveLength(1);
  });

  it("refuses a round whose number does not follow the item's history", () => {
    expect(() => appendRounds(client({ disputeRounds: [sent] }), [round({ id: "r9", roundNumber: 1 })])).toThrow(/does not follow/);
    expect(() => appendRounds(client(), [round({ id: "r9", roundNumber: 3 })])).toThrow(/does not follow/);
  });

  it("refuses an id collision instead of replacing a round", () => {
    expect(() => appendRounds(client({ disputeRounds: [sent] }), [round({ id: "r1", roundNumber: 2 })])).toThrow(/never overwritten/);
  });

  it("refuses a new round that is not awaiting review", () => {
    expect(() => appendRounds(client(), [round({ status: "approved" })])).toThrow(/needs_review/);
  });
});

describe("the review gate", () => {
  it("approves a round awaiting review and records who did it", () => {
    const c = reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "approve" }, "owner@example.test", NOW);
    expect(c.disputeRounds[0].status).toBe("approved");
    expect(c.disputeRounds[0].review).toMatchObject({ decision: "approved", reviewedBy: "owner@example.test" });
    expect(c.auditLog?.at(-1)).toMatchObject({ action: "round_approved", roundId: "r1" });
  });

  it("will not approve, edit or cancel a round that is not awaiting review", () => {
    const approved = client({ disputeRounds: [round({ status: "approved" })] });
    expect(() => reviewRound(approved, "r1", { kind: "approve" }, "x")).toThrow(/awaiting review/);
    expect(() => reviewRound(approved, "r1", { kind: "edit", body: "new" }, "x")).toThrow(/awaiting review/);
    expect(() => reviewRound(approved, "r1", { kind: "cancel" }, "x")).toThrow(/awaiting review/);
  });

  it("records an edit as before/after hashes and keeps other rounds untouched", () => {
    const other = round({ id: "r0", negativeItemId: "i2" });
    const c = reviewRound(client({ disputeRounds: [other, round()] }), "r1", { kind: "edit", body: "Edited body." }, "owner", NOW);
    expect(c.disputeRounds[1].letterBody).toBe("Edited body.");
    expect(c.disputeRounds[1].edits?.[0]).toMatchObject({ editedBy: "owner" });
    expect(c.disputeRounds[1].edits?.[0].beforeHash).not.toBe(c.disputeRounds[1].edits?.[0].afterHash);
    expect(c.disputeRounds[0]).toBe(other);
    expect(c.disputeRounds[1].status).toBe("needs_review");
  });

  it("screens an edit with the same banned-language check as a generated letter", () => {
    expect(() =>
      reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "edit", body: "Under penalty of perjury this is false." }, "owner")
    ).toThrow(/quarantined language/);
  });

  it("requires a note when returning a letter for information", () => {
    expect(() => reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "return_for_information", note: " " }, "o")).toThrow(/what information/);
    const c = reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "return_for_information", note: "Need the bank statement." }, "o");
    expect(c.disputeRounds[0].status).toBe("returned_for_information");
  });
});

describe("sent, response and follow-up — no automatic escalation", () => {
  // C2: sent requires a real approval (with its content hash) and a sent record.
  const SENT = { sentAt: "2026-09-22T10:00:00.000Z", method: "mail" as const, recipient: "Experian" };
  const approved = () => reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "approve" }, "owner", NOW);
  const withSent = () => markSent(approved(), "r1", SENT, "owner", NOW);

  it("marks only an approved round as sent", () => {
    expect(() => markSent(client({ disputeRounds: [round()] }), "r1", SENT, "o")).toThrow(/approved/);
    expect(withSent().disputeRounds[0].status).toBe("sent");
  });

  it("records a response only against a sent round, with a summary", () => {
    expect(() => recordResponse(client({ disputeRounds: [round()] }), "r1", { outcome: "verified", summary: "x", receivedAt: NOW }, "o")).toThrow(/sent/);
    expect(() => recordResponse(withSent(), "r1", { outcome: "verified", summary: "", receivedAt: NOW }, "o")).toThrow(/Summarise/);
    const c = recordResponse(withSent(), "r1", { outcome: "verified", summary: "Bureau says verified.", receivedAt: NOW }, "o", NOW);
    expect(c.disputeRounds[0].status).toBe("response_received");
    expect(c.disputeRounds[0].response).toMatchObject({ outcome: "verified", recordedBy: "o" });
  });

  const decide = (c: StoredClient) =>
    decideForItem(item(), { accuracy: "inaccurate", basis: "wrong_balance" }, undefined, { ...contextFor(c, "i1"), assertion: assertion() });

  it("writes nothing new while a round is in flight", () => {
    for (const status of ["needs_review", "approved", "sent"]) {
      const d = decide(client({ disputeRounds: [round({ status })] }));
      expect(d.action).toBe("hold");
      expect(d.ruleId).toBe("round-in-progress");
    }
  });

  it("does not escalate on a 'verified' response without a documented reason", () => {
    const c = recordResponse(withSent(), "r1", { outcome: "verified", summary: "Verified.", receivedAt: NOW }, "o");
    const d = decide(c);
    expect(d.action).toBe("needs_information");
    expect(d.missing?.map((m) => m.code)).toEqual(["follow_up_reason"]);
  });

  it("allows the next round once the reason is recorded, numbered 2", () => {
    const responded = recordResponse(withSent(), "r1", { outcome: "verified", summary: "Verified.", receivedAt: NOW }, "o");
    const c = authorizeFollowUp(responded, "r1", "Response ignored the $400 difference the customer documented.", "o");
    const d = decide(c);
    expect(d.action).toBe("dispute");
    expect(d.sequence).not.toContain("initial_611");
  });

  it("stops when the response says the item was deleted or corrected", () => {
    const c = recordResponse(withSent(), "r1", { outcome: "deleted", summary: "Deleted.", receivedAt: NOW }, "o");
    const d = decide(c);
    expect(d.action).toBe("hold");
    expect(d.ruleId).toBe("resolved-by-response");
  });
});

describe("assertions and evidence", () => {
  it("a new assertion supersedes the old one, which is kept as withdrawn", () => {
    const c1 = addAssertion(client(), assertion({ id: "a1" }));
    const c2 = addAssertion(c1, assertion({ id: "a2", basis: "wrong_dates", statement: "The dates are wrong." }));
    expect(activeAssertion(c2, "i1")?.id).toBe("a2");
    expect(c2.assertions?.find((a) => a.id === "a1")?.status).toBe("withdrawn");
  });

  it("refuses an assertion or evidence for an item that is not on the report", () => {
    expect(() => addAssertion(client(), assertion({ negativeItemId: "nope" }))).toThrow(/Unknown item/);
    expect(() => addEvidence(client(), { id: "e1", kind: "other", description: "x", negativeItemId: "nope", source: "operator", uploadedBy: "o", uploadedAt: NOW })).toThrow(/Unknown item/);
  });

  it("never stores a public URL as an evidence location", () => {
    expect(() =>
      addEvidence(client(), { id: "e1", kind: "other", description: "doc", storagePath: "https://example.com/public.pdf", source: "operator", uploadedBy: "o", uploadedAt: NOW })
    ).toThrow(/private storage path/);
  });
});

describe("the operator queue and the CRM boundary carry no sensitive data", () => {
  const busy = () =>
    addAssertion(client({ disputeRounds: [round(), round({ id: "r2", negativeItemId: "i2", status: "approved" })] }), assertion());

  it("counts rounds by state", () => {
    const row = caseQueueRow(busy(), 3);
    expect(row).toMatchObject({ clientId: "p1", itemsNeedingInformation: 3, roundsAwaitingReview: 1, roundsApproved: 1 });
  });

  it("the queue row holds only ids and counts — no name, SSN, DOB, address or letter text", () => {
    const json = JSON.stringify(caseQueueRow(busy(), 1));
    for (const secret of ["Jordan", "1234", "1990", "Example Way", "Body of round", "$400"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("maps to one of the six allowed CRM statuses and nothing else", () => {
    const allowed = ["Credit Intake Started", "Documents Needed", "Review Required", "Customer Action Required", "Case In Progress", "Process Completed"];
    const c = busy();
    const status = creditCrmStatus(c, caseQueueRow(c, 0));
    expect(allowed).toContain(status);
    expect(status).toBe("Review Required");
    expect(creditCrmStatus(client(), caseQueueRow(client(), 0))).toBe("Credit Intake Started");
  });
});
