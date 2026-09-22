/**
 * Case state for the credit dispute desk (C1) — pure functions, no I/O.
 *
 * The server actions load a StoredClient, call these, and write the result back.
 * Keeping the logic here means every rule (round numbering, immutability of earlier
 * rounds, review transitions, the no-automatic-escalation rule) is unit-tested
 * without a database, and the actions stay thin.
 *
 * Rules enforced here:
 *   - A new round NEVER modifies an earlier round. Rounds are appended.
 *   - Round numbers come from the stored history, per item.
 *   - Only `needs_review` rounds can be edited, approved, returned or cancelled.
 *   - A response can only be recorded against a `sent` round.
 *   - Letter text is rendered on the server from stored facts; client-built bodies
 *     are never accepted.
 */

import { createHash } from "node:crypto";
import type { NegativeItem, RoundStatus } from "../types";
import type { ItemAssessment } from "../policy/dispute-policy";
import { inferAssessment } from "../policy/dispute-policy";
import type {
  CustomerAssertion,
  DecisionContext,
  EvidenceRef,
  ItemRoundHistory,
  RoundResponse,
} from "../policy/assertion";
import { assertNoBannedLanguage } from "../letters/render-from-decision";
import type { GatedRunResult } from "./gated-protocol";
import type { CreditAuditEvent, StoredClient, StoredDisputeRound } from "../data/store";

// ---------------------------------------------------------------------------
// Reading the stored record
// ---------------------------------------------------------------------------

/** Pre-C1 rows say "draft"; they are drafts awaiting review. */
export function normaliseStatus(status: string): RoundStatus {
  return (status === "draft" ? "needs_review" : status) as RoundStatus;
}

const NOT_COUNTED: ReadonlySet<RoundStatus> = new Set(["cancelled", "returned_for_information"]);

/** This item's rounds that count as history (cancelled / returned excluded), oldest first. */
export function itemHistory(client: StoredClient, itemId: string): ItemRoundHistory[] {
  return client.disputeRounds
    .filter((r) => r.negativeItemId === itemId && !NOT_COUNTED.has(normaliseStatus(r.status)))
    .sort((a, b) => a.roundNumber - b.roundNumber || a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({
      roundId: r.id,
      roundType: r.roundType,
      roundNumber: r.roundNumber,
      status: normaliseStatus(r.status),
      response: r.response,
    }));
}

