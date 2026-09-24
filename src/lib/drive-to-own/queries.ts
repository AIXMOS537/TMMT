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


/**
 * Core modules only. Gate 40 is "All CORE rebuild modules at 100%", and `training_modules`
 * carries `is_core` precisely to make that distinction — an earlier version of this file
 * counted every active module, so an optional extra could hold a renter back from a car.
 */
async function coreModuleTotal(db: SupabaseClient): Promise<number | null> {
  const { count, error } = await db
    .from("training_modules")
    .select("*", { count: "exact", head: true })
    .eq("is_core", true)
    .eq("active", true);
  if (error) throw new Error(`[drive-to-own] training_modules count failed: ${error.message}`);
  return (count ?? 0) > 0 ? count! : null;
}

/**
 * This renter's training. Counted across journey_id (the normal case) and profile_id
 * (historical rows), because 20260917120000 made journey the usable key.
 *
 * Returns nulls when the table is unwired system-wide — never zeros, which would report a
 * renter as having skipped training nobody has ever recorded.
 */
async function trainingProgress(
  db: SupabaseClient,
  journey: JourneyRow,
): Promise<{ started: boolean | null; coreComplete: number | null }> {
  const total = await countAll(db, "training_module_progress");
  if (total === 0) return { started: null, coreComplete: null };

  const filters: Array<[string, string]> = [["journey_id", journey.id]];
  if (journey.profile_id) filters.push(["profile_id", journey.profile_id]);

  let started = 0;
  let coreComplete = 0;
  for (const [col, val] of filters) {
    const { data, error } = await db
      .from("training_module_progress")
      .select("module_id, percent_complete, training_modules!inner(is_core, active)")
      .eq(col, val);
    if (error) throw new Error(`[drive-to-own] training progress read failed: ${error.message}`);
    for (const raw of (data ?? []) as unknown[]) {
      const row = raw as {
        percent_complete: number | null;
        // PostgREST returns an embedded relation as an array on some shapes and an object
        // on others depending on the join. Handle both rather than trusting one.
        training_modules: { is_core: boolean; active: boolean } | { is_core: boolean; active: boolean }[] | null;
      };
      started += 1;
      const m = Array.isArray(row.training_modules) ? row.training_modules[0] : row.training_modules;
      if (m?.is_core && m?.active && (row.percent_complete ?? 0) >= 100) coreComplete += 1;
    }
  }
  return { started: started > 0, coreComplete };
}

/**
 * The renter's credit enrollment. `credit_enrollments` is already journey-keyed, so no
 * migration was needed here — only a read that distinguishes an ACTIVE plan from a
 * cancelled or completed one, and spots the Path C upgrade that satisfies gate 50.
 */
async function enrollmentState(
  db: SupabaseClient,
  journeyId: string,
): Promise<{ active: boolean | null; dfy: boolean | null }> {
  const total = await countAll(db, "credit_enrollments");
  if (total === 0) return { active: null, dfy: null };

  const { data, error } = await db
    .from("credit_enrollments")
    .select("status, delivery_mode, completed_at")
    .eq("journey_id", journeyId);
  if (error) throw new Error(`[drive-to-own] credit_enrollments read failed: ${error.message}`);

  const rows = (data ?? []) as Array<{ status: string | null; delivery_mode: string | null; completed_at: string | null }>;
  const live = rows.filter(r => (r.status ?? "").toLowerCase() === "active" && !r.completed_at);
  return {
    active: live.length > 0,
    // Path C ($1,000 mentorship) is delivery_mode 'done_for_you'. Optional on the ladder,
    // so this never blocks — it only lets a renter who DID buy it see it marked.
    dfy: rows.some(r => r.delivery_mode === "done_for_you"),
  };
}

export async function loadLadderEvidence(
  db: SupabaseClient,
  journey: JourneyRow,
): Promise<LadderEvidence> {
  // How many education sections a renter must acknowledge. Seeded content, so a zero here
  // means the programme has no content yet — the ladder treats that as unknown, not passed.
  const requiredSections = await countAll(db, "credit_education_sections");
  const coreModulesTotal = await coreModuleTotal(db);

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

  const enrollment = await enrollmentState(db, journey.id);
  const training = await trainingProgress(db, journey);

  const ltoSigned = await wiredCount(db, "lto_agreements", "journey_id", journey.id);

  return {
    // client_journey IS wired and IS written — these are real answers, not guesses.
    goodStandingDays: journey.good_standing_days,
    goodStanding: journey.good_standing,

    educationSectionsAcknowledged: acknowledged,
    educationSectionsRequired: requiredSections > 0 ? requiredSections : null,

    creditEnrollmentActive: enrollment.active,

    anyModuleStarted: training.started,
    coreModulesComplete: training.coreComplete,
    coreModulesTotal,

    mentorshipDfyActive: enrollment.dfy,

    ltoAgreementSigned: ltoSigned === null ? null : ltoSigned > 0,
    // Turnover is recorded on the agreement's status once that write path exists.
    vehicleTurnoverComplete: null,

    // THE LENDER'S DECISION, read from financing_applications and nowhere else. It is
    // never derived from internal progress: the owner's rule is that a renter owns the car
    // only if and when a lender approves them, and some never will.
    financingApproved: await latestFinancingOutcome(db, journey.id),
  };
}
