/**
 * Good standing on the lease-to-own journey — and what knocks someone off it.
 *
 * Owner, 2026-09-16:
 *   "The lease-to-own journey is clients renting until they can get approved for financing,
 *    unless they get disqualified if they miss a payment, and/or are reluctant to catch up
 *    on any other tolls or payments and such things of that nature, or don't show up for
 *    routine inspections of the vehicle to confirm it is still in good standing condition
 *    and working order."
 *
 * That settles the earlier open question: TMMT is NOT the creditor. The renter rents while
 * working toward a LENDER's approval. Nothing here creates a credit obligation.
 *
 * ── THREE DISQUALIFIERS, AND THE HONESTY EACH ONE NEEDS ──────────────────────────────
 *
 * 1. MISSED PAYMENT
 * 2. UNPAID TOLLS / OTHER OBLIGATIONS — note the owner's word: "RELUCTANT to catch up".
 *    Owing money is not the failure; refusing to deal with it is. So an open balance opens
 *    a CURE WINDOW, and only an uncured balance counts against the renter. Someone who got
 *    a toll yesterday has not failed anything.
 * 3. MISSED ROUTINE INSPECTION — not showing up, not failing one. A vehicle that fails an
 *    inspection is a maintenance event; a renter who never brings it in is the risk.
 *
 * ── THE RULE THAT GOVERNS ALL THREE: A CONTROL THAT CANNOT SEE MUST NOT CONVICT ──────
 * Verified in production 2026-09-16: of 308 `tickets`, **ZERO** carry `customer_linked`,
 * ZERO carry `date_closed`, and `total_customer_ticket_balance` holds exactly one distinct
 * value across every row. The toll rule is therefore UNENFORCEABLE today — not "everyone
 * passes" and not "everyone fails". Either of those would be a fabricated verdict on
 * somebody's path to owning a car.
 *
 * So every check returns `clear` | `breach` | `unenforceable`, and `unenforceable` NEVER
 * costs the renter anything. It is reported loudly instead, so the gap gets fixed rather
 * than silently deciding people's futures.
 */

export type CheckState = "clear" | "breach" | "unenforceable";

export type StandingCheck = {
  key: "payments" | "obligations" | "inspections" | "restriction_list";
  label: string;
  state: CheckState;
  /** Customer-safe. Says what happened and what fixes it. */
  detail: string;
  /** Only meaningful when state === "breach". */
  severity?: "restarts_clock" | "removes_from_path";
};

export type Standing = {
  standing: "good" | "at_risk" | "lapsed" | "removed_from_path";
  checks: StandingCheck[];
  breaches: StandingCheck[];
  /** Controls that could not be evaluated. These cost the renter nothing. */
  unenforceable: StandingCheck[];
  /** True when the 90-day consecutive clock must restart. */
  restartsClock: boolean;
  /** True only on explicit, evidenced removal. Never inferred from thin data. */
  removedFromPath: boolean;
  /** What the renter should do, in order. */
  nextSteps: string[];
};

/**
 * Policy. Defaults are deliberately the FORGIVING reading, because every one of these
 * numbers decides whether a real person keeps their path to a car.
 *
 * ⛔ OWNER DECISIONS — these defaults are placeholders that behave protectively, not
 * business rules anyone has signed off. Confirm each before this drives a real decision.
 */
export type StandingPolicy = {
  /** Days a renter has to clear an overdue balance before it counts against them. */
  cureWindowDays: number;
  /** Missed inspections tolerated before the clock restarts. */
  missedInspectionsAllowed: number;
  /**
   * Whether a single missed payment removes someone from the path entirely.
   * Default FALSE: it restarts the 90-day clock instead. One bad week should not end
   * someone's route to ownership, and the owner said "disqualified", not "banned".
   */
  missedPaymentRemovesFromPath: boolean;
};

export const DEFAULT_STANDING_POLICY: StandingPolicy = {
  cureWindowDays: 14,
  missedInspectionsAllowed: 1,
  missedPaymentRemovesFromPath: false,
};

export type StandingEvidence = {
  /** Overdue payments right now. null = not tracked. */
  overduePayments: number | null;
  /** Days the oldest overdue payment has been overdue. null = unknown. */
  oldestOverdueDays: number | null;
  /**
   * Unpaid tolls/violations attributable to THIS renter, and whether that attribution is
   * even possible. `attributable: false` means the data cannot link tickets to people —
   * which is production's state today — and the check must abstain.
   */
  obligations: { attributable: boolean; unpaidCount: number | null; oldestUnpaidDays: number | null };
  /** Routine inspections the renter did not attend. null = not tracked. */
  missedInspections: number | null;
  /** On the do-not-rent list — the one explicit, evidenced removal. */
  onRestrictionList: boolean | null;
};