/** The customer's current assertion for an item: the most recent active one. */
export function activeAssertion(client: StoredClient, itemId: string): CustomerAssertion | undefined {
  return [...(client.assertions ?? [])]
    .filter((a) => a.negativeItemId === itemId && a.status === "active")
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

export function contextFor(client: StoredClient, itemId: string): DecisionContext {
  const assertion = activeAssertion(client, itemId);
  const evidence = (client.evidence ?? []).filter(
    (e) => e.negativeItemId === itemId || (assertion && (assertion.evidenceIds.includes(e.id) || e.assertionId === assertion.id))
  );
  return { assertion, evidence, history: itemHistory(client, itemId) };
}

/** Assessments and contexts for every active item, straight from the stored record. */
export function resolveForPlanning(client: StoredClient): {
  items: NegativeItem[];
  assessments: Record<string, ItemAssessment>;
  contexts: Record<string, DecisionContext>;
} {
  const items = client.negativeItems.filter((i) => i.status !== "removed" && i.status !== "closed");
  const assessments: Record<string, ItemAssessment> = {};
  const contexts: Record<string, DecisionContext> = {};
  for (const item of items) {
    const ctx = contextFor(client, item.id);
    const stored = client.assessments?.[item.id];
    assessments[item.id] = {
      ...(stored ?? inferAssessment(item)),
      roundsSent: (ctx.history ?? []).map((h) => h.roundType),
    };
    contexts[item.id] = ctx;
  }
  return { items, assessments, contexts };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function audit(client: StoredClient, event: Omit<CreditAuditEvent, "at">, at = new Date().toISOString()): StoredClient {
  return { ...client, auditLog: [...(client.auditLog ?? []), { at, ...event }] };
}

/** Rounds built from a server-side run. Status is always needs_review. */
export function roundsFromRun(
  run: GatedRunResult,
  actor: string,
  now = new Date().toISOString(),
  idPrefix = `round-${Date.now()}`
): StoredDisputeRound[] {
  return run.rendered.map(({ negativeItemId, rendered }, i) => ({
    id: `${idPrefix}-${i}`,
    negativeItemId,
    roundNumber: rendered.roundNumber,
    roundType: rendered.roundType,
    bureau: rendered.letter.bureau,
    status: "needs_review",
    letterSubject: rendered.letter.subject,
    letterBody: rendered.letter.body,
    furnisherName: run.lettersGenerated[i]?.furnisherName ?? "",
    createdAt: now,
    basis: rendered.basis,
    assertionId: rendered.assertionId,
    evidenceIds: rendered.evidenceIds,
    trace: rendered.trace,
    templateVersion: rendered.templateVersion,
    generatedBy: actor,
  }));
}

/**
 * Append new rounds. Earlier rounds are carried over by reference and never
 * changed; an id collision or a round number that does not follow the item's
 * history is refused.
 */
export function appendRounds(client: StoredClient, fresh: StoredDisputeRound[]): StoredClient {
  const ids = new Set(client.disputeRounds.map((r) => r.id));
  for (const r of fresh) {
    if (ids.has(r.id)) throw new Error(`Round id ${r.id} already exists; earlier rounds are never overwritten.`);
    const expected = itemHistory(client, r.negativeItemId).length + 1;
    if (r.roundNumber !== expected) {
      throw new Error(`Round ${r.roundNumber} for item ${r.negativeItemId} does not follow its history (expected ${expected}).`);
    }
    if (normaliseStatus(r.status) !== "needs_review") {
      throw new Error("New rounds start in needs_review; a person moves them on.");
    }
  }
  return { ...client, disputeRounds: [...client.disputeRounds, ...fresh] };
}

export type ReviewAction =
  | { kind: "edit"; body: string; note?: string }
  | { kind: "approve"; note?: string }
  | { kind: "return_for_information"; note: string }
  | { kind: "cancel"; note?: string };

/** Apply a reviewer's action to one needs_review round. Every other round is untouched. */
export function reviewRound(
  client: StoredClient,
  roundId: string,
  action: ReviewAction,
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  const idx = client.disputeRounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new Error("Round not found.");
  const round = client.disputeRounds[idx];
  if (normaliseStatus(round.status) !== "needs_review") {
    throw new Error(`Only a round awaiting review can be changed; this one is ${normaliseStatus(round.status)}.`);
  }

  let next: StoredDisputeRound;
  let event: Omit<CreditAuditEvent, "at">;
  switch (action.kind) {
    case "edit": {
      const body = action.body.trim();
      if (!body) throw new Error("An edited letter cannot be empty.");
      // An edit is checked with the same screen as a generated letter.
      assertNoBannedLanguage({ ...toLetter(round), body });
      next = {
        ...round,
        letterBody: body,
        edits: [
          ...(round.edits ?? []),
          { editedBy: actor, editedAt: now, beforeHash: sha256(round.letterBody), afterHash: sha256(body), note: action.note },
        ],
      };
      event = { actor, action: "round_edited", roundId, negativeItemId: round.negativeItemId };
      break;
    }
    case "approve":
      next = { ...round, status: "approved", review: { decision: "approved", reviewedBy: actor, reviewedAt: now, note: action.note } };
      event = { actor, action: "round_approved", roundId, negativeItemId: round.negativeItemId };
      break;
    case "return_for_information":
      if (!action.note?.trim()) throw new Error("Say what information is needed when returning a letter.");
      next = {
        ...round,
        status: "returned_for_information",
        review: { decision: "returned_for_information", reviewedBy: actor, reviewedAt: now, note: action.note },
      };
      event = { actor, action: "round_returned", roundId, negativeItemId: round.negativeItemId };
      break;
    case "cancel":
      next = { ...round, status: "cancelled", review: { decision: "cancelled", reviewedBy: actor, reviewedAt: now, note: action.note } };
      event = { actor, action: "round_cancelled", roundId, negativeItemId: round.negativeItemId };
      break;
  }

  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
  return audit({ ...client, disputeRounds }, event, now);
}

/**
 * Record that a person mailed an approved round. Engine only in C1: there is no
 * server action or button for it yet (sending is out of scope until C1 is reviewed).
 * It exists so the full lifecycle — approved, sent, response, follow-up — is tested.
 */
export function markSent(
  client: StoredClient,
  roundId: string,
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  const idx = client.disputeRounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new Error("Round not found.");
  if (normaliseStatus(client.disputeRounds[idx].status) !== "approved") {
    throw new Error("Only an approved round can be marked sent.");
  }
  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? { ...r, status: "sent" } : r));
  return audit({ ...client, disputeRounds }, { actor, action: "round_marked_sent", roundId, negativeItemId: client.disputeRounds[idx].negativeItemId }, now);
}

/** Record what came back for a round that was actually sent. */
export function recordResponse(
  client: StoredClient,
  roundId: string,
  response: Omit<RoundResponse, "recordedBy" | "recordedAt">,
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  const idx = client.disputeRounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new Error("Round not found.");
  const round = client.disputeRounds[idx];
  if (normaliseStatus(round.status) !== "sent") {
    throw new Error("A response can only be recorded for a round that was sent.");
  }
  if (!response.summary?.trim()) throw new Error("Summarise what the response said.");
  const next: StoredDisputeRound = {
    ...round,
    status: "response_received",
    response: { ...response, recordedBy: actor, recordedAt: now },
  };
  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
  return audit({ ...client, disputeRounds }, { actor, action: "response_recorded", roundId, negativeItemId: round.negativeItemId, detail: response.outcome }, now);
}

