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
import type { FactualBasis, ItemAssessment } from "../policy/dispute-policy";
import { inferAssessment } from "../policy/dispute-policy";
import {
  CATEGORY_BASIS,
  EVIDENCE_KINDS,
  isSubstantiveFollowUpReason,
  type CustomerAssertion,
  type DecisionContext,
  type EvidenceRef,
  type IssueCategory,
  type ItemRoundHistory,
  type ResponseOutcome,
  type RoundResponse,
  type SendMethod,
} from "../policy/assertion";

export const ISSUE_CATEGORIES = Object.keys(CATEGORY_BASIS) as IssueCategory[];
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
    ...(rendered.recipientId ? { recipientId: rendered.recipientId, recipientVersion: rendered.recipientVersion } : {}),
  }));
}

/**
 * Rounds rescued from a browser (C1 blocker fix).
 *
 * A browser could only ever have held pre-C1 drafts — but anything arriving from
 * one is untrusted: it could claim `approved` or `sent`, carry a forged "verified"
 * response (which would satisfy the `unverifiable` history requirement), or hold
 * text the banned-language screen would refuse. So every imported round:
 *   - keeps only the letter itself and where it belongs,
 *   - loses any claimed review, sent record, response, trace or assertion link,
 *   - lands as `needs_review`, or `cancelled` (kept, quarantined) if its text fails
 *     the banned-language screen.
 * A person then reviews it like any other draft; it proves nothing about history.
 */
export function sanitizeImportedRounds(rounds: unknown, now = new Date().toISOString()): StoredDisputeRound[] {
  if (!Array.isArray(rounds)) return [];
  const seen = new Set<string>();
  const out: StoredDisputeRound[] = [];
  for (const raw of rounds as Array<Partial<StoredDisputeRound>>) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const base: StoredDisputeRound = {
      id: raw.id.slice(0, 80),
      negativeItemId: String(raw.negativeItemId ?? ""),
      roundNumber: Number.isInteger(raw.roundNumber) ? (raw.roundNumber as number) : 1,
      roundType: raw.roundType as StoredDisputeRound["roundType"],
      bureau: String(raw.bureau ?? ""),
      status: "needs_review",
      letterSubject: String(raw.letterSubject ?? "").slice(0, 300),
      letterBody: String(raw.letterBody ?? "").slice(0, 20000),
      furnisherName: String(raw.furnisherName ?? "").slice(0, 200),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
      importedFromBrowser: true,
    };
    try {
      assertNoBannedLanguage(toLetter(base));
      out.push(base);
    } catch {
      out.push({
        ...base,
        status: "cancelled",
        review: { decision: "cancelled", reviewedBy: "system:import-quarantine", reviewedAt: now, note: "Quarantined on import: contains language the screen refuses." },
      });
    }
  }
  return out;
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
  | { kind: "cancel"; note?: string }
  /** C2: take an approved-but-unsent round back to review. The approval is voided, not deleted. */
  | { kind: "reopen"; note: string };

