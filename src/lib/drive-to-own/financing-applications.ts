/**
 * Recording a financing application, and the lender's answer.
 *
 * This is the operator surface for the one fact TMMT cannot compute: whether a lender said
 * yes. Without it `financing_applications` is an empty table and the ladder reads `pending`
 * forever, however much work the renter does.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It records who was applied to, when, and what they
 * said. It does not record terms, rates, schedules, balances or payments. Holding those
 * would make TMMT a creditor — Reg Z / TILA disclosure, state lender licensing,
 * repossession law — and the owner's own description ("renting until they can get approved
 * for financing") puts the lending with a third party. Keep it that way.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const FINANCING_OUTCOMES = [
  "pending",
  "approved",
  "declined",
  "withdrawn",
  "expired",
] as const;
export type FinancingOutcome = (typeof FINANCING_OUTCOMES)[number];

/** An outcome that is not `pending` is a decision, and every decision needs a date. */
export function isDecision(outcome: FinancingOutcome): boolean {
  return outcome !== "pending";
}

export type FinancingApplication = {
  id: string;
  org_id: string;
  journey_id: string;
  lender_name: string;
  applied_at: string;
  outcome: FinancingOutcome;
  decided_at: string | null;
  decline_reason_category: string | null;
  notes: string | null;
};

export type RecordResult =
  | { ok: true; application: FinancingApplication }
  | { ok: false; error: string };

/**
 * Log that a renter applied to a lender. Always opens as `pending` — an application is
 * never recorded as already-decided, because the two are separate events and collapsing
 * them loses the date the renter actually applied.
 */
export async function recordApplication(
  db: SupabaseClient,
  input: { orgId: string; journeyId: string; lenderName: string; notes?: string },
): Promise<RecordResult> {
  const lender = input.lenderName.trim();
  if (!lender) return { ok: false, error: "A lender name is required." };

  const { data, error } = await db
    .from("financing_applications")
    .insert({
      org_id: input.orgId,
      journey_id: input.journeyId,
      lender_name: lender,
      outcome: "pending",
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[financing_applications] insert", error.message);
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "The application could not be saved." };
  return { ok: true, application: data as FinancingApplication };
}

/**
 * Record what the lender said.
 *
 * `decidedAt` is required for any non-pending outcome and is passed in rather than read
 * from a clock here, so the caller records when the LENDER decided rather than when a staff
 * member got round to typing it. The database enforces the same rule independently.
 */
export async function recordDecision(
  db: SupabaseClient,
  input: {
    applicationId: string;
    outcome: FinancingOutcome;
    decidedAt?: string;
    declineReasonCategory?: string | null;
    notes?: string;
  },
): Promise<RecordResult> {
  if (!FINANCING_OUTCOMES.includes(input.outcome)) {
    return { ok: false, error: `Unknown outcome "${input.outcome}".` };
  }

  if (isDecision(input.outcome) && !input.decidedAt) {
    // Refused here as well as in the database. A decision with no date is unauditable,
    // and an approval is the thing that hands someone a car.
    return { ok: false, error: "A decision needs the date the lender made it." };
  }

  if (input.outcome === "approved" && input.declineReasonCategory) {
    return { ok: false, error: "An approval cannot carry a decline reason." };
  }

  const { data, error } = await db
    .from("financing_applications")
    .update({
      outcome: input.outcome,
      decided_at: isDecision(input.outcome) ? input.decidedAt : null,
      decline_reason_category:
        input.outcome === "declined" ? (input.declineReasonCategory ?? null) : null,
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[financing_applications] decision", error.message);
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "That application could not be found." };
  return { ok: true, application: data as FinancingApplication };
}
