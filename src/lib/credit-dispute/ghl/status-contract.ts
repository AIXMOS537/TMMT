/**
 * Credit Center → GHL operational-status contract (C3-016 / C3-017).
 *
 * DESIGN + TESTS ONLY. Nothing here calls GHL, imports a GHL client, or is wired
 * into any sync. It defines the ONLY shape credit information may ever take on its
 * way to a CRM, and a validator that refuses anything else.
 *
 * Allowed: an opaque case reference, one status label, a timestamp, a version.
 * Never: tradelines, report contents, assertion text, letters, evidence,
 * responses, SSN fragments, DOB, names, addresses, amounts, scores.
 *
 * Routing to the right GHL sub-account is the GHL control plane's job (the active
 * M5/M6 track). This contract carries no location id, contact id or pipeline id of
 * its own — the caller that owns routing attaches those, outside this payload.
 */

import { createHash } from "node:crypto";
import type { StoredClient } from "../data/store";
import { normaliseStatus, type CaseQueueRow } from "../engine/case-state";

export const CREDIT_STATUS_CONTRACT_VERSION = "credit-status/1" as const;

export const CREDIT_STATUSES = [
  "CUSTOMER_ACTION_REQUIRED",
  "DOCUMENTS_NEEDED",
  "REVIEW_REQUIRED",
  "CASE_IN_PROGRESS",
  "AWAITING_RESPONSE",
  "CASE_COMPLETED",
] as const;
export type CreditStatus = (typeof CREDIT_STATUSES)[number];

export interface CreditStatusPayload {
  contract: typeof CREDIT_STATUS_CONTRACT_VERSION;
  /** Opaque: sha256 of the case id with a caller-held salt. Not reversible to the customer. */
  caseRef: string;
  status: CreditStatus;
  /** When the status was computed. Date-time only; carries no case facts. */
  asOf: string;
}

/** One label for the case, from state only. Precedence: review > documents > action > awaiting > progress > done. */
export function creditStatusFor(client: StoredClient, row: CaseQueueRow): CreditStatus {
  if (client.closedAt) return "CASE_COMPLETED";
  if (row.roundsAwaitingReview > 0) return "REVIEW_REQUIRED";
  const needsDocs = (client.assertions ?? []).some((a) => a.status === "active" && a.evidenceIds.length === 0) &&
    row.itemsNeedingInformation > 0;
  if (needsDocs) return "DOCUMENTS_NEEDED";
  const drafts = (client.assertions ?? []).some((a) => a.status === "draft");
  if (row.itemsNeedingInformation > 0 || row.followUpsNeedingReason > 0 || drafts) return "CUSTOMER_ACTION_REQUIRED";
  if (client.disputeRounds.some((r) => normaliseStatus(r.status) === "sent")) return "AWAITING_RESPONSE";
  return "CASE_IN_PROGRESS";
}

export function opaqueCaseRef(caseId: string, salt: string): string {
  if (!salt || salt.length < 16) throw new Error("A case-reference salt of at least 16 characters is required.");
  return createHash("sha256").update(`${salt}:${caseId}`, "utf8").digest("hex").slice(0, 32);
}

export function buildCreditStatusPayload(client: StoredClient, row: CaseQueueRow, salt: string, now = new Date().toISOString()): CreditStatusPayload {
  const payload: CreditStatusPayload = {
    contract: CREDIT_STATUS_CONTRACT_VERSION,
    caseRef: opaqueCaseRef(client.profile.id, salt),
    status: creditStatusFor(client, row),
    asOf: now,
  };
  assertStatusOnlyPayload(payload);
  return payload;
}

const ALLOWED_KEYS = new Set(["contract", "caseRef", "status", "asOf"]);

/**
 * Refuse anything that is not exactly the status-only shape. Belt and braces: the
 * key allow-list is the rule; the pattern scan catches a value smuggled into an
 * allowed key.
 */
export function assertStatusOnlyPayload(p: unknown): asserts p is CreditStatusPayload {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Status payload must be an object.");
  const obj = p as Record<string, unknown>;
  const extra = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k));
  if (extra.length) throw new Error(`Status payload may not carry: ${extra.join(", ")}.`);
  if (obj.contract !== CREDIT_STATUS_CONTRACT_VERSION) throw new Error("Unknown contract version.");
  if (typeof obj.caseRef !== "string" || !/^[0-9a-f]{32}$/.test(obj.caseRef)) throw new Error("caseRef must be an opaque 32-hex reference.");
  if (!CREDIT_STATUSES.includes(obj.status as CreditStatus)) throw new Error("Unknown status.");
  if (typeof obj.asOf !== "string" || Number.isNaN(Date.parse(obj.asOf)) || !/^\d{4}-\d{2}-\d{2}T/.test(obj.asOf)) {
    throw new Error("asOf must be an ISO date-time.");
  }
}
