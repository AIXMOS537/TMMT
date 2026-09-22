import type { CreditProfile, DisputeRoundType, NegativeItem, RoundStatus } from "../types";
import type { FactualBasis, ItemAssessment } from "../policy/dispute-policy";
import type { CustomerAssertion, EvidenceRef, RoundResponse, SentRecord } from "../policy/assertion";
import type { FactTrace } from "../letters/render-from-decision";

export type ReportSource = "disputefox" | "myfreescorenow" | "smartcredit";

/** One edit a reviewer made to a draft letter. The text itself is kept on the round. */
export interface RoundEdit {
  editedBy: string;
  editedAt: string;
  /** sha256 of the body before and after, so the audit shows a change without copying PII around. */
  beforeHash: string;
  afterHash: string;
  note?: string;
}

export interface RoundReview {
  decision: "approved" | "returned_for_information" | "cancelled" | "reopened";
  reviewedBy: string;
  reviewedAt: string;
  note?: string;
  /** sha256 of the letter body this decision was made on (C2). An approval covers exactly this text. */
  contentHash?: string;
}

export interface StoredDisputeRound {
  id: string;
  negativeItemId: string;
  roundNumber: number;
  roundType: DisputeRoundType;
  bureau: string;
  /** RoundStatus since C1; older rows may carry "draft" (read as needs_review). */
  status: RoundStatus | string;
  letterSubject: string;
  letterBody: string;
  furnisherName: string;
  createdAt: string;
  // --- C1 provenance (absent on pre-C1 rows) ---
  basis?: FactualBasis;
  assertionId?: string;
  evidenceIds?: string[];
  /** Source of every fact the letter states. */
  trace?: FactTrace[];
  templateVersion?: string;
  generatedBy?: string;
  /** C3: the registry recipient (and version) this letter is addressed to. */
  recipientId?: string;
  recipientVersion?: number;
  /** C3: fingerprint of the exact template wording used (see approvals). */
  templateFingerprint?: string;
  edits?: RoundEdit[];
  /** The CURRENT decision. Superseded decisions move to reviewHistory, never deleted (C2). */
  review?: RoundReview;
  reviewHistory?: RoundReview[];
  /** C2: a person recorded that this exact approved text was sent. */
  sent?: SentRecord;
  response?: RoundResponse;
  /** Rescued from a browser's localStorage: untrusted, proves nothing about history. */
  importedFromBrowser?: boolean;
}

/**
 * An append-only record of who did what on this client (C1). Describes the action
 * and the ids involved — never copies report contents, letter text or identifiers.
 */
export interface CreditAuditEvent {
  at: string;
  actor: string;
  action:
    | "client_imported"
    | "assessment_recorded"
    | "assertion_recorded"
    | "assertion_withdrawn"
    | "evidence_recorded"
    | "round_planned"
    | "round_generated"
    | "round_edited"
    | "round_approved"
    | "round_returned"
    | "round_cancelled"
    | "round_reopened"
    | "round_marked_sent"
    | "response_recorded"
    | "follow_up_authorized"
    | "assertion_drafted"
    | "assertion_confirmed"
    | "assertion_classified"
    | "evidence_reviewed"
    | "customer_linked"
    | "case_closed";
  negativeItemId?: string;
  roundId?: string;
  assertionId?: string;
  evidenceId?: string;
  detail?: string;
}

export interface StoredClient {
  profile: CreditProfile;
  source: ReportSource;
  negativeItems: NegativeItem[];
  disputeRounds: StoredDisputeRound[];
  importedAt: string;
  externalId?: string;
  /**
   * The accuracy call a human made on each item, keyed by negative-item id.
   *
   * Separate from the item itself because it is a JUDGEMENT about the item, made
   * by a named person at a point in time — not a property of the tradeline. It is
   * also the thing the policy gate requires before any letter exists, so it needs
   * to survive a page reload.
   */
  assessments?: Record<string, ItemAssessment>;
  /** C1: what the customer says is wrong, per item (latest active one wins). */
  assertions?: CustomerAssertion[];
  /** C1: supporting-document references. */
  evidence?: EvidenceRef[];
  /** C1: append-only activity log. */
  auditLog?: CreditAuditEvent[];
  /**
   * C2: the customer's own login, linked by an owner. The customer-facing flow
   * finds a case ONLY through this id (never by email), and only when enabled.
   */
  customerUserId?: string;
  /** C2: tenant key (mirrors the staged dispute_clients.org_id). */
  orgId?: string;
  /** C2: set when an owner closes the case. */
  closedAt?: string;
}

/**
 * The old browser key.
 *
 * Client records used to live here and nowhere else — legal name, email, phone,
 * date of birth, social-security last four, address and tri-bureau scores, in
 * localStorage, on whatever machine imported them. They are in the database now
 * (see the server actions beside the credit-dispute pages); this constant
 * survives only so the one-time rescue can find what is still stranded in a
 * browser.
 *
 * Nothing writes to it any more. Once a machine has run the rescue and the
 * count comes back zero, the key can be cleared.
 */
export const LEGACY_STORAGE_KEY = "aix-dispute-clients";

/** Whatever this browser still holds under the old key. Read-only. */
export function readLegacyClients(): StoredClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredClient[]) : [];
  } catch {
    return [];
  }
}

/** Drop the old key. Only call this once the rescue has reported success. */
export function clearLegacyClients(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* a browser that refuses storage has nothing to clear */
  }
}

export function generateId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


/*
 * setItemAssessment / getAssessments / roundsSentByItem used to live here.
 *
 * They read and wrote the whole client record in localStorage - and that
 * record carries legal name, email, phone, date of birth, social-security
 * last four, home address and tri-bureau scores. Storing an accuracy call
 * there meant storing all of it there.
 *
 * They are gone, not moved: their server replacements are
 * recordItemAssessment() in the desk's actions.ts, and the read side needs no
 * function at all because listDisputeClients() already returns `assessments`
 * and `disputeRounds` inside each StoredClient (dispute_clients.payload).
 *
 * Do not reintroduce them. The only localStorage left in this file is the
 * one-way legacy rescue above (readLegacyClients / clearLegacyClients), which
 * exists to empty the old key, never to fill it.
 */
