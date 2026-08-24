/**
 * Bridge credit dispute profiles → TMMT client_journey spine
 * Uses same Supabase project (uapxakmlwnpfsftfeezx) as rest of TMMT-LIVE
 */
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getOrCreateJourney } from "@/lib/client-journey/queries";
import type { FundingReadinessResult } from "./engine/funding-readiness";

export async function linkProfileToJourney(email: string, profileId: string) {
  const supabase = createServiceRoleClient();
  const journey = await getOrCreateJourney(email, supabase);
  if (!journey) return null;

  await supabase
    .from("credit_profiles")
    .update({ client_journey_id: journey.id })
    .eq("id", profileId);

  return journey;
}

export async function syncFundingReadinessToJourney(
  email: string,
  funding: FundingReadinessResult
) {
  const supabase = createServiceRoleClient();
  const journey = await getOrCreateJourney(email, supabase);
  if (!journey) return;

  await supabase
    .from("client_journey")
    .update({
      program_track: funding.tier === "elite" || funding.tier === "funding_ready" ? "funding" : "credit",
    })
    .eq("id", journey.id);
}

export async function getJourneyCreditPlans(journeyId: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("credit_billing_plans")
    .select("id, credit_path, status, amount_cents, monthly_fee_cents, paid_at")
    .eq("journey_id", journeyId);
  return data ?? [];
}
