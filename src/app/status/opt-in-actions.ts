"use server";

/**
 * "I'd like to own a car one day" — the moment the Drive-to-Own funnel actually starts.
 *
 * Until this exists the ladder is a report nobody asked for. One row, one timestamp.
 *
 * RENTER-INITIATED ONLY. The column records that THIS PERSON chose the path, so it is
 * written from their own link and never on their behalf. Staff opting someone in would
 * make the whole journey's consent record worthless.
 */

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getClientJourneyForToken } from "@/lib/client-self-service";
import { acknowledgeSection } from "@/lib/drive-to-own/education";
import { markModuleProgress } from "@/lib/drive-to-own/training";

export type OptInResult = { ok: true; alreadyOptedIn: boolean } | { ok: false; error: string };

export async function optInToOwnership(token: string): Promise<OptInResult> {
  let journey;
  try {
    journey = await getClientJourneyForToken(token);
  } catch {
    return { ok: false, error: "We couldn't reach your record just now. Please try again." };
  }

  // No journey, expired token, or an ambiguous email all land here. Same answer for all
  // three: this link cannot opt anyone in, and we do not say which case it was.
  if (!journey) {
    return { ok: false, error: "This link can't be used to join right now. Give us a shout." };
  }

  const svc = createServiceRoleClient();

  // Idempotent: re-pressing must not move the date. The FIRST time someone chose this path
  // is the fact worth keeping, and it may later anchor how long they have been working at it.
  const { data: existing, error: readErr } = await svc
    .from("client_journey")
    .select("ownership_opt_in_at")
    .eq("id", journey.id)
    .maybeSingle();

  if (readErr) {
    console.error("[optInToOwnership] read", readErr.message);
    return { ok: false, error: "We couldn't save that just now. Please try again." };
  }

  if (existing?.ownership_opt_in_at) {
    return { ok: true, alreadyOptedIn: true };
  }

  const { error } = await svc
    .from("client_journey")
    .update({ ownership_opt_in_at: new Date().toISOString() })
    .eq("id", journey.id)
    .is("ownership_opt_in_at", null); // belt and braces against a concurrent press

  if (error) {
    console.error("[optInToOwnership] update", error.message);
    return { ok: false, error: "We couldn't save that just now. Please try again." };
  }

  revalidatePath(`/status/${token}`);
  return { ok: true, alreadyOptedIn: false };
}


/**
 * Record that the renter read one credit-education section. Gate 10 of the ladder.
 *
 * Resolved from their own link, exactly like the opt-in: the renter has no account, and the
 * token is the credential. Idempotent — a second tap is success, not a duplicate.
 */
export async function acknowledgeEducationSection(
  token: string,
  sectionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(sectionId)) {
    return { ok: false, error: "That section could not be found." };
  }

  let journey;
  try {
    journey = await getClientJourneyForToken(token);
  } catch {
    return { ok: false, error: "We couldn't reach your record just now. Please try again." };
  }
  if (!journey) {
    return { ok: false, error: "This link can't be used right now. Give us a shout." };
  }

  // Only a renter who has chosen this path can progress along it. Recording education for
  // someone who never opted in would be building a profile nobody asked for.
  if (!journey.ownership_opt_in_at) {
    return { ok: false, error: "Join the path first and this will open up." };
  }

  const svc = createServiceRoleClient();
  const r = await acknowledgeSection(svc, {
    journeyId: journey.id,
    sectionId,
    orgId: null,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/status/${token}`);
  return { ok: true };
}


/**
 * Mark a training module read. Gates 30 and 40.
 *
 * Same trust boundary as the education acknowledgement: resolved from the renter's own
 * link, and only for someone who has actually joined the path.
 */
export async function markTrainingModule(
  token: string,
  moduleId: string,
  percent: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(moduleId)) {
    return { ok: false, error: "That module could not be found." };
  }

  let journey;
  try {
    journey = await getClientJourneyForToken(token);
  } catch {
    return { ok: false, error: "We couldn't reach your record just now. Please try again." };
  }
  if (!journey) return { ok: false, error: "This link can't be used right now. Give us a shout." };
  if (!journey.ownership_opt_in_at) {
    return { ok: false, error: "Join the path first and this will open up." };
  }

  const r = await markModuleProgress(createServiceRoleClient(), {
    journeyId: journey.id,
    moduleId,
    percent,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/status/${token}`);
  return { ok: true };
}
