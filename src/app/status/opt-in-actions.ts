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
