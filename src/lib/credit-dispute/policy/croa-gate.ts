/**
 * CROA gate — what must be true before a credit-repair engagement may start,
 * and before a dollar may be collected for it.
 *
 * WHY THIS EXISTS
 *
 * The owner has chosen to perform credit repair in-house rather than refer it
 * out. That is his decision to make, and it is made. What follows from it is not
 * a matter of preference: performing credit repair for a fee makes the business a
 * Credit Repair Organization under the Credit Repair Organizations Act, and CROA
 * attaches specific duties.
 *
 * Three of the company's own documents already say this — the Credit-to-Keys
 * ecosystem design, the compliant marketing rewrite, and the RIDER-1 exhibit,
 * which puts it plainest:
 *
 *   "You do not get paid up front for credit repair. Not a deposit, not a
 *    'setup fee', not a 'consultation fee' that's really a down payment, not a
 *    first-month charge."
 *
 * This module turns that into something the software enforces rather than
 * something a document asserts.
 *
 * WHAT IT FOUND ALREADY IN PLACE
 *
 * `credit_education_acknowledgments` exists and is correctly shaped. But the three
 * rows in `credit_education_sections` are marketing copy — "your credit score
 * affects rental rates", "active rental + credit path unlock lease-to-own" —
 * not disclosures. Acknowledging them proves nothing about CROA compliance, so
 * this module distinguishes the two and counts only the second.
 *
 * ⚠️ WHAT THIS MODULE DOES NOT DO
 *
 * It does not contain the disclosure text. The "Consumer Credit File Rights Under
 * State and Federal Law" statement is statutorily worded, and drafting it here
 * and calling it compliant would be exactly the sort of quiet implementation the
 * project rules forbid. The structure is here; the words are `[OPEN]` and need an
 * attorney. `REQUIRED_DISCLOSURES` names what must exist, not what it says.
 */

// ---------------------------------------------------------------------------
// What CROA requires, as a checklist
// ---------------------------------------------------------------------------

export type DisclosureId =
  /** The statutory "Consumer Credit File Rights Under State and Federal Law" statement. */
  | "consumer_credit_file_rights"
  /** The written contract itself: services, total cost, timeframe, guarantees. */
  | "written_contract"
  /** Notice of the right to cancel within 3 business days, with the form to do it. */
  | "right_to_cancel";

export interface DisclosureRequirement {
  id: DisclosureId;
  title: string;
  /** Why it is required. Not the text of the disclosure itself. */
  note: string;
  /** Must be acknowledged BEFORE the contract is signed, not alongside it. */
  beforeContract: boolean;
}

export const REQUIRED_DISCLOSURES: DisclosureRequirement[] = [
  {
    id: "consumer_credit_file_rights",
    title: "Consumer Credit File Rights Under State and Federal Law",
    note:
      "Separate written statement, provided and acknowledged BEFORE any contract is signed. Statutorily worded — [OPEN] text pending counsel.",
    beforeContract: true,
  },
  {
    id: "written_contract",
    title: "Written services contract",
    note:
      "Dated, signed. States the services, the total cost, the timeframe, and any guarantees. [OPEN] template pending counsel.",
    beforeContract: false,
  },
  {
    id: "right_to_cancel",
    title: "Notice of the right to cancel",
    note:
      "Three business days, no penalty, with the cancellation form supplied. [OPEN] text pending counsel.",
    beforeContract: false,
  },
];

/**
 * Business days for the cancellation window.
 *
 * Deliberately a simple weekday count with no holiday calendar: a holiday would
 * make the real window LONGER, so counting only weekends errs toward giving the
 * consumer more time rather than less. Erring the other way would be the problem.
 */