function fmtPlural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function assessStanding(
  evidence: StandingEvidence,
  policy: StandingPolicy = DEFAULT_STANDING_POLICY,
): Standing {
  const checks: StandingCheck[] = [];

  // ── 1. Payments ────────────────────────────────────────────────────────────────────
  if (evidence.overduePayments === null) {
    checks.push({
      key: "payments",
      label: "Rental payments",
      state: "unenforceable",
      detail: "Payment status is not being tracked for this renter.",
    });
  } else if (evidence.overduePayments === 0) {
    checks.push({
      key: "payments",
      label: "Rental payments",
      state: "clear",
      detail: "Payments are current.",
    });
  } else {
    const days = evidence.oldestOverdueDays;
    const withinCure = days !== null && days <= policy.cureWindowDays;
    checks.push({
      key: "payments",
      label: "Rental payments",
      state: withinCure ? "clear" : "breach",
      severity: policy.missedPaymentRemovesFromPath ? "removes_from_path" : "restarts_clock",
      detail: withinCure
        ? `${evidence.overduePayments} payment behind — you have ${policy.cureWindowDays - (days ?? 0)} days to catch up before it affects your progress.`
        : `${evidence.overduePayments} ${fmtPlural(evidence.overduePayments, "payment is", "payments are")} past the catch-up window.`,
    });
  }

  // ── 2. Tolls and other obligations ─────────────────────────────────────────────────
  const ob = evidence.obligations;
  if (!ob.attributable) {
    // Production today: 0 of 308 tickets carry customer_linked. We cannot tell whose
    // toll is whose, so we say nothing about anyone's tolls.
    checks.push({
      key: "obligations",
      label: "Tolls and other charges",
      state: "unenforceable",
      detail: "Tolls are not currently linked to individual renters, so this is not assessed.",
    });
  } else if (ob.unpaidCount === null) {
    checks.push({
      key: "obligations",
      label: "Tolls and other charges",
      state: "unenforceable",
      detail: "Not tracked for this renter.",
    });
  } else if (ob.unpaidCount === 0) {
    checks.push({
      key: "obligations",
      label: "Tolls and other charges",
      state: "clear",
      detail: "Nothing outstanding.",
    });
  } else {
    const days = ob.oldestUnpaidDays;
    // The owner's distinction: owing is not the failure, being RELUCTANT to settle is.
    const withinCure = days !== null && days <= policy.cureWindowDays;
    checks.push({
      key: "obligations",
      label: "Tolls and other charges",
      state: withinCure ? "clear" : "breach",
      severity: "restarts_clock",
      detail: withinCure
        ? `${ob.unpaidCount} outstanding — settle within ${policy.cureWindowDays - (days ?? 0)} days and it won't affect your progress.`
        : `${ob.unpaidCount} outstanding beyond the catch-up window.`,
    });
  }

  // ── 3. Routine inspections ─────────────────────────────────────────────────────────
  if (evidence.missedInspections === null) {
    checks.push({
      key: "inspections",
      label: "Vehicle inspections",
      state: "unenforceable",
      detail: "Inspection attendance is not being tracked for this renter.",
    });
  } else if (evidence.missedInspections <= policy.missedInspectionsAllowed) {
    checks.push({
      key: "inspections",
      label: "Vehicle inspections",
      state: "clear",
      detail:
        evidence.missedInspections === 0
          ? "All inspections attended."
          : `${evidence.missedInspections} missed — please book the next one.`,
    });
  } else {
    checks.push({
      key: "inspections",
      label: "Vehicle inspections",
      state: "breach",
      severity: "restarts_clock",
      detail: `${evidence.missedInspections} inspections missed. These confirm the car is safe and in working order.`,
    });
  }

  // ── 4. The explicit restriction list ───────────────────────────────────────────────
  if (evidence.onRestrictionList === null) {
    checks.push({
      key: "restriction_list",
      label: "Rental eligibility",
      state: "unenforceable",
      detail: "Not checked.",
    });
  } else if (evidence.onRestrictionList) {
    checks.push({
      key: "restriction_list",
      label: "Rental eligibility",
      state: "breach",
      severity: "removes_from_path",
      detail: "This account is restricted. Speak to us directly.",
    });
  } else {
    checks.push({
      key: "restriction_list",
      label: "Rental eligibility",
      state: "clear",
      detail: "No restrictions.",
    });
  }

  const breaches = checks.filter(c => c.state === "breach");
  const unenforceable = checks.filter(c => c.state === "unenforceable");

  const removedFromPath = breaches.some(b => b.severity === "removes_from_path");
  const restartsClock = !removedFromPath && breaches.length > 0;

  // "at_risk" is the state that exists so a renter hears about it BEFORE it costs them:
  // inside a cure window, nothing has been lost yet.
  const inCureWindow = checks.some(
    c => c.state === "clear" && /catch up|settle within|book the next/i.test(c.detail),
  );

  let standing: Standing["standing"];
  if (removedFromPath) standing = "removed_from_path";
  else if (breaches.length > 0) standing = "lapsed";
  else if (inCureWindow) standing = "at_risk";
  else standing = "good";

  const nextSteps: string[] = [];
  for (const b of breaches) nextSteps.push(b.detail);
  if (standing === "at_risk") {
    for (const c of checks) {
      if (c.state === "clear" && /catch up|settle within|book the next/i.test(c.detail)) {
        nextSteps.push(c.detail);
      }
    }
  }
  if (standing === "lapsed") {
    nextSteps.push(
      "Getting current restarts your 90-day run. Nothing you've already earned is lost.",
    );
  }

  return {
    standing,
    checks,
    breaches,
    unenforceable,
    restartsClock,
    removedFromPath,
    nextSteps,
  };
}
