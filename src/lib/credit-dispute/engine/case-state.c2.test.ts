import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { NegativeItem, NegativeItemType } from "../types";
import type { StoredClient, StoredDisputeRound } from "../data/store";
import { decideForItem } from "../policy/dispute-policy";
import {
  addEvidence,
  authorizeFollowUp,
  caseQueueRow,
  caseTimeline,
  classifyAssertion,
  closeCase,
  confirmCustomerAssertion,
  contextFor,
  customerCaseView,
  draftCustomerAssertion,
  markSent,
  recordResponse,
  reviewRound,
  sanitizeImportedRounds,
  sha256,
} from "./case-state";

// The fixtures use fixed September 2026 dates; pin the clock after them so the
// "not in the future" checks are deterministic whatever day the suite runs.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());

/**
 * C2 lifecycle, without a database:
 *   customer draft -> confirm (fixed) -> operator classify -> evidence -> review
 *   (approval bound to the exact text) -> sent record -> response -> justified follow-up
 * plus the C1-blocker fix for rounds rescued from a browser.
 */

const T0 = "2026-09-22T09:00:00.000Z";
const T1 = "2026-09-22T10:00:00.000Z";
const T2 = "2026-09-23T10:00:00.000Z";

const item = (over: Partial<NegativeItem> = {}): NegativeItem =>
  ({ id: "i1", bureau: "experian", itemType: "charge_off" as NegativeItemType, furnisherName: "Example Bank", accountNumberMasked: "****1111", dateOfFirstDelinquency: "2025-06-01", currentRound: 0, status: "draft", ...over }) as NegativeItem;

const round = (over: Partial<StoredDisputeRound> = {}): StoredDisputeRound => ({
  id: "r1", negativeItemId: "i1", roundNumber: 1, roundType: "initial_611", bureau: "experian", status: "needs_review",
  letterSubject: "FCRA Dispute", letterBody: "Body of round one.", furnisherName: "Example Bank", createdAt: T0, ...over,
});

const client = (over: Partial<StoredClient> = {}): StoredClient => ({
  profile: { id: "p1", fullName: "Jordan Ellis", ssnLast4: "1234", dateOfBirth: "1990-01-01", currentAddress: { street: "12 Example Way", city: "Springfield", state: "VA", zip: "22150" } },
  source: "myfreescorenow", negativeItems: [item(), item({ id: "i2", furnisherName: "Other Lender" })], disputeRounds: [], importedAt: T0, customerUserId: "11111111-1111-4111-8111-111111111111",
  ...over,
});

const CUST = "customer:11111111-1111-4111-8111-111111111111";
const WORDS = "I paid this account in full in March 2025 and have the bank statement.";

function drafted(category: "BALANCE_INCORRECT" | "OTHER" | "NOT_MINE" = "BALANCE_INCORRECT") {
  return draftCustomerAssertion(client(), { id: "a1", negativeItemId: "i1", category, statement: WORDS }, CUST, T0);
}

