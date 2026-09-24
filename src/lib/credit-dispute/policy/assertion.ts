/**
 * Customer assertions — what the CUSTOMER says is wrong, as distinct from what
 * is merely negative.
 *
 * WHY THIS EXISTS
 *
 * A negative item is not a disputable item. A hard inquiry, a late payment or a
 * collection can be perfectly accurate. Before this module the engine blurred the
 * two: the importer flagged items from heuristics, `deep-audit.ts` wrote first-person
 * claims nobody made ("I did not authorize…" on every hard inquiry), and the letter
 * templates filled in history that never happened ("CFPB complaint filed").
 *
 * The rule now: every factual claim a letter makes in the customer's voice must be
 * traceable to one of
 *   1. the credit-report data itself (dates, balances, account references),
 *   2. something the customer said, recorded here with who recorded it and when,
 *   3. an operator entry with provenance (evidence reference, recorded response),
 *   4. the stored round history (what we actually sent and what came back).
 *
 * If a required fact is absent the answer is NEEDS_INFORMATION, never prose.
 *
 * Nothing here decides WHETHER to dispute — that is still `dispute-policy.ts`. This
 * file defines the records the policy now requires and the check it runs.
 */

import type { DisputeRoundType } from "../types";
import type { FactualBasis } from "./dispute-policy";

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/** Who put the words on the record. */
export type AssertionSource =
  /** The customer said it (in person, on a call, in writing) and an operator recorded it. */
  | "customer"
  /** An operator's own reading of a document. Never enough on its own for a first-person letter. */
  | "operator";

/**
 * What the customer says is wrong, in their terms (C2). A classification aid only:
 * choosing a category never supplies a fact. Categories with one obvious ground map
 * to a FactualBasis; the rest need an operator to classify before any letter.
 */
export type IssueCategory =
  | "NOT_MINE"
  | "IDENTITY_THEFT"
  | "ACCOUNT_DETAILS_INCORRECT"
  | "BALANCE_INCORRECT"
  | "PAYMENT_HISTORY_INCORRECT"
  | "STATUS_INCORRECT"
  | "DUPLICATE"
  | "INQUIRY_NOT_RECOGNIZED"
  | "DATE_INCORRECT"
  | "OTHER";

export const CATEGORY_BASIS: Record<IssueCategory, FactualBasis | undefined> = {
  NOT_MINE: "not_mine",
  IDENTITY_THEFT: "identity_theft",
  ACCOUNT_DETAILS_INCORRECT: undefined, // an operator decides which field and which ground
  BALANCE_INCORRECT: "wrong_balance",
  PAYMENT_HISTORY_INCORRECT: "never_late",
  STATUS_INCORRECT: "wrong_status",
  DUPLICATE: "duplicate",
  INQUIRY_NOT_RECOGNIZED: "no_permissible_purpose",
  DATE_INCORRECT: "wrong_dates",
  OTHER: undefined,
};

/** The moment a customer adopts an assertion. Written once, never edited. */
export interface AssertionConfirmation {
  confirmedAt: string;
  /** Who performed the confirmation: the customer's own account, or the operator attesting to it. */
  actor: string;
  channel: "customer_portal" | "operator_attested";
  /** sha256 of the exact original statement confirmed. */
  statementHash: string;
  category?: IssueCategory;
  negativeItemId: string;
}

