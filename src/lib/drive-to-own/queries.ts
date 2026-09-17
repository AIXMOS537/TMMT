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
  good_standing: boolean | null;
  good_standing_days: number | null;
  lto_eligible: boolean | null;
  program_track: string | null;
};

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

export async function loadLadderEvidence(
  db: SupabaseClient,
  journey: JourneyRow,
): Promise<LadderEvidence> {
  // How many education sections a renter must acknowledge. Seeded content, so a zero here
  // means the programme has no content yet — the ladder treats that as unknown, not passed.
  const requiredSections = await countAll(db, "credit_education_sections");
  const coreModulesTotal = await countAll(db, "training_modules");

  const acknowledged = await wiredCount(
    db,
    "credit_education_acknowledgments",
    "profile_id",
    journey.id,
  );

  const enrollments = await wiredCount(db, "credit_enrollments", "journey_id", journey.id);
  const moduleProgress = await wiredCount(db, "training_module_progress", "profile_id", journey.id);
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

    // THE LENDER'S DECISION. Nothing in this schema records it yet -- there is no
    // financing-application table -- so it is null, which the ladder reads as `pending`.
    // It must NEVER be derived from internal progress: the owner's rule is that a renter
    // owns the car only if and when a lender approves them, and some never will.
    financingApproved: null,
  };
}
