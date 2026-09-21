/**
 * Where one renter stands on the Drive-to-Own ladder, and what is actually blocking them.
 *
 * THE RULE THAT MATTERS: UNKNOWN IS NOT YES, AND UNKNOWN IS NOT NO.
 *
 * Verified in production 2026-09-16: `credit_education_acknowledgments`, `credit_enrollments`
 * and `training_module_progress` all hold ZERO rows — and nothing in the application writes
 * any of them. So "no acknowledgment row" does not mean the renter skipped the education. It
 * means nothing records it yet. Reporting that as `not_met` would invent a failure and put a
 * customer's ownership date back by 90 days on the strength of a table nobody populates.
 *
 * Each gate therefore resolves to `met` | `not_met` | `unknown`, and `unknown` BLOCKS
 * advancement without being reported as the renter's fault. This is the same fail-closed
 * discipline the repo already applies to opt-out gates and RLS reads: a zero-row answer from
 * an unwired source is a refusal to judge, never a verdict.
 */

import {
  CHECKPOINT_ORDER,
  CHECKPOINT_SORT,
  CHECKPOINT_TITLE,
  OPTIONAL_CHECKPOINTS,
  GOOD_STANDING_DAYS_REQUIRED,
  type CheckpointSlug,
} from "./checkpoints";

export type GateState = "met" | "not_met" | "unknown";

/**
 * What the ladder is allowed to look at. Every field is nullable on purpose: null means
 * "no evidence source is wired for this", which is a different answer from false.
 */
export type LadderEvidence = {
  /** client_journey.good_standing_days */
  goodStandingDays: number | null;
  /** client_journey.good_standing */
  goodStanding: boolean | null;
  /** Acknowledged education sections vs how many are required (credit_education_sections). */
  educationSectionsAcknowledged: number | null;
  educationSectionsRequired: number | null;
  /** An active row in credit_enrollments for this journey. */
  creditEnrollmentActive: boolean | null;
  /** Core training modules at 100%, and how many core modules exist. */
  coreModulesComplete: number | null;
  coreModulesTotal: number | null;
  /** Any module started at all. */
  anyModuleStarted: boolean | null;
  /** Path C ($1,000) paid. Optional — see OPTIONAL_CHECKPOINTS. */
  mentorshipDfyActive: boolean | null;
  /** A signed lto_agreements row. */
  ltoAgreementSigned: boolean | null;
  /**
   * THE EXTERNAL DECISION. A lender's financing approval for this renter.
   *
   * TMMT does not make this call and must never imply it can. Owner, 2026-09-16:
   * "not everyone will get to own the car — the renter only owns the car if and when
   * their credit is fixed and they can get approved for financing."
   *
   * null = no decision on file (pending or untracked). false = declined or not yet
   * approved. Clearing every TMMT gate does NOT set this.
   */
  financingApproved: boolean | null;
  /** Vehicle turnover documents signed and the swap done. */
  vehicleTurnoverComplete: boolean | null;
};

export type GateResult = {
  slug: CheckpointSlug;
  title: string;
  sortOrder: number;
  state: GateState;
  optional: boolean;
  /** Plain-English, customer-safe. Never blames the renter for an unwired source. */
  detail: string;
};

export type LadderPosition = {
  gates: GateResult[];
  /** The last gate met with NO unmet required gate behind it. Null if none. */
  clearedThrough: CheckpointSlug | null;
  /** The first gate that is not met — what to work on next. Null when the ladder is complete. */
  nextGate: CheckpointSlug | null;
  /**
   * Every gate TMMT controls is cleared, so the renter is ready to APPLY for financing.
   * This is NOT a prediction that they will be approved, and NOT a promise of a car.
   */
  readyToSeekFinancing: boolean;
  /** The lender's decision. `pending` is the honest default — never assume approval. */
  financingDecision: "approved" | "not_approved" | "pending";
  /** Set when advancement is held by a source nobody writes, rather than by the renter. */
  blockedByUnknown: CheckpointSlug[];
  complete: boolean;
};

function tri(value: boolean | null, metDetail: string, notMetDetail: string): [GateState, string] {
  if (value === null) return ["unknown", "Not tracked yet — nothing records this."];
  return value ? ["met", metDetail] : ["not_met", notMetDetail];
}

function counted(
  done: number | null,
  required: number | null,
  metDetail: (d: number, r: number) => string,
  notMetDetail: (d: number, r: number) => string,
): [GateState, string] {
  if (done === null || required === null) {
    return ["unknown", "Not tracked yet — nothing records this."];
  }
  // A requirement of zero cannot be "passed" by having done nothing; it means the
  // programme has no content seeded, which is an unanswered question, not an achievement.
  if (required <= 0) return ["unknown", "No required items are configured yet."];
  return done >= required
    ? ["met", metDetail(done, required)]
    : ["not_met", notMetDetail(done, required)];
}