/** Keep every superseded decision; the current one lives in `review`. */
function withDecision(round: StoredDisputeRound, review: NonNullable<StoredDisputeRound["review"]>): StoredDisputeRound {
  return {
    ...round,
    review,
    reviewHistory: round.review ? [...(round.reviewHistory ?? []), round.review] : round.reviewHistory,
  };
}

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
  const status = normaliseStatus(round.status);

  // Reopen is the ONLY action on an approved round, and only before it is sent.
  if (action.kind === "reopen") {
    if (status !== "approved") throw new Error("Only an approved, unsent round can be reopened.");
    if (!action.note?.trim()) throw new Error("Say why the approved letter is being reopened.");
    const next = withDecision(
      { ...round, status: "needs_review" },
      { decision: "reopened", reviewedBy: actor, reviewedAt: now, note: action.note, contentHash: sha256(round.letterBody) }
    );
    const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
    return audit({ ...client, disputeRounds }, { actor, action: "round_reopened", roundId, negativeItemId: round.negativeItemId }, now);
  }

  if (status !== "needs_review") {
    throw new Error(`Only a round awaiting review can be changed; this one is ${status}.`);
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
      // The approval covers exactly this text. Any later change needs a new review.
      next = withDecision(
        { ...round, status: "approved" },
        { decision: "approved", reviewedBy: actor, reviewedAt: now, note: action.note, contentHash: sha256(round.letterBody) }
      );
      event = { actor, action: "round_approved", roundId, negativeItemId: round.negativeItemId };
      break;
    case "return_for_information":
      if (!action.note?.trim()) throw new Error("Say what information is needed when returning a letter.");
      next = withDecision(
        { ...round, status: "returned_for_information" },
        { decision: "returned_for_information", reviewedBy: actor, reviewedAt: now, note: action.note, contentHash: sha256(round.letterBody) }
      );
      event = { actor, action: "round_returned", roundId, negativeItemId: round.negativeItemId };
      break;
    case "cancel":
      next = withDecision(
        { ...round, status: "cancelled" },
        { decision: "cancelled", reviewedBy: actor, reviewedAt: now, note: action.note, contentHash: sha256(round.letterBody) }
      );
      event = { actor, action: "round_cancelled", roundId, negativeItemId: round.negativeItemId };
      break;
  }

  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
  return audit({ ...client, disputeRounds }, event, now);
}

/**
 * Record that a person sent an approved round (C2: exposed as a server action).
 * Records state only — nothing here sends, mails, submits or confirms delivery.
 * The letter must be byte-for-byte the text that was approved; if it changed after
 * approval, it goes back through review.
 */
export function markSent(
  client: StoredClient,
  roundId: string,
  sent: { sentAt: string; method: SendMethod; recipient: string; trackingRef?: string },
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  const idx = client.disputeRounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new Error("Round not found.");
  const round = client.disputeRounds[idx];
  if (normaliseStatus(round.status) !== "approved") throw new Error("Only an approved round can be marked sent.");
  const hash = sha256(round.letterBody);
  if (round.review?.decision !== "approved" || round.review.contentHash !== hash) {
    throw new Error("This letter changed after it was approved. It needs to be reviewed again before it is marked sent.");
  }
  if (!SEND_METHODS.includes(sent.method)) throw new Error("Choose how it was sent.");
  if (!sent.recipient?.trim()) throw new Error("Say who it was sent to.");
  if (Number.isNaN(Date.parse(sent.sentAt)) || Date.parse(sent.sentAt) > Date.parse(now) + 60_000) {
    throw new Error("Give the real date it was sent (not in the future).");
  }
  const trackingRef = sent.trackingRef?.trim() ? sent.trackingRef.trim().slice(0, 80) : undefined;
  const next: StoredDisputeRound = {
    ...round,
    status: "sent",
    sent: {
      sentAt: new Date(sent.sentAt).toISOString(),
      method: sent.method,
      recipient: sent.recipient.trim().slice(0, 200),
      ...(trackingRef ? { trackingRef } : {}),
      recordedBy: actor,
      recordedAt: now,
      contentHash: hash,
    },
  };
  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
  return audit(
    { ...client, disputeRounds },
    { actor, action: "round_marked_sent", roundId, negativeItemId: round.negativeItemId, detail: sent.method },
    now
  );
}

export const SEND_METHODS: SendMethod[] = ["mail", "certified_mail", "fax", "online_portal", "hand_delivered", "other"];

const OUTCOMES: ResponseOutcome[] = ["deleted", "corrected", "updated", "verified", "no_change", "no_response", "frivolous", "unknown"];

