/**
 * Reads the evidence the Drive-to-Own ladder judges on.
 *
 * THE DISTINCTION THIS FILE EXISTS TO MAKE.
 * `credit_education_acknowledgments`, `credit_enrollments` and `training_module_progress`
 * were all empty system-wide when this was written (verified production 2026-09-16), and
 * nothing in the application writes them. A naive reader would return 0 for every renter
 * and the ladder would report 35 real customers as having failed their credit education.
 * They have not failed it. Nobody has ever recorded it.
 *
 * So each source is probed twice:
 *   - does this table hold ANY row at all (is the source wired)?
 *   - does it hold rows for THIS journey?
 * An unwired source yields `null` -> `unknown`. A wired source with no rows for this
 * renter yields a real count -> `not_met`. That is the difference between "we do not know"
 * and "they have not done it", and a customer's ownership date hangs on it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LadderEvidence } from "./ladder";

/** Rows the ladder needs from client_journey. */
export type JourneyRow = {
  id: string;
  /**
   * The renter's profile, if they have one. VERIFIED PRODUCTION 2026-09-16: **0 of 35
   * journeys carry this**, because renters have no accounts. Two evidence tables key on
   * it, so for those the honest answer is `unknown`, not zero.
   */
  profile_id?: string | null;
  good_standing: boolean | null;
  good_standing_days: number | null;
  lto_eligible: boolean | null;
  program_track: string | null;
  /** When the renter opted in to the Drive-to-Own path. Null = never opted in. */
  ownership_opt_in_at?: string | null;
};

/**
 * The lender's verdict, read from `financing_applications` — the only source allowed to
 * answer this. Returns:
 *   true  — the most recent application was approved
 *   false — it was declined, withdrawn or expired
 *   null  — still pending, or no application on file at all
 *
 * `pending` and `no application` deliberately collapse to null, because the ladder treats
 * both as "no decision yet" and neither is the renter's failure. Silence is never approval.
 */
async function latestFinancingOutcome(
  db: SupabaseClient,
  journeyId: string,
): Promise<boolean | null> {
  const { data, error } = await db
    .from("financing_applications")
    .select("outcome, applied_at")
    .eq("journey_id", journeyId)
    .order("applied_at", { ascending: false })
    .limit(1);

  if (error) {
    // The table may not exist yet in an environment where the migration has not run.
    // That is "no decision on file", not an approval, and must not take the page down.
    console.error("[drive-to-own] financing_applications read failed:", error.message);
    return null;
  }

  const outcome = data?.[0]?.outcome as string | undefined;
  if (outcome === "approved") return true;
  if (outcome === "declined" || outcome === "withdrawn" || outcome === "expired") return false;
  return null;
}

async function countAll(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  // An error is not an empty result. Propagate, never silently report "unwired".
  if (error) throw new Error(`[drive-to-own] ${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function countFor(
  db: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(`[drive-to-own] ${table} count failed: ${error.message}`);
  return count ?? 0;
}

/**
 * `wired ? count-for-this-renter : null`.
 * Probing the whole table first is what keeps an unwritten source out of the verdict.
 */
async function wiredCount(
  db: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<number | null> {
  const total = await countAll(db, table);
  if (total === 0) return null;
  return countFor(db, table, column, value);
}

/**
 * Acknowledgements for this renter, counted by journey AND by profile.
 *
 * A renter with no account acknowledges against their journey; a staff-linked profile may
 * also carry historical rows. Either counts. Returns null only when the whole table is
 * unwired, so an empty table never reads as "they skipped it".
 */
async function acknowledgementCount(
  db: SupabaseClient,
  journey: JourneyRow,
): Promise<number | null> {
  const total = await countAll(db, "credit_education_acknowledgments");
  if (total === 0) return null;

  const byJourney = await countFor(db, "credit_education_acknowledgments", "journey_id", journey.id);
  const byProfile = journey.profile_id
    ? await countFor(db, "credit_education_acknowledgments", "profile_id", journey.profile_id)
    : 0;
  return Math.max(byJourney, byProfile);
}

export async function loadLadderEvidence(
  db: SupabaseClient,
  journey: JourneyRow,
): Promise<LadderEvidence> {
  // How many education sections a renter must acknowledge. Seeded content, so a zero here
  // means the programme has no content yet — the ladder treats that as unknown, not passed.
  const requiredSections = await countAll(db, "credit_education_sections");
  const coreModulesTotal = await countAll(db, "training_modules");

  // ── JOIN KEYS ARE NOT INTERCHANGEABLE. Verified against production 2026-09-16:
  //     credit_education_acknowledgments -> profile_id
  //     training_module_progress         -> profile_id
  //     credit_enrollments               -> journey_id
  //     lto_agreements                   -> journey_id
  // An earlier version of this file passed the JOURNEY id to the two profile-keyed tables.
  // Both are empty today so it returned null either way and the mistake was invisible --
  // exactly the kind of bug that only surfaces once real data arrives, by which time it
  // reports every renter as having done nothing.
  //
  // `credit_education_acknowledgments` also accepts a journey_id since
  // 20260917010000, because a renter has no account and their acknowledgement needs
  // somewhere to live. Counted across BOTH keys.
  const acknowledged = await acknowledgementCount(db, journey);

  const enrollments = await wiredCount(db, "credit_enrollments", "journey_id", journey.id);

  // No profile means this is unevidencable for this renter, which is `unknown` and never 0.
  const moduleProgress = journey.profile_id
    ? await wiredCount(db, "training_module_progress", "profile_id", journey.profile_id)
    : null;

  const ltoSigned = await wiredCount(db, "lto_agreements", "journey_id", journey.id);

  return {
    // client_journey IS wired and IS written — these are real answers, not guesses.
    goodStandingDays: journey.good_standing_days,
    goodStanding: journey.good_standing,

    educationSectionsAcknowledged: acknowledged,
    educationSectionsRequired: requiredSections > 0 ? requiredSections : null,

    creditEnrollmentActive: enrollments === null ? null : enrollments > 0,

    anyModuleStarted: moduleProgress === null ? null : moduleProgress > 0,
    // Completion needs a per-module progress read that the schema does not yet expose in a
    // single count. Refusing is correct: claiming "0 complete" would be inventing a result.
    coreModulesComplete: null,
    coreModulesTotal: coreModulesTotal > 0 ? coreModulesTotal : null,

    // Path C is a paid upgrade with no recorded source yet. Optional, so it never blocks.
    mentorshipDfyActive: null,

    ltoAgreementSigned: ltoSigned === null ? null : ltoSigned > 0,
    // Turnover is recorded on the agreement's status once that write path exists.
    vehicleTurnoverComplete: null,

    // THE LENDER'S DECISION, read from financing_applications and nowhere else. It is
    // never derived from internal progress: the owner's rule is that a renter owns the car
    // only if and when a lender approves them, and some never will.
    financingApproved: await latestFinancingOutcome(db, journey.id),
  };
}