describe("customer assertion: draft, confirm, preserve", () => {
  it("records the customer's own category and words as a DRAFT that unlocks nothing", () => {
    const c = drafted();
    const a = c.assertions![0];
    expect(a).toMatchObject({ status: "draft", source: "customer", customerConfirmed: false, category: "BALANCE_INCORRECT", statement: WORDS, originalStatement: WORDS });
    const d = decideForItem(item(), { accuracy: "inaccurate", basis: "wrong_balance" }, undefined, contextFor(c, "i1"));
    expect(d.action).toBe("needs_information");
  });

  it("nothing is preselected: a category and real words are required", () => {
    expect(() => draftCustomerAssertion(client(), { id: "a", negativeItemId: "i1", category: undefined as never, statement: WORDS }, CUST)).toThrow(/Choose/);
    expect(() => draftCustomerAssertion(client(), { id: "a", negativeItemId: "i1", category: "NOT_MINE", statement: "no" }, CUST)).toThrow(/own words/);
  });

  it("a customer cannot draft against an item that is not on their report", () => {
    expect(() => draftCustomerAssertion(client(), { id: "a", negativeItemId: "someone-elses", category: "NOT_MINE", statement: WORDS }, CUST)).toThrow(/Unknown item/);
  });

  it("confirmation is an event: time, actor, channel, category and the hash of the exact words", () => {
    const c = confirmCustomerAssertion(drafted(), "a1", CUST, "customer_portal", T1);
    const a = c.assertions![0];
    expect(a.status).toBe("active");
    expect(a.confirmation).toEqual({ confirmedAt: T1, actor: CUST, channel: "customer_portal", statementHash: sha256(WORDS), category: "BALANCE_INCORRECT", negativeItemId: "i1" });
    expect(c.auditLog?.at(-1)).toMatchObject({ action: "assertion_confirmed", assertionId: "a1" });
  });

  it("a confirmed statement is never rewritten — confirming again is refused", () => {
    const c = confirmCustomerAssertion(drafted(), "a1", CUST, "customer_portal", T1);
    expect(() => confirmCustomerAssertion(c, "a1", CUST, "customer_portal")).toThrow(/never rewritten/);
  });

  it("an operator's classification keeps the customer's original words and category untouched", () => {
    const c0 = confirmCustomerAssertion(drafted("OTHER"), "a1", CUST, "customer_portal", T1);
    const c = classifyAssertion(c0, "a1", "wrong_status", "owner@example.test", "Reported open; customer says settled.", T2);
    const a = c.assertions![0];
    expect(a.originalStatement).toBe(WORDS);
    expect(a.statement).toBe(WORDS);
    expect(a.category).toBe("OTHER");
    expect(a.classification).toMatchObject({ basis: "wrong_status", by: "owner@example.test" });
    expect(a.confirmation?.statementHash).toBe(sha256(WORDS));
  });

  it("a broad category cannot become a letter until an operator classifies it", () => {
    const c = confirmCustomerAssertion(drafted("OTHER"), "a1", CUST, "customer_portal", T1);
    const d = decideForItem(item(), { accuracy: "inaccurate", basis: "wrong_status" }, undefined, contextFor(c, "i1"));
    expect(d.missing?.map((m) => m.code)).toContain("operator_classification");
    const classified = classifyAssertion(c, "a1", "wrong_status", "owner");
    expect(decideForItem(item(), { accuracy: "inaccurate", basis: "wrong_status" }, undefined, contextFor(classified, "i1")).action).toBe("dispute");
  });

  it("a confirmed category that maps 1:1 unlocks the policy with the customer's own ground", () => {
    const c = confirmCustomerAssertion(drafted("BALANCE_INCORRECT"), "a1", CUST, "customer_portal", T1);
    expect(decideForItem(item(), { accuracy: "inaccurate", basis: "wrong_balance" }, undefined, contextFor(c, "i1")).action).toBe("dispute");
  });

  it("a customer's category that disagrees with the operator's accuracy call is flagged, not overridden", () => {
    const c = confirmCustomerAssertion(drafted("NOT_MINE"), "a1", CUST, "customer_portal", T1);
    const d = decideForItem(item(), { accuracy: "inaccurate", basis: "wrong_balance" }, undefined, contextFor(c, "i1"));
    expect(d.missing?.map((m) => m.code)).toContain("assertion_basis_mismatch");
  });
});