export interface CustomerAssertion {
  id: string;
  negativeItemId: string;
  /**
   * The ground the policy works with. From the customer's category where the map is
   * 1:1, otherwise from an operator's classification (see `classification`).
   * Undefined until one of those exists.
   */
  basis?: FactualBasis;
  /** The customer's category, when they chose one themselves (C2). */
  category?: IssueCategory;
  /** The customer's explanation in their own words. Required, never generated. */
  statement: string;
  /** Exactly what the customer wrote, kept separately and never rewritten (C2). */
  originalStatement?: string;
  source: AssertionSource;
  /**
   * The customer confirmed this is their claim. Letters are written in the first
   * person, so without this confirmation nothing may be said in their name.
   * (Kept for C1 records; C2 records also carry `confirmation`.)
   */
  customerConfirmed: boolean;
  confirmation?: AssertionConfirmation;
  /** An operator mapping a broad category onto a specific ground. Never changes the customer's words. */
  classification?: { basis: FactualBasis; by: string; at: string; note?: string };
  /** Evidence ids supporting the claim (see EvidenceRef). */
  evidenceIds: string[];
  recordedBy: string;
  recordedAt: string;
  /** `draft` = written by the customer, not yet confirmed; nothing is written from a draft. */
  status: "draft" | "active" | "withdrawn";
}

export type EvidenceKind =
  | "identity_theft_report"
  | "payment_record"
  | "account_statement"
  | "settlement_letter"
  | "bankruptcy_discharge"
  | "correspondence"
  | "credit_report_copy"
  | "id_document"
  | "other";

export const EVIDENCE_KINDS: readonly EvidenceKind[] = [
  "identity_theft_report",
  "payment_record",
  "account_statement",
  "settlement_letter",
  "bankruptcy_discharge",
  "correspondence",
  "credit_report_copy",
  "id_document",
  "other",
];

/**
 * A reference to a supporting document. Metadata only in C1: there is no file
 * store for credit evidence yet (see CREDIT_CASE_MODEL.md). `storagePath` is a
 * private-bucket object path when one exists — never a public URL.
 */
export interface EvidenceRef {
  id: string;
  kind: EvidenceKind;
  /** What the document is, e.g. "Bank statement showing the March payment". No values from it. */
  description: string;
  negativeItemId?: string;
  assertionId?: string;
  roundId?: string;
  storagePath?: string;
  sha256?: string;
  source: "customer" | "operator";
  uploadedBy: string;
  uploadedAt: string;
  // --- C2 file metadata (absent for reference-only records) ---
  /** Sanitised display name only; the object key never uses it. */
  fileName?: string;
  /** The type the file's bytes were sniffed as — not what the browser claimed. */
  mime?: string;
  sizeBytes?: number;
  /** An operator's look at the document. Pending until someone checks it. */
  reviewState?: "pending_review" | "accepted" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
}

/** A person recorded that an approved round was mailed/submitted. Nothing here sends anything. */
export type SendMethod = "mail" | "certified_mail" | "fax" | "online_portal" | "hand_delivered" | "other";

export interface SentRecord {
  sentAt: string;
  method: SendMethod;
  recipient: string;
  /** Only what the operator typed from a real receipt. Never generated. */
  trackingRef?: string;
  recordedBy: string;
  recordedAt: string;
  /** sha256 of the letter body exactly as approved and sent. */
  contentHash: string;
}

/** What a bureau or furnisher said back. Recorded by a person from a real document. */
export type ResponseOutcome =
  | "deleted"
  | "corrected"
  | "updated"
  | "verified"
  | "no_change"
  | "no_response"
  | "frivolous"
  | "unknown";

export interface RoundResponse {
  outcome: ResponseOutcome;
  /** Who answered: the bureau, the furnisher, the collector (C2). */
  respondingParty?: string;
  /** Short factual summary of what the response said. */
  summary: string;
  receivedAt: string;
  recordedBy: string;
  recordedAt: string;
  /** Evidence id of the response document, if filed. */
  documentEvidenceId?: string;
  /**
   * The documented reason a follow-up round is justified. Required before any
   * further round for this item — a result the customer did not like is not one.
   */
  followUpReason?: string;
  followUpAuthorizedBy?: string;
  followUpAuthorizedAt?: string;
}

/**
 * Reasons that restate the outcome instead of giving a basis. A follow-up needs a
 * reason that says what the response got wrong or left unanswered.
 */
