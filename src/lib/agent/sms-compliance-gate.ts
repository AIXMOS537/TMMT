/**
 * SMS Compliance Gate — A2P 10DLC + CROA enforcement.
 *
 * Spec: specs/compliance-sms-gate.md
 * Source of truth for the restricted set + hard-lock: config/identity.config.json
 *   → compliance.sms_restricted_verticals / feature_flags.sms_marketing_credit_funding.
 *
 * Carriers (and CROA for credit) prohibit PROMOTIONAL SMS on lending/credit/debt
 * verticals. Those verticals are transactional-only or off-channel. This gate is the
 * structural block: it runs at SMS send-time (sendSms) and should also run at
 * campaign-config time before any restricted-vertical campaign is enabled.
 */

export type SmsMessageType = "marketing" | "transactional";
export type GateDecision = "ALLOW" | "BLOCK" | "HOLD";

/**
 * Restricted verticals — mirrors config/identity.config.json →
 * compliance.sms_restricted_verticals. Promotional SMS here is prohibited.
 */
export const SMS_RESTRICTED_VERTICALS = [
  "credit_repair",
  "funding",
  "debt_relief",
  "lending",
] as const;

/**
 * Hard lock — mirrors config/identity.config.json →
 * feature_flags.sms_marketing_credit_funding.hard_locked. While true, marketing
 * SMS on a restricted vertical is blocked even if some other flag would allow it.
 */
export const SMS_MARKETING_CREDIT_FUNDING_HARD_LOCKED = true;

/**
 * Maps internal vertical slugs (src/lib/verticals/registry.ts) to the restricted
 * compliance categories above. Keeps the gate correct when callers pass a product
 * slug rather than a raw compliance category.
 */
const SLUG_TO_RESTRICTED_CATEGORY: Record<string, (typeof SMS_RESTRICTED_VERTICALS)[number]> = {
  "moe-legacy": "funding", // credit guidance & business funding — restricted
  "credit-to-keys": "funding",
};

export interface SmsGateInput {
  /** Vertical slug or compliance category. Null/undefined → treated as unrestricted. */
  vertical?: string | null;
  /** Defaults to "transactional" (the safe default) when omitted. */
  messageType?: SmsMessageType;
  /** Whether this action needs owner approval (customer-facing/financial). */
  requiresOwnerApproval?: boolean;
  /** Whether the owner has approved this specific action. */
  ownerApproved?: boolean;
}

export interface SmsGateResult {
  decision: GateDecision;
  reason: string;
}

/** True when the given vertical (slug or category) is SMS-restricted. */
export function isRestrictedVertical(vertical?: string | null): boolean {
  if (!vertical) return false;
  const v = vertical.trim().toLowerCase();
  if ((SMS_RESTRICTED_VERTICALS as readonly string[]).includes(v)) return true;
  return v in SLUG_TO_RESTRICTED_CATEGORY;
}

/**
 * Evaluate an outbound SMS against the compliance gate.
 *
 *   restricted + marketing            → BLOCK (carrier + CROA; hard-locked)
 *   requiresOwnerApproval && !approved → HOLD
 *   otherwise                          → ALLOW
 */
export function evaluateSmsCompliance(input: SmsGateInput): SmsGateResult {
  const messageType: SmsMessageType = input.messageType ?? "transactional";

  if (isRestrictedVertical(input.vertical) && messageType === "marketing") {
    return {
      decision: "BLOCK",
      reason:
        "A2P 10DLC carrier prohibition + CROA: no promotional SMS on " +
        "credit/funding/debt/lending verticals (transactional-only or off-channel).",
    };
  }

  if (input.requiresOwnerApproval && !input.ownerApproved) {
    return {
      decision: "HOLD",
      reason: "Owner-approval gate: customer-facing/financial action awaiting owner approval.",
    };
  }

  return { decision: "ALLOW", reason: "Permitted." };
}