function toLetter(r: StoredDisputeRound) {
  return {
    subject: r.letterSubject,
    body: r.letterBody,
    recipient: "",
    recipientAddress: { street: "", city: "", state: "", zip: "" },
    roundType: r.roundType,
    bureau: r.bureau as "experian",
    roundNumber: r.roundNumber,
    responseDueDays: 0,
  };
}

// ---------------------------------------------------------------------------
// Assertions and evidence
// ---------------------------------------------------------------------------

export function addAssertion(client: StoredClient, a: CustomerAssertion): StoredClient {
  if (!client.negativeItems.some((i) => i.id === a.negativeItemId)) throw new Error("Unknown item.");
  // A new assertion for the same item supersedes the old one; the old one is kept, withdrawn.
  const assertions = (client.assertions ?? []).map((x) =>
    x.negativeItemId === a.negativeItemId && x.status === "active" ? { ...x, status: "withdrawn" as const } : x
  );
  return audit({ ...client, assertions: [...assertions, a] }, {
    actor: a.recordedBy,
    action: "assertion_recorded",
    negativeItemId: a.negativeItemId,
    assertionId: a.id,
    detail: `${a.basis}; source ${a.source}; confirmed ${a.customerConfirmed}`,
  }, a.recordedAt);
}

export function addEvidence(client: StoredClient, e: EvidenceRef): StoredClient {
  if (e.storagePath && /^https?:\/\//i.test(e.storagePath)) {
    throw new Error("Evidence is referenced by a private storage path, never a URL.");
  }
  if (e.negativeItemId && !client.negativeItems.some((i) => i.id === e.negativeItemId)) throw new Error("Unknown item.");
  return audit({ ...client, evidence: [...(client.evidence ?? []), e] }, {
    actor: e.uploadedBy,
    action: "evidence_recorded",
    negativeItemId: e.negativeItemId,
    evidenceId: e.id,
    assertionId: e.assertionId,
    detail: e.kind,
  }, e.uploadedAt);
}

// ---------------------------------------------------------------------------
// Operator queue (C1-012) and the future AIXMOS read boundary (C1-016)
// ---------------------------------------------------------------------------

export interface CaseQueueRow {
  clientId: string;
  /** Counts only. No names, identifiers, report contents or letter text. */
  itemsNeedingInformation: number;
  roundsAwaitingReview: number;
  roundsApproved: number;
  roundsSent: number;
  responsesRecorded: number;
  followUpsNeedingReason: number;
}

/**
 * The questions an operator (and later AIXMOS) asks — "which cases need evidence,
 * which are waiting for review, which have responses" — answered with counts only.
 * `itemsNeedingInformation` comes from a planning pass the caller supplies.
 */
export function caseQueueRow(client: StoredClient, itemsNeedingInformation: number): CaseQueueRow {
  const statuses = client.disputeRounds.map((r) => normaliseStatus(r.status));
  const followUpsNeedingReason = client.disputeRounds.filter(
    (r) => r.response && !["deleted", "corrected", "updated"].includes(r.response.outcome) && !r.response.followUpReason
  ).length;
  return {
    clientId: client.profile.id,
    itemsNeedingInformation,
    roundsAwaitingReview: statuses.filter((s) => s === "needs_review").length,
    roundsApproved: statuses.filter((s) => s === "approved").length,
    roundsSent: statuses.filter((s) => s === "sent").length,
    responsesRecorded: statuses.filter((s) => s === "response_received").length,
    followUpsNeedingReason,
  };
}

// ---------------------------------------------------------------------------
// GHL boundary (C1-015)
// ---------------------------------------------------------------------------

/** The ONLY credit information that may ever be sent to a CRM. A status word. */
export type CreditCrmStatus =
  | "Credit Intake Started"
  | "Documents Needed"
  | "Review Required"
  | "Customer Action Required"
  | "Case In Progress"
  | "Process Completed";

/**
 * Map a case to one CRM status. Returns a label and nothing else: no scores,
 * tradelines, letters, evidence or identifiers. Nothing calls GHL in C1; this is
 * the boundary a future sync must go through.
 */
export function creditCrmStatus(client: StoredClient, row: CaseQueueRow): CreditCrmStatus {
  const active = client.negativeItems.filter((i) => i.status !== "removed" && i.status !== "closed");
  if (client.disputeRounds.length === 0 && (client.assertions ?? []).length === 0) return "Credit Intake Started";
  if (row.roundsAwaitingReview > 0) return "Review Required";
  if (row.followUpsNeedingReason > 0 || row.itemsNeedingInformation > 0) {
    const needsDocs = (client.assertions ?? []).some((a) => a.status === "active" && a.evidenceIds.length === 0);
    return needsDocs ? "Documents Needed" : "Customer Action Required";
  }
  if (active.length === 0) return "Process Completed";
  return "Case In Progress";
}
