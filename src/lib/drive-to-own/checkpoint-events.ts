/**
 * Recording that a renter cleared a gate.
 *
 * `journey_checkpoint_events` has existed since the ladder was designed and held **0 rows**
 * (verified production 2026-09-17). The ladder could work out where someone stood, but
 * nothing ever wrote down that they got there — so there was no history, no "you finished
 * step 2 on the 4th", and no way to show a renter their own progress over time.
 *
 * THE EVENT IS HISTORY, NOT CURRENT STATE.
 * A gate can stop being met — good standing lapses, a plan is cancelled. When that happens
 * the event is **left alone**. "This was met on the 4th" stays true even if it is not true
 * today, and rewriting history to match the present is how an audit trail becomes worthless.
 * Current state comes from `evaluateLadder`; this table says what has ever been achieved.
 *
 * Idempotent by the table's own `UNIQUE (journey_id, checkpoint_slug)`, so re-running on
 * every page load costs one refused insert rather than a duplicate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LadderPosition } from "./ladder";

export type CheckpointRecordResult = {
  /** Newly written this run. */
  recorded: string[];
  /** Already on file — not an error, the normal case after the first time. */
  alreadyKnown: string[];
  /** Slugs that could not be written, with the reason. Never silently dropped. */
  failed: Array<{ slug: string; error: string }>;
};

/**
 * Write an event for every gate currently met. Safe to call on every read.
 *
 * `orgId` is optional: the column has a database default, so omitting it lets that default
 * apply rather than writing an explicit null over it.
 */
export async function recordMetCheckpoints(
  db: SupabaseClient,
  journeyId: string,
  position: LadderPosition,
  orgId?: string | null,
): Promise<CheckpointRecordResult> {
  const out: CheckpointRecordResult = { recorded: [], alreadyKnown: [], failed: [] };

  // Only `met`. A gate that is unknown or not met has not been achieved, and an event
  // saying otherwise would be a fabricated milestone on someone's route to a car.
  const met = position.gates.filter(g => g.state === "met");
  if (met.length === 0) return out;

  for (const gate of met) {
    const { error } = await db.from("journey_checkpoint_events").insert({
      journey_id: journeyId,
      checkpoint_slug: gate.slug,
      // Why it was met, kept with the event so the trail explains itself later.
      evidence: { detail: gate.detail, title: gate.title, optional: gate.optional },
      ...(orgId ? { org_id: orgId } : {}),
    });

    if (!error) { out.recorded.push(gate.slug); continue; }
    if (error.code === "23505") { out.alreadyKnown.push(gate.slug); continue; }

    // 23503 = the slug is not in journey_checkpoints. That means the code's ladder and the
    // database's ladder have drifted apart, which is worth surfacing loudly rather than
    // swallowing — it would otherwise silently stop recording one step forever.
    out.failed.push({ slug: gate.slug, error: error.message });
  }

  return out;
}

/** What this renter has ever achieved, oldest first. Empty is a real answer. */
export async function loadCheckpointHistory(
  db: SupabaseClient,
  journeyId: string,
): Promise<Array<{ checkpoint_slug: string; met_at: string }>> {
  const { data, error } = await db
    .from("journey_checkpoint_events")
    .select("checkpoint_slug, met_at")
    .eq("journey_id", journeyId)
    .order("met_at", { ascending: true });

  // An error is not an empty history. Showing a renter no milestones because a read failed
  // would erase work they actually did.
  if (error) throw new Error(`[drive-to-own] checkpoint history failed: ${error.message}`);
  return (data ?? []) as Array<{ checkpoint_slug: string; met_at: string }>;
}