const EMPTY_REASONS = [
  /^(previous|prior|last|first)?\s*(round|dispute|letter)?\s*(was\s+)?(unsuccessful|not successful|failed|didn'?t work|did not work)\.?$/i,
  /^(still|it'?s still|item (is )?still)\s+(there|on (the )?report|reporting|showing)\.?$/i,
  /^(not|wasn'?t|was not)\s+(removed|deleted|fixed)\.?$/i,
  /^(no change|verified|try again|resend|escalate|round \d+)\.?$/i,
];

/** Is this a documented basis for another round, or just "it didn't work"? */
export function isSubstantiveFollowUpReason(reason: string | undefined): boolean {
  const r = (reason ?? "").trim();
  if (r.length < 20) return false;
  return !EMPTY_REASONS.some((re) => re.test(r));
}

/** Round history for one item, oldest first, as the policy needs it. */
export interface ItemRoundHistory {
  roundId: string;
  roundType: DisputeRoundType;
  roundNumber: number;
  status: string;
  response?: RoundResponse;
}

/** Everything the policy may rely on beyond the report and the accuracy call. */
export interface DecisionContext {
  assertion?: CustomerAssertion;
  evidence?: EvidenceRef[];
  /** This item's rounds, oldest first. Cancelled / returned rounds excluded. */
  history?: ItemRoundHistory[];
}

// ---------------------------------------------------------------------------
// Missing facts
// ---------------------------------------------------------------------------

export type MissingFactCode =
  | "accuracy_call"
  | "factual_basis"
  | "customer_assertion"
  | "customer_confirmation"
  | "assertion_basis_mismatch"
  | "customer_statement"
  | "identity_theft_report"
  | "reinsertion_evidence"
  | "prior_dispute_record"
  | "prior_verified_response"
  | "prior_response"
  | "follow_up_reason"
  | "report_dates"
  | "operator_classification";

export interface MissingFact {
  code: MissingFactCode;
  /** Plain words for the operator: what to go and get. */
  message: string;
}

const MESSAGES: Record<MissingFactCode, string> = {
  accuracy_call: "Record whether this item is accurate.",
  factual_basis: "Record the specific problem with this item.",
  customer_assertion: "Ask the customer what is wrong with this item and record it in their words.",
  customer_confirmation: "The customer has to confirm this is what they are saying before anything is written in their name.",
  assertion_basis_mismatch: "The customer's stated problem and the accuracy call disagree. Reconcile them first.",
  customer_statement: "Record the customer's explanation in their own words.",
  identity_theft_report: "Attach the identity theft report (FTC/police) before an identity-theft dispute.",
  reinsertion_evidence: "Attach proof the item was deleted before and reinserted.",
  prior_dispute_record: "There is no recorded earlier dispute for this item.",
  prior_verified_response: "There is no recorded response saying this item was verified.",
  prior_response: "The last round for this item has no recorded response yet.",
  follow_up_reason: "Record why a follow-up round is justified. A result the customer did not like is not a reason.",
  report_dates: "The report has no dates for this item, so its reporting period cannot be checked.",
  operator_classification: "The customer's category is broad. An operator has to decide which specific ground it is before anything is written.",
};

export function missing(code: MissingFactCode): MissingFact {
  return { code, message: MESSAGES[code] };
}

// ---------------------------------------------------------------------------
// Requirements per basis
// ---------------------------------------------------------------------------

/**
 * Grounds that rest on the REPORT DATA alone. The claim ("older than the period it
 * may be reported") is derived from report dates, not from anything the customer
 * says, so no assertion is required.
 */
export const REPORT_DERIVED_BASES: ReadonlySet<FactualBasis> = new Set<FactualBasis>(["obsolete"]);

/** Grounds that cannot be stated without a supporting document of a specific kind. */
const EVIDENCE_REQUIRED: Partial<Record<FactualBasis, { kinds: EvidenceKind[]; code: MissingFactCode }>> = {
  identity_theft: { kinds: ["identity_theft_report"], code: "identity_theft_report" },
  reinserted_without_notice: {
    kinds: ["credit_report_copy", "correspondence", "other"],
    code: "reinsertion_evidence",
  },
};

/** Grounds that assert something about OUR OWN earlier rounds. */
const HISTORY_REQUIRED: Partial<Record<FactualBasis, MissingFactCode>> = {
  unverifiable: "prior_verified_response",
  dispute_not_notated: "prior_dispute_record",
};

/** The ground an assertion supports: an operator's classification wins over the category map. */
export function effectiveBasis(a: CustomerAssertion): FactualBasis | undefined {
  return a.classification?.basis ?? a.basis ?? (a.category ? CATEGORY_BASIS[a.category] : undefined);
}

/**
 * What is missing before a letter on this basis may be written in the customer's
 * name. Empty array = grounded.
 */
export function checkAssertionRequirements(basis: FactualBasis, ctx: DecisionContext = {}): MissingFact[] {
  if (REPORT_DERIVED_BASES.has(basis)) return [];

  const out: MissingFact[] = [];
  const a = ctx.assertion;

  if (!a || a.status !== "active") {
    out.push(missing("customer_assertion"));
  } else {
    const effective = effectiveBasis(a);
    if (!effective) out.push(missing("operator_classification"));
    else if (effective !== basis) out.push(missing("assertion_basis_mismatch"));
    if (!a.statement || a.statement.trim().length < 3) out.push(missing("customer_statement"));
    if (a.source !== "customer" || !a.customerConfirmed) out.push(missing("customer_confirmation"));
  }

  const ev = EVIDENCE_REQUIRED[basis];
  if (ev) {
    const has = (ctx.evidence ?? []).some(
      (e) => ev.kinds.includes(e.kind) && (!a || (a.evidenceIds ?? []).includes(e.id) || e.assertionId === a?.id)
    );
    if (!has) out.push(missing(ev.code));
  }

  const hist = HISTORY_REQUIRED[basis];
  if (hist === "prior_verified_response") {
    const verified = (ctx.history ?? []).some((h) => h.response?.outcome === "verified");
    if (!verified) out.push(missing(hist));
  } else if (hist === "prior_dispute_record") {
    const sent = (ctx.history ?? []).some((h) => ["sent", "response_received", "closed"].includes(h.status));
    if (!sent) out.push(missing(hist));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Round progression — no automatic escalation
// ---------------------------------------------------------------------------

export type ProgressVerdict =
  | { kind: "first_round" }
  | { kind: "follow_up_allowed"; basis: RoundResponse }
  | { kind: "in_progress"; roundNumber: number; status: string }
  | { kind: "resolved"; outcome: ResponseOutcome }
  | { kind: "needs_information"; missing: MissingFact[] };

/**
 * May another round be written for this item at all?
 *
 * A follow-up needs (a) a recorded response to the last round and (b) a documented
 * reason. "The item is still there" is not a reason by itself; the reason says what
 * the response got wrong or left unanswered.
 */
export function roundProgress(history: ItemRoundHistory[] = []): ProgressVerdict {
  if (history.length === 0) return { kind: "first_round" };
  const last = history[history.length - 1];
  if (!last.response) {
    if (last.status === "needs_review" || last.status === "approved" || last.status === "sent") {
      return { kind: "in_progress", roundNumber: last.roundNumber, status: last.status };
    }
    return { kind: "needs_information", missing: [missing("prior_response")] };
  }
  if (["deleted", "corrected", "updated"].includes(last.response.outcome)) {
    return { kind: "resolved", outcome: last.response.outcome };
  }
  if (!isSubstantiveFollowUpReason(last.response.followUpReason)) {
    return { kind: "needs_information", missing: [missing("follow_up_reason")] };
  }
  return { kind: "follow_up_allowed", basis: last.response };
}
