"use server";

import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  routeDeclinedApplicant,
  type ConsentChannel,
  type PrequalRouteOutcome,
} from "@/lib/aixmos-prequal-act";

export type SaveBackgroundCheckResult =
  | { success: true; routing: PrequalRouteOutcome | null }
  | { success: false; error: string };

/**
 * Save a background check and, if the eligibility outcome calls for it, route
 * the applicant into the AIXMOS prequal lane.
 *
 * This is the call site for `decidePrequalRoute()`. Setting eligibility is the
 * moment the lane exists — before it there is no outcome to route on.
 *
 * The save is authoritative: if routing fails the record is still saved and the
 * failure is reported alongside it. Never the other way round.
 */
export async function saveBackgroundCheck(
  record: Record<string, unknown>,
  consentCapturedVia: ConsentChannel | null
): Promise<SaveBackgroundCheckResult> {
  const saved = await adminUpsert("background_checks", record);
  if (!saved.success) return saved;

  const email = str(record.email);
  const phone = str(record.phone_number);
  // What staff will recognise in /command/handoffs. Email first — it is what
  // resolves a GHL contact — falling back to the phone.
  const contactRef = email || phone;
  if (!contactRef) return { success: true, routing: null };

  try {
    const routing = await routeDeclinedApplicant({
      eligibilityStatus: str(record.eligibility_status),
      contactRef,
      email: email || null,
      consentCapturedVia,
    });
    return { success: true, routing };
  } catch (err) {
    // routeDeclinedApplicant() is written not to throw, but a save that already
    // succeeded must not be reported as a failure if it somehow does.
    console.error("[background_checks] prequal routing threw:", err);
    return { success: true, routing: null };
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
