/**
 * Declined rental applicant → AIXMOS prequal routing.
 *
 * The lane: someone cannot rent a car today, so they are routed to fix the
 * thing blocking them — LLC, credit profile, funding — and come back eligible.
 *
 * The existing AIXMOS funnel is gated on `rental-completed` ("do not send the
 * $97 link until step 5" — docs/GHL-PIPELINE-SETUP.md). That gate is correct
 * for the post-rental upsell and wrong here: a person who never got a car can
 * never satisfy it. This module is the second door, and it deliberately uses a
 * different tag so the two intents do not collide in one pipeline.
 *
 * Two rules this encodes, both learned from the live data:
 *
 *  1. NOT EVERY DECLINE IS A CREDIT PROBLEM. Of 82 declined background checks,
 *     49 are "out of radius" — a geography problem. Selling credit guidance to
 *     someone who lives too far away is wrong, and it reads as spam. Those
 *     people belong on a market-expansion waitlist instead.
 *
 *  2. A HANDOFF IS NOT AUTOMATIC. `request_handoff()` takes a consent channel,
 *     because moving a person between two companies needs their agreement.
 *     This module decides what SHOULD happen and returns the reason; it does
 *     not perform the handoff, and it never returns `handoff` without naming
 *     the consent that must be captured first.
 */

/** GHL tag canon for this lane. Distinct from CREDIT_GHL_TAGS by design. */
export const PREQUAL_GHL_TAGS = {
  /** Declined for a fixable profile reason — enters AIXMOS before ever renting. */
  prequal: "aixmos-prequal",
  /** Declined on geography. Not a credit lead; hold for market expansion. */
  outOfArea: "market-waitlist",
  /** Came back eligible after AIXMOS work — hand back to TMMT. */
  requalified: "tmmt-requalified",
} as const;

export type PrequalAction =
  | "handoff_to_aixmos"
  | "market_waitlist"
  | "await_review"
  | "none";

export interface PrequalDecision {
  action: PrequalAction;
  /** GHL tag to apply, or null when no tag should change. */
  ghlTag: string | null;
  /** Human-readable reason, recorded on the referral. Never a bare status code. */
  reason: string;
  /**
   * Consent that must be captured BEFORE calling request_handoff().
   * Non-null only when action is "handoff_to_aixmos".
   */
  requiresConsent: "sms" | "email" | "verbal" | null;
}

const NO_ACTION: PrequalDecision = {
  action: "none",
  ghlTag: null,
  reason: "",
  requiresConsent: null,
};

/**
 * Normalizes the free-text eligibility_status written by staff. The live column
 * holds "Eligible", "Not Eligible", "out of radius", "Need Manager's Review",
 * "Not found" and NULL — inconsistent casing included, because humans type it.
 */
function normalize(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase().replace(/[’']/g, "'");
}

/**
 * Decide what happens to an applicant based on their eligibility outcome.
 *
 * Pure: no database, no network, no side effects. Wire it to whatever writes
 * `background_checks.eligibility_status` and act on the returned decision.
 */
export function decidePrequalRoute(
  eligibilityStatus: string | null | undefined
): PrequalDecision {
  const s = normalize(eligibilityStatus);

  if (!s) return NO_ACTION;

  // Approved — this person rents. The post-rental upsell lane takes it from
  // here, gated on rental-completed as it already is.
  if (s === "eligible") return NO_ACTION;

  // Geography, not creditworthiness. Do not sell credit guidance to someone
  // whose only problem is distance.
  if (s.includes("out of radius") || s.includes("out of area")) {
    return {
      action: "market_waitlist",
      ghlTag: PREQUAL_GHL_TAGS.outOfArea,
      reason: "Outside the service radius — hold for market expansion, not a credit lead.",
      requiresConsent: null,
    };
  }

  // A human has not finished deciding. Routing now would pre-empt them.
  if (s.includes("review")) {
    return {
      action: "await_review",
      ghlTag: null,
      reason: "Awaiting manager review — no routing until the outcome is set.",
      requiresConsent: null,
    };
  }

  // Declined on the applicant's own profile: background, insurance, or earnings
  // verification. Every one of these is something AIXMOS exists to fix.
  if (s.includes("not eligible") || s.includes("ineligible") || s.includes("declined")) {
    return {
      action: "handoff_to_aixmos",
      ghlTag: PREQUAL_GHL_TAGS.prequal,
      reason:
        "Declined on profile, not geography — route to AIXMOS for LLC, credit and funding work, then re-apply.",
      requiresConsent: "sms",
    };
  }

  // "Not found" means the check could not be run at all — a data problem, not
  // a decision about the person. Treat it as unresolved rather than a decline.
  if (s.includes("not found")) {
    return {
      action: "await_review",
      ghlTag: null,
      reason: "Background check returned no record — re-run the check before routing.",
      requiresConsent: null,
    };
  }

  return NO_ACTION;
}

/**
 * Arguments for `request_handoff(p_source_org, p_dest_org, p_contact_ref,
 * p_reason, p_consent_channel, p_commission_cents)`.
 *
 * Returns null unless the decision actually calls for a handoff AND consent has
 * been captured — the caller cannot accidentally hand a person over by ignoring
 * a field.
 */
export function handoffArgs(args: {
  decision: PrequalDecision;
  contactRef: string;
  consentCapturedVia: "sms" | "email" | "verbal" | null;
}): {
  p_source_org: string;
  p_dest_org: string;
  p_contact_ref: string;
  p_reason: string;
  p_consent_channel: string;
  p_commission_cents: number;
} | null {
  const { decision, contactRef, consentCapturedVia } = args;
  if (decision.action !== "handoff_to_aixmos") return null;
  if (!consentCapturedVia) return null;
  if (!contactRef.trim()) return null;

  return {
    p_source_org: "TMMT RENTALS",
    p_dest_org: "AIXMOS",
    p_contact_ref: contactRef.trim(),
    p_reason: decision.reason,
    p_consent_channel: consentCapturedVia,
    // Internal handoff between the owner's own two companies — no commission.
    p_commission_cents: 0,
  };
}