export function cancellationDeadline(signedAt: Date, businessDays = 3): Date {
  const d = new Date(signedAt.getTime());
  let remaining = businessDays;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isWithinCancellationWindow(signedAt: Date, now: Date = new Date()): boolean {
  return now <= cancellationDeadline(signedAt);
}

// ---------------------------------------------------------------------------
// State of an engagement
// ---------------------------------------------------------------------------

export interface EngagementState {
  /** Disclosure ids the consumer has acknowledged, with timestamps. */
  acknowledged: Partial<Record<DisclosureId, string>>;
  /** When the services contract was signed. */
  contractSignedAt?: string;
  /** Whether the consumer has cancelled. */
  cancelledAt?: string;
  /**
   * Services actually completed and evidenced — e.g. letters sent, responses
   * received, items resolved. CROA turns on performance, not elapsed time.
   */
  servicesPerformed: Array<{ description: string; completedAt: string; evidenceRef?: string }>;
}

export interface GateResult {
  allowed: boolean;
  /** Plain-English reason. Safe to show staff or an auditor. */
  reason: string;
  /** What needs to happen to clear the gate. */
  blockers: string[];
  ruleId: string;
}

// ---------------------------------------------------------------------------
// The gates
// ---------------------------------------------------------------------------

/** May the engagement begin — i.e. may work start? */
export function canBeginWork(state: EngagementState, now: Date = new Date()): GateResult {
  const blockers: string[] = [];

  for (const d of REQUIRED_DISCLOSURES) {
    if (!state.acknowledged[d.id]) blockers.push(`${d.title} not acknowledged`);
  }

  if (!state.contractSignedAt) blockers.push("Services contract not signed");

  // Order matters: the rights statement must precede the contract, not accompany it.
  const rights = state.acknowledged.consumer_credit_file_rights;
  if (rights && state.contractSignedAt && new Date(rights) > new Date(state.contractSignedAt)) {
    blockers.push(
      "Consumer Credit File Rights was acknowledged AFTER the contract was signed — it must come before"
    );
  }

  if (state.cancelledAt) blockers.push("The consumer cancelled this engagement");

  if (blockers.length > 0) {
    return {
      allowed: false,
      reason: "The engagement cannot begin until the required disclosures and contract are in place.",
      blockers,
      ruleId: "croa-preconditions",
    };
  }

  void now;
  return {
    allowed: true,
    reason: "Disclosures acknowledged and contract signed.",
    blockers: [],
    ruleId: "croa-cleared-to-begin",
  };
}

/**
 * May money be collected?
 *
 * This is the one that matters, and it is stricter than "has the customer
 * agreed". Under CROA no fee may be collected for credit-repair services until
 * those services are **fully performed**. A monthly membership that bundles
 * done-for-you repair and bills on day one is the pattern the company's own
 * documents name as the violation.
 *
 * Education sold separately is a different product and is not gated here.
 */
export function canCollectFee(state: EngagementState, now: Date = new Date()): GateResult {
  const begin = canBeginWork(state, now);
  if (!begin.allowed) {
    return { ...begin, reason: "Cannot bill: the engagement has not properly begun.", ruleId: "croa-billing-preconditions" };
  }

  const blockers: string[] = [];

  if (state.contractSignedAt && isWithinCancellationWindow(new Date(state.contractSignedAt), now)) {
    const deadline = cancellationDeadline(new Date(state.contractSignedAt));
    blockers.push(
      `Still inside the 3-business-day cancellation window (until ${deadline.toISOString().slice(0, 10)})`
    );
  }

  if (state.servicesPerformed.length === 0) {
    blockers.push("No services have been performed yet — CROA prohibits collecting a fee in advance");
  }

  if (blockers.length > 0) {
    return {
      allowed: false,
      reason:
        "No fee may be collected for credit-repair work until that work is fully performed and the cancellation window has closed.",
      blockers,
      ruleId: "croa-no-advance-fee",
    };
  }

  return {
    allowed: true,
    reason: `Services performed (${state.servicesPerformed.length}) and the cancellation window has closed.`,
    blockers: [],
    ruleId: "croa-cleared-to-bill",
  };
}

/**
 * A single readable status for the desk.
 *
 * Returns the strictest thing that is true, because that is what a person needs
 * to see first.
 */
export function engagementStatus(state: EngagementState, now: Date = new Date()): string {
  if (state.cancelledAt) return "Cancelled by the consumer";
  const bill = canCollectFee(state, now);
  if (bill.allowed) return "Cleared to bill";
  const begin = canBeginWork(state, now);
  if (begin.allowed) return `Work may proceed — not yet billable: ${bill.blockers[0]}`;
  return `Not started: ${begin.blockers[0]}`;
}
