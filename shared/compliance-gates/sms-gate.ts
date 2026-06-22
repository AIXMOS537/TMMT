/**
 * shared/compliance-gates/sms-gate.ts
 *
 * SMS Compliance Gate — implements specs/compliance-sms-gate.md.
 *
 * Blocks promotional/marketing SMS for A2P-restricted verticals
 * (credit_repair, funding, debt_relief, lending) at BOTH send-time and
 * campaign-config time. Restricted verticals are transactional-only.
 *
 * Source of truth for restricted verticals + the hard lock is
 * config/identity.config.json (compliance + feature_flags). Do NOT hardcode
 * the list here, and never flip sms_marketing_credit_funding to enabled.
 *
 * Decisions:
 *   BLOCK — illegal/prohibited; must never send.
 *   HOLD  — allowed in principle but needs owner approval first (ties into
 *           shared/owner-approval-gate). Surface to the owner queue.
 *   ALLOW — may proceed.
 */

import identity from "../../config/identity.config.json";

export type SmsType = "marketing" | "transactional";
export type SmsGateDecision = "ALLOW" | "BLOCK" | "HOLD";

export interface SmsMessage {
  /** Vertical/use-case, e.g. "rentals", "credit_repair", "funding". */
  vertical: string;
  /** Carrier message class. */
  type: SmsType;
  /** True only after an owner has explicitly approved this send. */
  owner_approved?: boolean;
}

export interface SmsGateResult {
  decision: SmsGateDecision;
  reason: string;
}

export class SmsBlockedError extends Error {
  constructor(public reason: string) {
    super(`SMS BLOCKED: ${reason}`);
    this.name = "SmsBlockedError";
  }
}

const RESTRICTED: ReadonlySet<string> = new Set(
  identity.compliance?.sms_restricted_verticals ?? []
);

const MARKETING_HARD_LOCKED: boolean =
  identity.feature_flags?.sms_marketing_credit_funding?.hard_locked === true;

/** A2P-restricted vertical (credit/funding/debt/lending)? */
export function isRestrictedVertical(vertical: string): boolean {
  return RESTRICTED.has(vertical);
}

/** Marketing always terminates at the owner-approval gate (CLAUDE.md §2). */
export function requiresOwnerApproval(msg: SmsMessage): boolean {
  return msg.type === "marketing";
}

/**
 * Evaluate a single SMS. Pure function — safe to call at campaign-config time
 * (validate a campaign's vertical+type) and at send-time (validate the message).
 */
export function evaluateSms(msg: SmsMessage): SmsGateResult {
  const restricted = isRestrictedVertical(msg.vertical);

  if (restricted && msg.type === "marketing") {
    return {
      decision: "BLOCK",
      reason: `Promotional SMS is prohibited for restricted vertical "${msg.vertical}" (A2P 10DLC carrier prohibition on lending/credit/debt + CROA). Transactional-only.`,
    };
  }

  // Defense in depth: the hard lock independently blocks restricted marketing
  // even if the branch above is ever altered.
  if (MARKETING_HARD_LOCKED && restricted && msg.type === "marketing") {
    return {
      decision: "BLOCK",
      reason: `sms_marketing_credit_funding is hard_locked; restricted marketing SMS can never send.`,
    };
  }

  if (requiresOwnerApproval(msg) && !msg.owner_approved) {
    return {
      decision: "HOLD",
      reason: `Marketing SMS requires explicit owner approval before sending (owner-approval gate).`,
    };
  }

  return { decision: "ALLOW", reason: "Permitted." };
}

/**
 * Enforce at send-time. Throws on BLOCK. Returns the decision so callers can
 * route HOLD into the owner-approval queue.
 */
export function assertSmsAllowed(msg: SmsMessage): SmsGateResult {
  const result = evaluateSms(msg);
  if (result.decision === "BLOCK") {
    throw new SmsBlockedError(result.reason);
  }
  return result;
}
