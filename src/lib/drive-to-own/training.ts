/**
 * Gates 30 and 40 — training. The renter reads a module and marks it done.
 *
 * Keyed on the journey, not a profile: verified production 2026-09-17, 0 of 35 journeys
 * carry a profile_id because renters have no accounts (see 20260917120000).
 *
 * ⛔ Training is education about credit and the programme. It disputes nothing and contacts
 * no bureau, which is what keeps the Drive-to-Own ladder outside CROA while all seven
 * credit legal gates remain CLOSED.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TrainingModule = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string | null;
  sort_order: number;
  is_core: boolean;
  percent_complete: number;
};

export type TrainingProgress = {
  modules: TrainingModule[];
  coreTotal: number;
  coreComplete: number;
  complete: boolean;
};

export async function loadTraining(
  db: SupabaseClient,
  journeyId: string,
): Promise<TrainingProgress> {
  const { data: modules, error: mErr } = await db
    .from("training_modules")
    .select("id, slug, title, summary, content_md, sort_order, is_core, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (mErr) throw new Error(`[training] modules: ${mErr.message}`);

  const { data: progress, error: pErr } = await db
    .from("training_module_progress")
    .select("module_id, percent_complete")
    .eq("journey_id", journeyId);
  // An error is not "no progress". Showing a renter zero when they have done the work is
  // the failure mode this guards.
  if (pErr) throw new Error(`[training] progress: ${pErr.message}`);

  const byModule = new Map<string, number>();
  for (const row of (progress ?? []) as Array<{ module_id: string; percent_complete: number | null }>) {
    byModule.set(row.module_id, row.percent_complete ?? 0);
  }

  const list: TrainingModule[] = (modules ?? []).map(m => {
    const row = m as Omit<TrainingModule, "percent_complete">;
    return { ...row, percent_complete: byModule.get(row.id) ?? 0 };
  });

  const core = list.filter(m => m.is_core);
  const coreComplete = core.filter(m => m.percent_complete >= 100).length;

  return {
    modules: list,
    coreTotal: core.length,
    coreComplete,
    // A programme with no core modules is not one anybody has finished.
    complete: core.length > 0 && coreComplete === core.length,
  };
}

export type MarkResult = { ok: true; alreadyDone: boolean } | { ok: false; error: string };

/**
 * Mark one module's progress. Upsert on (journey_id, module_id) so a second tap updates
 * rather than duplicating — without that unique index a renter appears to have completed
 * more modules than exist.
 */
export async function markModuleProgress(
  db: SupabaseClient,
  input: { journeyId: string; moduleId: string; percent: number },
): Promise<MarkResult> {
  const pct = Math.round(input.percent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    // Refused here as well as by the database CHECK. 250% would read as "complete" to any
    // `>= 100` test and quietly clear a gate.
    return { ok: false, error: "Progress must be between 0 and 100." };
  }

  const { error } = await db
    .from("training_module_progress")
    .upsert(
      {
        journey_id: input.journeyId,
        module_id: input.moduleId,
        percent_complete: pct,
        completed_at: pct >= 100 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "journey_id,module_id" },
    );

  if (error) {
    console.error("[training] mark", error.message);
    return { ok: false, error: "We couldn't save that just now. Please try again." };
  }
  return { ok: true, alreadyDone: false };
}
