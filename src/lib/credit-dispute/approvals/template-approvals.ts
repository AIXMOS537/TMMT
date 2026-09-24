/**
 * Attorney-gate approval records (C3-013 / C3-014) — pure.
 *
 * The CROA gate (`croa_contracts_attorney_approved`) is still CLOSED, and this
 * module does not open it. It replaces the implicit "flip a JSON flag and deploy"
 * approval with a durable record, and adds a second, independent requirement for
 * the day the gate opens: every template a round would use must carry an ACTIVE
 * approval for its EXACT current wording.
 *
 *   - An approval names: template id, template version, content fingerprint (sha256
 *     of a fixed specimen of the wording + the ground sentences), gate, scope
 *     (optional jurisdictions), approver, time, review/expiry date, reference, notes.
 *   - Approval of fingerprint A never covers fingerprint B. Any material wording
 *     change produces a new fingerprint, so the template is unapproved until a
 *     person approves the new text.
 *   - Records are appended; revocation is a status change, never a deletion.
 *   - Only a person can approve. Agent / AI actors are refused.
 */

import { createHash } from "node:crypto";
import type { DisputeRoundType } from "../types";
import { templateSpecimen } from "../letters/generator";
import { BASIS_STATEMENT, LETTER_TEMPLATE_VERSION } from "../letters/render-from-decision";

export const CROA_GATE = "croa_contracts_attorney_approved" as const;

export const APPROVABLE_TEMPLATES: readonly DisputeRoundType[] = [
  "initial_611",
  "method_of_verification",
  "factual_confrontation",
  "furnisher_623",
  "fdcpa_validation",
  "cfpb_escalation",
  // intent_to_litigate is deliberately NOT approvable here. Its builder carries its
  // own requireGate() and it threatens legal action in the customer's name; it stays
  // unapprovable (so it can never render) until counsel settles it separately.
];

export interface TemplateApproval {
  id: string;
  templateId: string; // "letter:<roundType>"
  templateVersion: string;
  contentHash: string;
  gate: typeof CROA_GATE;
  scope: { jurisdictions?: string[] };
  approver: string;
  approvedAt: string;
  reviewBy?: string;
  expiresAt?: string;
  /** Pointer to the signed counsel document held off-repo. Never the document itself. */
  reference: string;
  notes?: string;
  status: "active" | "revoked";
  revokedBy?: string;
  revokedAt?: string;
}

const DATE_WORDS = /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g;

/** Specimen text with today's date removed, so the fingerprint only moves when the wording does. */
export function normalisedSpecimen(roundType: DisputeRoundType, specimen = templateSpecimen): string {
  return specimen(roundType).replace(DATE_WORDS, "[DATE]").replace(/\r\n/g, "\n");
}

export function fingerprintText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** The fingerprint an approval must match for this template today. */
export function templateFingerprint(roundType: DisputeRoundType, specimen = templateSpecimen): string {
  return fingerprintText(
    JSON.stringify({
      templateVersion: LETTER_TEMPLATE_VERSION,
      templateId: `letter:${roundType}`,
      specimen: normalisedSpecimen(roundType, specimen),
      groundSentences: BASIS_STATEMENT,
    })
  );
}

export type ApprovalCheck =
  | { ok: true; approval: TemplateApproval }
  | { ok: false; reason: "no_approval" | "wording_changed" | "expired" | "revoked" | "out_of_scope" | "review_overdue" };

/**
 * Is this template approved for use now? `fingerprint` is the template's CURRENT
 * fingerprint (computed by the caller from the shipped code).
 */
export function checkTemplateApproval(
  approvals: readonly TemplateApproval[],
  roundType: DisputeRoundType,
  fingerprint: string,
  opts: { now?: string; jurisdiction?: string } = {}
): ApprovalCheck {
  const now = opts.now ?? new Date().toISOString();
  const forTemplate = approvals.filter((a) => a.templateId === `letter:${roundType}` && a.gate === CROA_GATE);
  if (forTemplate.length === 0) return { ok: false, reason: "no_approval" };
  const exact = forTemplate.filter((a) => a.contentHash === fingerprint && a.templateVersion === LETTER_TEMPLATE_VERSION);
  if (exact.length === 0) return { ok: false, reason: "wording_changed" };
  const active = exact.filter((a) => a.status === "active");
  if (active.length === 0) return { ok: false, reason: "revoked" };
  const inDate = active.filter((a) => !a.expiresAt || now < a.expiresAt);
  if (inDate.length === 0) return { ok: false, reason: "expired" };
  const reviewed = inDate.filter((a) => !a.reviewBy || now < a.reviewBy);
  if (reviewed.length === 0) return { ok: false, reason: "review_overdue" };
  const scoped = reviewed.filter(
    (a) => !a.scope.jurisdictions?.length || (opts.jurisdiction && a.scope.jurisdictions.includes(opts.jurisdiction))
  );
  if (scoped.length === 0) return { ok: false, reason: "out_of_scope" };
  return { ok: true, approval: scoped.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))[0] };
}

function isAgent(actor: string): boolean {
  return /^(ai|agent|aixmos|system)[:_-]/i.test(actor);
}

/** Record an approval of the CURRENT wording. Append-only. */
export function recordTemplateApproval(
  approvals: readonly TemplateApproval[],
  input: {
    id: string;
    roundType: DisputeRoundType;
    fingerprint: string;
    reference: string;
    approver: string;
    jurisdictions?: string[];
    reviewBy?: string;
    expiresAt?: string;
    notes?: string;
  },
  currentFingerprint: string,
  now = new Date().toISOString()
): TemplateApproval[] {
  if (!APPROVABLE_TEMPLATES.includes(input.roundType)) throw new Error("Unknown template.");
  if (isAgent(input.approver)) throw new Error("Only a person can approve a template.");
  if (!input.reference?.trim() || input.reference.trim().length < 6) {
    throw new Error("Give the reference of the signed counsel approval.");
  }
  if (input.fingerprint !== currentFingerprint) {
    throw new Error("That approval is for different wording than the template now in the code.");
  }
  if (input.expiresAt && input.expiresAt <= now) throw new Error("An approval cannot already be expired.");
  if (approvals.some((a) => a.id === input.id)) throw new Error("Approval id already exists.");
  return [
    ...approvals,
    {
      id: input.id,
      templateId: `letter:${input.roundType}`,
      templateVersion: LETTER_TEMPLATE_VERSION,
      contentHash: input.fingerprint,
      gate: CROA_GATE,
      scope: input.jurisdictions?.length ? { jurisdictions: [...input.jurisdictions] } : {},
      approver: input.approver,
      approvedAt: now,
      ...(input.reviewBy ? { reviewBy: input.reviewBy } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      reference: input.reference.trim().slice(0, 200),
      ...(input.notes ? { notes: input.notes.slice(0, 1000) } : {}),
      status: "active",
    },
  ];
}

export function revokeTemplateApproval(
  approvals: readonly TemplateApproval[],
  id: string,
  actor: string,
  now = new Date().toISOString()
): TemplateApproval[] {
  if (isAgent(actor)) throw new Error("Only a person can revoke a template approval.");
  if (!approvals.some((a) => a.id === id)) throw new Error("Approval not found.");
  return approvals.map((a) => (a.id === id ? { ...a, status: "revoked" as const, revokedBy: actor, revokedAt: now } : a));
}