/** Record what came back for a round that was actually sent — as the response says, nothing inferred. */
export function recordResponse(
  client: StoredClient,
  roundId: string,
  response: Omit<RoundResponse, "recordedBy" | "recordedAt" | "followUpReason" | "followUpAuthorizedBy" | "followUpAuthorizedAt">,
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  const idx = client.disputeRounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new Error("Round not found.");
  const round = client.disputeRounds[idx];
  if (normaliseStatus(round.status) !== "sent") {
    throw new Error("A response can only be recorded for a round that was sent.");
  }
  if (!OUTCOMES.includes(response.outcome)) throw new Error("Choose what the response said.");
  if (!response.summary?.trim()) throw new Error("Summarise what the response said.");
  if (Number.isNaN(Date.parse(response.receivedAt))) throw new Error("Give the date the response was received.");
  if (Date.parse(response.receivedAt) > Date.parse(now) + 60_000) throw new Error("A response cannot be received in the future.");
  if (round.sent && Date.parse(response.receivedAt) < Date.parse(round.sent.sentAt) - 86_400_000) {
    throw new Error("A response cannot be received before the letter was sent.");
  }
  if (response.documentEvidenceId && !(client.evidence ?? []).some((e) => e.id === response.documentEvidenceId)) {
    throw new Error("That response document is not on file.");
  }
  const next: StoredDisputeRound = {
    ...round,
    status: "response_received",
    response: {
      outcome: response.outcome,
      summary: response.summary.trim().slice(0, 1000),
      receivedAt: response.receivedAt,
      ...(response.respondingParty?.trim() ? { respondingParty: response.respondingParty.trim().slice(0, 200) } : {}),
      ...(response.documentEvidenceId ? { documentEvidenceId: response.documentEvidenceId } : {}),
      recordedBy: actor,
      recordedAt: now,
    },
  };
  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
  return audit({ ...client, disputeRounds }, { actor, action: "response_recorded", roundId, negativeItemId: round.negativeItemId, detail: response.outcome }, now);
}

/**
 * Authorize a follow-up round (C2). Separate from recording the response, so the
 * reason is its own event in the case history. A result the customer did not like
 * is not a reason: the reason must say what the response got wrong or left out.
 */
