/**
 * The Drive-to-Own ladder: rent a car → build credit while renting → qualify → own it.
 *
 * THESE EIGHT STAGES ARE NOT INVENTED HERE. They are seeded in `journey_checkpoints`
 * (8 active rows, verified in production 2026-09-16) and this file mirrors that
 * contract so the ladder can be reasoned about in TypeScript. The database remains the
 * source of truth for titles, descriptions and ordering; if a slug appears there that is
 * absent here, the evaluator refuses rather than silently ignoring a gate.
 *
 * WHY THIS SHAPE IS THE LEGAL ONE. Every credit stage below is EDUCATION, ENROLLMENT or
 * TRAINING — acknowledging why credit matters, completing rebuild modules, staying in
 * good standing. None of it disputes a tradeline or acts as anyone's agent toward a
 * bureau. That is what keeps the ladder outside the Credit Repair Organizations Act
 * while `CLAIMS_AUDIT.md` still records all seven legal gates as CLOSED. Do not add a
 * dispute-letter stage to this ladder. See PRICING_AND_CREDIT_GUARDRAILS_2026-09-16.md.
 */

export const CHECKPOINT_ORDER = [
  "credit_education_acknowledged",
  "credit_enrollment_active",
  "training_path_started",
  "training_core_complete",
  "mentorship_dfy_active",
  "day_90_good_standing",
  "lto_eligible",
  "vehicle_turnover_complete",
] as const;

export type CheckpointSlug = (typeof CHECKPOINT_ORDER)[number];

/** Mirrors journey_checkpoints.sort_order so ordering survives a DB read. */
export const CHECKPOINT_SORT: Record<CheckpointSlug, number> = {
  credit_education_acknowledged: 10,
  credit_enrollment_active: 20,
  training_path_started: 30,
  training_core_complete: 40,
  mentorship_dfy_active: 50,
  day_90_good_standing: 60,
  lto_eligible: 70,
  vehicle_turnover_complete: 80,
};

export const CHECKPOINT_TITLE: Record<CheckpointSlug, string> = {
  credit_education_acknowledged: "Credit education complete",
  credit_enrollment_active: "Credit enrollment active",
  training_path_started: "Training started",
  training_core_complete: "Core training complete",
  mentorship_dfy_active: "Mentorship DFY active",
  day_90_good_standing: "90-day good standing",
  lto_eligible: "LTO eligible",
  vehicle_turnover_complete: "Vehicle turnover complete",
};

/**
 * `mentorship_dfy_active` is "Path C $1,000 paid" — a paid upgrade, not something every
 * renter buys. Treating it as mandatory would park every Path A/B renter forever one gate
 * short of owning a car. It is therefore OPTIONAL: it can be met, but never blocks.
 *
 * Which tracks require it is an owner decision that the database does not record. Until it
 * does, the safe reading is the one that cannot trap a paying customer below the ladder.
 */
export const OPTIONAL_CHECKPOINTS: ReadonlySet<CheckpointSlug> = new Set([
  "mentorship_dfy_active",
]);

/** The 90 in "90 consecutive days in good standing", from the checkpoint's own description. */
export const GOOD_STANDING_DAYS_REQUIRED = 90;
