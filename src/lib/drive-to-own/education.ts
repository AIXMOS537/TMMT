/**
 * Credit education — gate 10, the FIRST step of the Drive-to-Own ladder.
 *
 * Until 20260917010000 no renter could clear this gate at all:
 * `credit_education_acknowledgments.profile_id` was NOT NULL, and verified in production
 * 2026-09-16, **0 of 35 journeys carry a profile_id** because renters have no accounts. The
 * first gate was unevidencable for every renter alive, so nobody could take a single step.
 *
 * ⛔ WHAT THIS IS NOT. Education is reading material about how credit works and what lenders
 * look at. It disputes nothing, contacts no bureau, and acts as nobody's agent. That is
 * exactly what keeps the Drive-to-Own ladder outside the Credit Repair Organizations Act
 * while all seven credit legal gates remain CLOSED (`CLAIMS_AUDIT.md`). Section copy must
 * never promise a score change, and is covered by the language gate in the tests.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EducationSection = {
  id: string;
  title: string;
  body_md: string;
  sort_order: number;
  required: boolean;
  acknowledged: boolean;
};

export type EducationProgress = {
  sections: EducationSection[];
  requiredTotal: number;
  requiredAcknowledged: number;
  complete: boolean;
};

/**
 * The renter's own sections and which they have acknowledged.
 *
 * `complete` is false when there are no required sections. A programme with no content is
 * not a programme anyone has finished — the same rule the ladder engine applies.
 */
export async function loadEducationProgress(
  db: SupabaseClient,
  journeyId: string,
): Promise<EducationProgress> {
  const { data: sections, error: sErr } = await db
    .from("credit_education_sections")
    .select("id, title, body_md, sort_order, required, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (sErr) throw new Error(`[education] sections: ${sErr.message}`);

  const { data: acks, error: aErr } = await db
    .from("credit_education_acknowledgments")
    .select("section_id")
    .eq("journey_id", journeyId);

  // An error is not "nothing acknowledged". Showing a renter zero progress they actually
  // earned, because of a read failure, is the bug this line exists to prevent.
  if (aErr) throw new Error(`[education] acknowledgements: ${aErr.message}`);

  const acked = new Set((acks ?? []).map(a => (a as { section_id: string }).section_id));

  const list: EducationSection[] = (sections ?? []).map(s => {
    const row = s as Omit<EducationSection, "acknowledged">;
    return { ...row, acknowledged: acked.has(row.id) };
  });

  const required = list.filter(s => s.required);
  const requiredAcknowledged = required.filter(s => s.acknowledged).length;

  return {
    sections: list,
    requiredTotal: required.length,
    requiredAcknowledged,
    complete: required.length > 0 && requiredAcknowledged === required.length,
  };
}

export type AckResult = { ok: true; alreadyAcknowledged: boolean } | { ok: false; error: string };

/**
 * Record that this renter read a section.
 *
 * Idempotent by unique index on (journey_id, section_id): a double-tap is reported as
 * already-acknowledged rather than counted twice, which would otherwise show a renter as
 * having completed more sections than exist.
 */
export async function acknowledgeSection(
  db: SupabaseClient,
  input: { journeyId: string; sectionId: string; orgId: string | null },
): Promise<AckResult> {
  const { error } = await db.from("credit_education_acknowledgments").insert({
    journey_id: input.journeyId,
    section_id: input.sectionId,
    ...(input.orgId ? { org_id: input.orgId } : {}),
  });

  if (error) {
    // 23505 = unique_violation: they already acknowledged it. Not a failure.
    if (error.code === "23505") return { ok: true, alreadyAcknowledged: true };
    console.error("[education] acknowledge", error.message);
    return { ok: false, error: "We couldn't save that just now. Please try again." };
  }
  return { ok: true, alreadyAcknowledged: false };
}