export function authorizeFollowUp(
  client: StoredClient,
  roundId: string,
  reason: string,
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  const idx = client.disputeRounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new Error("Round not found.");
  const round = client.disputeRounds[idx];
  if (normaliseStatus(round.status) !== "response_received" || !round.response) {
    throw new Error("A follow-up can only be authorized after a response is recorded.");
  }
  if (["deleted", "corrected", "updated"].includes(round.response.outcome)) {
    throw new Error("The response resolved this item; there is nothing to follow up.");
  }
  if (round.response.followUpReason) throw new Error("A follow-up is already authorized for this round.");
  if (!isSubstantiveFollowUpReason(reason)) {
    throw new Error("Give the specific reason: what the response got wrong or did not answer. \"It didn't work\" is not a basis.");
  }
  const later = client.disputeRounds.some((r) => r.negativeItemId === round.negativeItemId && r.roundNumber > round.roundNumber && !NOT_COUNTED.has(normaliseStatus(r.status)));
  if (later) throw new Error("Only the latest round for an item can be followed up.");
  const next: StoredDisputeRound = {
    ...round,
    response: { ...round.response, followUpReason: reason.trim().slice(0, 1000), followUpAuthorizedBy: actor, followUpAuthorizedAt: now },
  };
  const disputeRounds = client.disputeRounds.map((r, i) => (i === idx ? next : r));
  return audit({ ...client, disputeRounds }, { actor, action: "follow_up_authorized", roundId, negativeItemId: round.negativeItemId }, now);
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

function withdrawActive(client: StoredClient, itemId: string, keepId?: string): CustomerAssertion[] {
  return (client.assertions ?? []).map((x) =>
    x.negativeItemId === itemId && x.status === "active" && x.id !== keepId ? { ...x, status: "withdrawn" as const } : x
  );
}

/**
 * Operator path (C1): record a statement the customer gave by phone / in person.
 * With customerConfirmed, the confirmation is recorded as operator-attested.
 */
export function addAssertion(client: StoredClient, a: CustomerAssertion): StoredClient {
  if (!client.negativeItems.some((i) => i.id === a.negativeItemId)) throw new Error("Unknown item.");
  const confirmed = a.source === "customer" && a.customerConfirmed;
  const record: CustomerAssertion = {
    ...a,
    originalStatement: a.originalStatement ?? a.statement,
    customerConfirmed: confirmed,
    ...(confirmed
      ? {
          confirmation: a.confirmation ?? {
            confirmedAt: a.recordedAt,
            actor: a.recordedBy,
            channel: "operator_attested" as const,
            statementHash: sha256(a.statement),
            category: a.category,
            negativeItemId: a.negativeItemId,
          },
        }
      : {}),
  };
  return audit({ ...client, assertions: [...withdrawActive(client, a.negativeItemId), record] }, {
    actor: a.recordedBy,
    action: "assertion_recorded",
    negativeItemId: a.negativeItemId,
    assertionId: a.id,
    detail: `${a.basis ?? a.category ?? "unclassified"}; source ${a.source}; confirmed ${confirmed}`,
  }, a.recordedAt);
}

/**
 * Customer path (C2): the customer writes a DRAFT for their own item. Nothing is
 * preselected; category and words are theirs. A draft unlocks nothing.
 */
export function draftCustomerAssertion(
  client: StoredClient,
  input: { id: string; negativeItemId: string; category: IssueCategory; statement: string },
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  if (!client.negativeItems.some((i) => i.id === input.negativeItemId)) throw new Error("Unknown item.");
  if (!ISSUE_CATEGORIES.includes(input.category)) throw new Error("Choose what you believe is wrong.");
  const statement = input.statement.trim();
  if (statement.length < 10) throw new Error("Explain in your own words what is wrong (a sentence or two).");
  const draft: CustomerAssertion = {
    id: input.id,
    negativeItemId: input.negativeItemId,
    category: input.category,
    basis: CATEGORY_BASIS[input.category],
    statement: statement.slice(0, 2000),
    originalStatement: statement.slice(0, 2000),
    source: "customer",
    customerConfirmed: false,
    evidenceIds: [],
    recordedBy: actor,
    recordedAt: now,
    status: "draft",
  };
  return audit({ ...client, assertions: [...(client.assertions ?? []), draft] }, {
    actor, action: "assertion_drafted", negativeItemId: input.negativeItemId, assertionId: input.id, detail: input.category,
  }, now);
}

/**
 * The customer adopts their draft. Written once: the text, category, item and time
 * are fixed from here. To change what they are saying, they write a new one.
 */
export function confirmCustomerAssertion(
  client: StoredClient,
  assertionId: string,
  actor: string,
  channel: "customer_portal" | "operator_attested",
  now = new Date().toISOString()
): StoredClient {
  const a = (client.assertions ?? []).find((x) => x.id === assertionId);
  if (!a) throw new Error("Statement not found.");
  if (a.status !== "draft") throw new Error("Only a draft statement can be confirmed; a confirmed one is never rewritten.");
  const confirmed: CustomerAssertion = {
    ...a,
    status: "active",
    customerConfirmed: true,
    confirmation: {
      confirmedAt: now,
      actor,
      channel,
      statementHash: sha256(a.originalStatement ?? a.statement),
      category: a.category,
      negativeItemId: a.negativeItemId,
    },
  };
  const assertions = withdrawActive(client, a.negativeItemId, a.id).map((x) => (x.id === a.id ? confirmed : x));
  return audit({ ...client, assertions }, { actor, action: "assertion_confirmed", negativeItemId: a.negativeItemId, assertionId, detail: channel }, now);
}

/** An operator maps a broad category to a specific ground. The customer's words are untouched. */
export function classifyAssertion(
  client: StoredClient,
  assertionId: string,
  basis: FactualBasis,
  actor: string,
  note?: string,
  now = new Date().toISOString()
): StoredClient {
  const a = (client.assertions ?? []).find((x) => x.id === assertionId);
  if (!a) throw new Error("Statement not found.");
  if (a.status === "withdrawn") throw new Error("That statement was withdrawn.");
  const assertions = (client.assertions ?? []).map((x) =>
    x.id === assertionId ? { ...x, classification: { basis, by: actor, at: now, ...(note ? { note: note.slice(0, 500) } : {}) } } : x
  );
  return audit({ ...client, assertions }, { actor, action: "assertion_classified", negativeItemId: a.negativeItemId, assertionId, detail: basis }, now);
}

export function addEvidence(client: StoredClient, e: EvidenceRef): StoredClient {
  if (!EVIDENCE_KINDS.includes(e.kind)) throw new Error("Choose what kind of document this is.");
  if (e.storagePath && /^[a-z]+:\/\//i.test(e.storagePath)) {
    throw new Error("Evidence is referenced by a private storage path, never a URL.");
  }
  if (e.negativeItemId && !client.negativeItems.some((i) => i.id === e.negativeItemId)) throw new Error("Unknown item.");
  if (e.assertionId && !(client.assertions ?? []).some((a) => a.id === e.assertionId)) throw new Error("Unknown statement.");
  const record: EvidenceRef = { ...e, reviewState: e.reviewState ?? "pending_review" };
  // Linking evidence to a DRAFT assertion is allowed (the customer attaches before
  // confirming); a confirmed assertion's own list is fixed, so links go on the evidence row.
  const assertions = (client.assertions ?? []).map((a) =>
    a.id === e.assertionId && a.status === "draft" ? { ...a, evidenceIds: [...a.evidenceIds, e.id] } : a
  );
  return audit({ ...client, assertions, evidence: [...(client.evidence ?? []), record] }, {
    actor: e.uploadedBy,
    action: "evidence_recorded",
    negativeItemId: e.negativeItemId,
    evidenceId: e.id,
    assertionId: e.assertionId,
    detail: e.kind,
  }, e.uploadedAt);
}

export function reviewEvidence(
  client: StoredClient,
  evidenceId: string,
  state: "accepted" | "rejected",
  actor: string,
  now = new Date().toISOString()
): StoredClient {
  if (!(client.evidence ?? []).some((e) => e.id === evidenceId)) throw new Error("Document not found.");
  const evidence = (client.evidence ?? []).map((e) => (e.id === evidenceId ? { ...e, reviewState: state, reviewedBy: actor, reviewedAt: now } : e));
  return audit({ ...client, evidence }, { actor, action: "evidence_reviewed", evidenceId, detail: state }, now);
}

export function linkCustomer(client: StoredClient, customerUserId: string, actor: string, now = new Date().toISOString()): StoredClient {
  if (!/^[0-9a-f-]{36}$/i.test(customerUserId)) throw new Error("That is not a user id.");
  return audit({ ...client, customerUserId }, { actor, action: "customer_linked" }, now);
}

export function closeCase(client: StoredClient, actor: string, note: string, now = new Date().toISOString()): StoredClient {
  if (client.closedAt) throw new Error("The case is already closed.");
  const open = client.disputeRounds.filter((r) => ["needs_review", "approved", "sent"].includes(normaliseStatus(r.status)));
  if (open.length > 0) throw new Error("Resolve rounds that are awaiting review, approved or sent before closing.");
  return audit({ ...client, closedAt: now }, { actor, action: "case_closed", detail: note.slice(0, 200) }, now);
}

// ---------------------------------------------------------------------------
// Timeline (C2-16) — one ordered view over the single audit log
// ---------------------------------------------------------------------------

const TIMELINE_LABEL: Record<CreditAuditEvent["action"], string> = {
  client_imported: "Report imported",
  assessment_recorded: "Accuracy call recorded",
  assertion_recorded: "Statement recorded by operator",
  assertion_drafted: "Customer drafted a statement",
  assertion_confirmed: "Customer confirmed their statement",
  assertion_classified: "Operator classified the statement",
  assertion_withdrawn: "Statement withdrawn",
  evidence_recorded: "Document added",
  evidence_reviewed: "Document reviewed",
  round_planned: "Round planned",
  round_generated: "Draft letter generated",
  round_edited: "Draft edited",
  round_approved: "Draft approved",
  round_returned: "Returned for information",
  round_cancelled: "Draft cancelled",
  round_reopened: "Approved letter reopened for review",
  round_marked_sent: "Recorded as sent",
  response_recorded: "Response recorded",
  follow_up_authorized: "Follow-up authorized",
  customer_linked: "Customer account linked",
  case_closed: "Case closed",
};

export interface TimelineEntry {
  at: string;
  seq: number;
  label: string;
  actor: string;
  action: CreditAuditEvent["action"];
  negativeItemId?: string;
  roundId?: string;
  assertionId?: string;
  evidenceId?: string;
}

/** Oldest first; ties keep the order they were written in. */
export function caseTimeline(client: StoredClient): TimelineEntry[] {
  return (client.auditLog ?? [])
    .map((e, seq) => ({
      at: e.at,
      seq,
      label: TIMELINE_LABEL[e.action] ?? e.action,
      actor: e.actor,
      action: e.action,
      negativeItemId: e.negativeItemId,
      roundId: e.roundId,
      assertionId: e.assertionId,
      evidenceId: e.evidenceId,
    }))
    .sort((a, b) => a.at.localeCompare(b.at) || a.seq - b.seq);
}

// ---------------------------------------------------------------------------
// What a customer may see (C2-07) — their own items, statements and documents
// ---------------------------------------------------------------------------

export interface CustomerCaseView {
  clientId: string;
  items: Array<{
    id: string;
    furnisherName: string;
    bureau: string;
    itemType: string;
    accountRef?: string;
    reportedBalanceCents?: number;
    dateReported?: string;
  }>;
  statements: Array<{
    id: string;
    negativeItemId: string;
    category?: IssueCategory;
    statement: string;
    status: CustomerAssertion["status"];
    confirmedAt?: string;
    evidenceIds: string[];
  }>;
  documents: Array<{ id: string; negativeItemId?: string; kind: string; description: string; fileName?: string; uploadedAt: string; reviewState?: string }>;
  statusLabel: CreditCrmStatus;
}

/**
 * The customer's view: no SSN, DOB, address, scores, letters, operator notes,
 * accuracy calls, classifications or other customers' anything.
 */
export function customerCaseView(client: StoredClient, row: CaseQueueRow): CustomerCaseView {
  const mine = (a: CustomerAssertion) => a.source === "customer" && a.status !== "withdrawn";
  return {
    clientId: client.profile.id,
    items: client.negativeItems
      .filter((i) => i.status !== "removed" && i.status !== "closed")
      .map((i) => ({
        id: i.id,
        furnisherName: i.furnisherName,
        bureau: i.bureau,
        itemType: i.itemType,
        ...(i.accountNumberMasked ? { accountRef: i.accountNumberMasked } : {}),
        ...(i.reportedBalanceCents !== undefined ? { reportedBalanceCents: i.reportedBalanceCents } : {}),
        ...(i.dateReported ? { dateReported: i.dateReported } : {}),
      })),
    statements: (client.assertions ?? []).filter(mine).map((a) => ({
      id: a.id,
      negativeItemId: a.negativeItemId,
      category: a.category,
      statement: a.originalStatement ?? a.statement,
      status: a.status,
      confirmedAt: a.confirmation?.confirmedAt,
      evidenceIds: a.evidenceIds,
    })),
    documents: (client.evidence ?? [])
      .filter((e) => e.source === "customer")
      .map((e) => ({
        id: e.id,
        negativeItemId: e.negativeItemId,
        kind: e.kind,
        description: e.description,
        fileName: e.fileName,
        uploadedAt: e.uploadedAt,
        reviewState: e.reviewState,
      })),
    statusLabel: creditCrmStatus(client, row),
  };
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