function evaluateGate(slug: CheckpointSlug, e: LadderEvidence): [GateState, string] {
  switch (slug) {
    case "credit_education_acknowledged":
      return counted(
        e.educationSectionsAcknowledged,
        e.educationSectionsRequired,
        (d, r) => `All ${r} credit education sections acknowledged.`,
        (d, r) => `${d} of ${r} credit education sections acknowledged.`,
      );

    case "credit_enrollment_active":
      return tri(
        e.creditEnrollmentActive,
        "Credit plan is active.",
        "No active credit plan yet.",
      );

    case "training_path_started":
      return tri(e.anyModuleStarted, "Training has started.", "No training module started yet.");

    case "training_core_complete":
      return counted(
        e.coreModulesComplete,
        e.coreModulesTotal,
        (d, r) => `All ${r} core rebuild modules complete.`,
        (d, r) => `${d} of ${r} core rebuild modules complete.`,
      );

    case "mentorship_dfy_active":
      return tri(e.mentorshipDfyActive, "Mentorship is active.", "Mentorship not purchased.");

    case "day_90_good_standing": {
      if (e.goodStandingDays === null) return ["unknown", "Not tracked yet — nothing records this."];
      // Good standing must be CURRENT as well as long enough. A renter who fell out of
      // standing has not held 90 *consecutive* days, whatever the counter says.
      if (e.goodStanding === false) {
        return ["not_met", "Good standing has lapsed — the 90-day count restarts."];
      }
      const d = e.goodStandingDays;
      return d >= GOOD_STANDING_DAYS_REQUIRED
        ? ["met", `${d} consecutive days in good standing.`]
        : ["not_met", `${d} of ${GOOD_STANDING_DAYS_REQUIRED} days in good standing.`];
    }

    case "lto_eligible":
      // Deliberately NOT read from client_journey.lto_eligible. That column is a stored
      // flag; this is the computation that should set it. Trusting the flag would let a
      // stale or hand-edited row grant a car.
      //
      // NOTE THE WORDING. Clearing this gate means READY TO APPLY for financing. It is
      // not approval, and it is not a car. The lender decides, and may decline.
      return ["not_met", "Reached by clearing every step above."];

    case "vehicle_turnover_complete": {
      // Ownership transfers only after a LENDER approves financing. TMMT clearing its own
      // gates is necessary and nowhere near sufficient, so this gate refuses to open on
      // internal progress alone -- that refusal is the whole point of the owner's
      // correction on 2026-09-16.
      if (e.financingApproved !== true) {
        if (e.financingApproved === false) {
          return ["not_met", "Financing was not approved. The steps above still count."];
        }
        // No decision on file. If the handover is untracked too, we know nothing about
        // this gate and must say so -- asserting `not_met` would claim knowledge we do
        // not have. UNKNOWN IS NOT NO applies here exactly as it does upstream.
        if (e.vehicleTurnoverComplete === null) {
          return ["unknown", "Not tracked yet — nothing records this."];
        }
        return ["not_met", "Waiting on a financing decision from the lender."];
      }
      return tri(
        e.vehicleTurnoverComplete,
        "Handover complete.",
        "Financing approved — handover paperwork still to sign.",
      );
    }
  }
}

/**
 * Compute the renter's position. Pure: no I/O, no clock, no randomness.
 */
export function evaluateLadder(evidence: LadderEvidence): LadderPosition {
  const gates: GateResult[] = [];
  const blockedByUnknown: CheckpointSlug[] = [];

  // Every REQUIRED gate before lto_eligible must be `met`. An `unknown` blocks, because a
  // gate nobody can evidence is not a gate anybody has passed.
  let allPriorRequiredMet = true;

  for (const slug of CHECKPOINT_ORDER) {
    const optional = OPTIONAL_CHECKPOINTS.has(slug);
    let [state, detail] = evaluateGate(slug, evidence);

    if (slug === "lto_eligible") {
      if (allPriorRequiredMet) {
        // The signed agreement is the record of eligibility being acted on, not a
        // precondition for it. Eligibility is earned by the gates above.
        state = "met";
        detail = "Every gate cleared — eligible for lease-to-own.";
      }
    }

    if (state === "unknown" && !optional) blockedByUnknown.push(slug);

    // Optional gates never gate. Required ones do, and only `met` counts.
    if (!optional && CHECKPOINT_SORT[slug] < CHECKPOINT_SORT["lto_eligible"] && state !== "met") {
      allPriorRequiredMet = false;
    }

    gates.push({
      slug,
      title: CHECKPOINT_TITLE[slug],
      sortOrder: CHECKPOINT_SORT[slug],
      state,
      optional,
      detail,
    });
  }

  const required = gates.filter(g => !g.optional);

  // CONTIGUOUS, not highest-met. A renter with 120 days of good standing but no training
  // has not "cleared through" the 90-day gate — there is a hole behind it. Reporting the
  // highest met gate would overstate how close they are to owning the car.
  let cleared: (typeof required)[number] | null = null;
  for (const g of required) {
    if (g.state !== "met") break;
    cleared = g;
  }
  const next = required.find(g => g.state !== "met") ?? null;
  const lto = gates.find(g => g.slug === "lto_eligible")!;
  const turnover = gates.find(g => g.slug === "vehicle_turnover_complete")!;

  return {
    gates: gates.sort((a, b) => a.sortOrder - b.sortOrder),
    clearedThrough: cleared ? cleared.slug : null,
    nextGate: next ? next.slug : null,
    readyToSeekFinancing: lto.state === "met",
    financingDecision:
      evidence.financingApproved === true
        ? "approved"
        : evidence.financingApproved === false
          ? "not_approved"
          : "pending",
    blockedByUnknown,
    complete: turnover.state === "met",
  };
}