describe("evidence records", () => {
  const ev = (over = {}) => ({ id: "e1", kind: "payment_record" as const, description: "Bank statement for March", negativeItemId: "i1", source: "customer" as const, uploadedBy: CUST, uploadedAt: T1, ...over });

  it("starts pending review, links to the customer's draft, and refuses unknown kinds / statements / URLs", () => {
    const c = addEvidence(drafted(), ev({ assertionId: "a1" }));
    expect(c.evidence![0].reviewState).toBe("pending_review");
    expect(c.assertions![0].evidenceIds).toEqual(["e1"]);
    expect(() => addEvidence(drafted(), ev({ kind: "malware" }))).toThrow(/kind of document/);
    expect(() => addEvidence(drafted(), ev({ assertionId: "nope" }))).toThrow(/Unknown statement/);
    expect(() => addEvidence(drafted(), ev({ storagePath: "https://x.example/y.pdf" }))).toThrow(/never a URL/);
    expect(() => addEvidence(drafted(), ev({ storagePath: "ftp://x/y" }))).toThrow(/never a URL/);
  });

  it("does not change a CONFIRMED statement's own evidence list (links live on the evidence)", () => {
    const confirmed = confirmCustomerAssertion(drafted(), "a1", CUST, "customer_portal", T1);
    const c = addEvidence(confirmed, ev({ assertionId: "a1" }));
    expect(c.assertions![0].evidenceIds).toEqual([]);
    expect(contextFor(c, "i1").evidence?.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("approval is bound to the exact text", () => {
  const approved = () => reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "approve", note: "ok" }, "owner", T1);

  it("stores the reviewer, time, decision and content hash", () => {
    expect(approved().disputeRounds[0].review).toMatchObject({ decision: "approved", reviewedBy: "owner", reviewedAt: T1, contentHash: sha256("Body of round one.") });
  });

  it("an approved round cannot be edited; reopening voids the approval and keeps it in history", () => {
    const a = approved();
    expect(() => reviewRound(a, "r1", { kind: "edit", body: "Changed." }, "owner")).toThrow(/awaiting review/);
    expect(() => reviewRound(a, "r1", { kind: "reopen", note: " " }, "owner")).toThrow(/why/);
    const reopened = reviewRound(a, "r1", { kind: "reopen", note: "Customer sent a new statement." }, "owner", T2);
    const r = reopened.disputeRounds[0];
    expect(r.status).toBe("needs_review");
    expect(r.review?.decision).toBe("reopened");
    expect(r.reviewHistory?.map((h) => h.decision)).toEqual(["approved"]);
    const edited = reviewRound(reopened, "r1", { kind: "edit", body: "Changed." }, "owner");
    expect(() => markSent(edited, "r1", { sentAt: T2, method: "mail", recipient: "Experian" }, "owner")).toThrow(/approved/);
  });

  it("refuses to mark sent a letter whose text no longer matches its approval", () => {
    const a = approved();
    const tampered: StoredClient = { ...a, disputeRounds: [{ ...a.disputeRounds[0], letterBody: "Body of round one. PLUS A SNEAKY LINE" }] };
    expect(() => markSent(tampered, "r1", { sentAt: T1, method: "mail", recipient: "Experian" }, "owner", T2)).toThrow(/changed after it was approved/);
  });
});

describe("sent and response records invent nothing", () => {
  const approved = () => reviewRound(client({ disputeRounds: [round()] }), "r1", { kind: "approve" }, "owner", T0);

  it("records exactly what the operator entered for exactly this round — no delivery or tracking made up", () => {
    const other = round({ id: "r0", negativeItemId: "i2", status: "needs_review" });
    const base = approved();
    const c = markSent({ ...base, disputeRounds: [other, ...base.disputeRounds] }, "r1", { sentAt: T1, method: "mail", recipient: "Experian" }, "owner", T2);
    const r = c.disputeRounds[1];
    expect(r.status).toBe("sent");
    expect(r.sent).toEqual({ sentAt: T1, method: "mail", recipient: "Experian", recordedBy: "owner", recordedAt: T2, contentHash: sha256("Body of round one.") });
    expect(JSON.stringify(r.sent)).not.toMatch(/deliver|certified|tracking/i);
    expect(c.disputeRounds[0]).toBe(other);
  });

  it("keeps a tracking reference only when the operator typed one, and refuses a future date or blank recipient", () => {
    expect(markSent(approved(), "r1", { sentAt: T1, method: "certified_mail", recipient: "Experian", trackingRef: " 9400 1234 " }, "o", T2).disputeRounds[0].sent?.trackingRef).toBe("9400 1234");
    expect(() => markSent(approved(), "r1", { sentAt: "2030-01-01T00:00:00.000Z", method: "mail", recipient: "Experian" }, "o", T2)).toThrow(/future/);
    expect(() => markSent(approved(), "r1", { sentAt: T1, method: "mail", recipient: " " }, "o", T2)).toThrow(/who/);
    expect(() => markSent(approved(), "r1", { sentAt: T1, method: "carrier_pigeon" as never, recipient: "E" }, "o", T2)).toThrow(/how/);
  });

  const sent = () => markSent(approved(), "r1", { sentAt: T1, method: "mail", recipient: "Experian" }, "owner", T1);

  it("records a response as the response says, with who answered", () => {
    const c = recordResponse(sent(), "r1", { outcome: "verified", summary: "Letter says information verified as accurate.", receivedAt: T2, respondingParty: "Experian" }, "owner", T2);
    expect(c.disputeRounds[0].response).toMatchObject({ outcome: "verified", respondingParty: "Experian", recordedBy: "owner" });
    expect(c.disputeRounds[0].response?.followUpReason).toBeUndefined();
  });

  it("refuses a response dated before the letter was sent, an unknown outcome, or a document not on file", () => {
    expect(() => recordResponse(sent(), "r1", { outcome: "verified", summary: "x", receivedAt: "2026-01-01T00:00:00.000Z" }, "o")).toThrow(/before the letter/);
    expect(() => recordResponse(sent(), "r1", { outcome: "approved_by_ai" as never, summary: "x", receivedAt: T2 }, "o")).toThrow(/what the response said/);
    expect(() => recordResponse(sent(), "r1", { outcome: "verified", summary: "x", receivedAt: T2, documentEvidenceId: "ghost" }, "o")).toThrow(/not on file/);
  });

  describe("follow-up needs a documented basis", () => {
    const responded = () => recordResponse(sent(), "r1", { outcome: "verified", summary: "Verified.", receivedAt: T2 }, "owner", T2);

    it.each(["previous round unsuccessful", "Still on report", "not removed", "try again", "It didn't work", "verified"])(
      "refuses %j as a reason",
      (reason) => {
        expect(() => authorizeFollowUp(responded(), "r1", reason, "owner")).toThrow(/specific reason/);
      }
    );

    it("accepts a specific reason and keeps it, with who and when, in the case history", () => {
      const c = authorizeFollowUp(responded(), "r1", "The response did not address the $400 payment shown on the March statement.", "owner", T2);
      expect(c.disputeRounds[0].response).toMatchObject({ followUpAuthorizedBy: "owner", followUpAuthorizedAt: T2 });
      expect(c.disputeRounds[0].response?.followUpReason).toMatch(/\$400 payment/);
      expect(caseTimeline(c).at(-1)).toMatchObject({ action: "follow_up_authorized", label: "Follow-up authorized" });
    });

    it("refuses a follow-up before any response, after a resolving response, or twice", () => {
      expect(() => authorizeFollowUp(sent(), "r1", "The response did not address the documented payment.", "o")).toThrow(/after a response/);
      const deleted = recordResponse(sent(), "r1", { outcome: "deleted", summary: "Deleted.", receivedAt: T2 }, "o");
      expect(() => authorizeFollowUp(deleted, "r1", "The response did not address the documented payment.", "o")).toThrow(/resolved/);
      const once = authorizeFollowUp(responded(), "r1", "The response did not address the documented payment.", "o");
      expect(() => authorizeFollowUp(once, "r1", "The response did not address the documented payment again.", "o")).toThrow(/already/);
    });
  });
});

describe("timeline", () => {
  it("is one ordered history over the single audit log", () => {
    let c = drafted();
    c = confirmCustomerAssertion(c, "a1", CUST, "customer_portal", T1);
    c = addEvidence(c, { id: "e1", kind: "payment_record", description: "Statement", negativeItemId: "i1", source: "customer", uploadedBy: CUST, uploadedAt: T1 });
    c = { ...c, disputeRounds: [round()] };
    c = reviewRound(c, "r1", { kind: "approve" }, "owner", T2);
    const t = caseTimeline(c);
    expect(t.map((e) => e.action)).toEqual(["assertion_drafted", "assertion_confirmed", "evidence_recorded", "round_approved"]);
    expect(t.map((e) => e.at)).toEqual([...t.map((e) => e.at)].sort());
  });

  it("keeps same-second events in the order they were written", () => {
    const c = { ...client(), auditLog: [
      { at: T1, actor: "a", action: "round_generated" as const },
      { at: T1, actor: "a", action: "round_approved" as const },
      { at: T0, actor: "a", action: "client_imported" as const },
    ] };
    expect(caseTimeline(c).map((e) => e.action)).toEqual(["client_imported", "round_generated", "round_approved"]);
  });
});

describe("rounds rescued from a browser (C1 review blocker)", () => {
  it("lands every round as needs_review with any claimed approval, sent record, response or trace removed", () => {
    const forged = [
      { ...round({ id: "f1", status: "sent" }), response: { outcome: "verified", summary: "forged", receivedAt: T0, recordedBy: "x", recordedAt: T0, followUpReason: "forged reason that looks long enough" }, review: { decision: "approved", reviewedBy: "x", reviewedAt: T0 }, trace: [{ text: "x", source: "customer_assertion", ref: "x" }], assertionId: "a-forged" },
      round({ id: "f2", status: "approved" }),
    ];
    const out = sanitizeImportedRounds(forged, T1);
    expect(out.map((r) => r.status)).toEqual(["needs_review", "needs_review"]);
    for (const r of out) {
      expect(r.response).toBeUndefined();
      expect(r.review).toBeUndefined();
      expect(r.sent).toBeUndefined();
      expect(r.trace).toBeUndefined();
      expect(r.assertionId).toBeUndefined();
      expect(r.importedFromBrowser).toBe(true);
    }
  });

  it("a forged 'verified' response can no longer satisfy the unverifiable ground", () => {
    const out = sanitizeImportedRounds([{ ...round({ id: "f1", status: "response_received" }), response: { outcome: "verified", summary: "forged", receivedAt: T0 } }], T1);
    const c = { ...client(), disputeRounds: out };
    const d = decideForItem(item(), { accuracy: "inaccurate", basis: "unverifiable" }, undefined, contextFor(c, "i1"));
    expect(d.action).not.toBe("dispute");
  });

  it("quarantines (keeps, as cancelled) a rescued round with banned language", () => {
    const out = sanitizeImportedRounds([round({ id: "bad", letterBody: "Under penalty of perjury this is false." })], T1);
    expect(out[0]).toMatchObject({ status: "cancelled", review: { reviewedBy: "system:import-quarantine" } });
  });

  it("ignores junk and duplicate ids", () => {
    expect(sanitizeImportedRounds("nope")).toEqual([]);
    expect(sanitizeImportedRounds([round({ id: "x" }), round({ id: "x" }), null, 5]).map((r) => r.id)).toEqual(["x"]);
  });
});

describe("what a customer may see", () => {
  it("their items, their own statements and documents — no SSN, DOB, address, scores, letters, operator notes or classifications", () => {
    let c = confirmCustomerAssertion(drafted("OTHER"), "a1", CUST, "customer_portal", T1);
    c = classifyAssertion(c, "a1", "wrong_status", "owner", "INTERNAL NOTE: operator view only");
    c = { ...c, assessments: { i1: { accuracy: "inaccurate", basis: "wrong_status", basisNote: "INTERNAL accuracy note" } }, disputeRounds: [round({ letterBody: "LETTER BODY TEXT" })] };
    c = addEvidence(c, { id: "e-op", kind: "other", description: "Operator-only document", negativeItemId: "i1", source: "operator", uploadedBy: "owner", uploadedAt: T1 });
    const view = customerCaseView(c, caseQueueRow(c, 0));
    const json = JSON.stringify(view);
    for (const secret of ["1234", "1990-01-01", "Example Way", "LETTER BODY TEXT", "INTERNAL", "wrong_status", "Operator-only document", "Jordan"]) {
      expect(json, secret).not.toContain(secret);
    }
    expect(view.statements[0]).toMatchObject({ statement: WORDS, status: "active", confirmedAt: T1 });
  });
});

describe("closing a case", () => {
  it("refuses while a round is awaiting review, approved or sent", () => {
    expect(() => closeCase(client({ disputeRounds: [round()] }), "owner", "done")).toThrow(/Resolve/);
    expect(closeCase(client(), "owner", "done", T1).closedAt).toBe(T1);
  });
});
