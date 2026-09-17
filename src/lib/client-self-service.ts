/**
 * Client (renter) self-service reads.
 *
 * OWNER DECISION 2026-09-16: "A client can see their own background check once it
 * comes back, and their own payments they have made."
 *
 * IDENTITY. background_checks carries no user_id and no FK to auth.users — a renter
 * has never had an account in this system. The credential is the staff-minted,
 * expiring `license_upload_token` already used by submitLicenseUpload. Same trust
 * boundary, same pattern, already in production.
 *
 * WHY SERVICE ROLE AND NOT THE BROWSER. client_bg_status is granted to service_role
 * only — deliberately NOT to anon or authenticated. A token in a browser-issued
 * PostgREST call lands in access logs and Referer headers. It stays server-side.
 *
 * WHAT NEVER COMES BACK. The RPC's return type has no column for the screening
 * screenshot, the details extracted from it, or review_notes. Withholding is
 * structural, not a filter someone can forget to apply.
 */

import { createServiceRoleClient } from "@/lib/supabase-service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClientBgStatus = {
  status: "pending" | "decided";
  decided: boolean;
  eligibility_status: string | null;
  /** Null whenever the reason's category is not customer-facing. See the reason gate. */
  reason_label: string | null;
  reason_description: string | null;
  recoverable: boolean | null;
  date_verified: string | null;
  has_license: boolean | null;
  has_insurance_proof: boolean | null;
  has_paystub: boolean | null;
  verification_form_submitted: boolean | null;
};

/**
 * Resolve one renter's own screening status from their link token.
 *
 * Returns null for: a malformed token, an unknown token, an expired token, and a
 * revoked token. All four are the same answer on purpose — distinguishing them
 * would turn this into an oracle for probing which tokens exist.
 */
export async function getClientBgStatus(token: string): Promise<ClientBgStatus | null> {
  if (!UUID_RE.test(token.trim())) return null;

  const svc = createServiceRoleClient();
  const { data, error } = await svc.rpc("client_bg_status", { p_token: token.trim() });

  if (error) {
    // An error is not an empty result. Never fall through to "nothing to show".
    console.error("[client_bg_status]", error.message);
    throw new Error("We could not load your status right now.");
  }

  const row = (data ?? [])[0];
  return row ? (row as ClientBgStatus) : null;
}

/**
 * Resolve the renter's Drive-to-Own journey from the same link token.
 *
 * WHY EMAIL, AND WHY THIS IS SAFE HERE. `background_checks` carries no journey id, so the
 * only available link is email. That is the same shape of join that was REFUSED for
 * payments, so it was measured before being used (production, 2026-09-16):
 *
 *   client_journey  35 rows, 35 with an email, **0 duplicate emails**  <- unique
 *   background_checks 292 of 299 with an email, 19 matching a journey
 *
 * The journey side being unique is what makes this safe: one email can only ever resolve to
 * one journey, so nobody can be shown someone else's progress. The payments join failed that
 * test (16 phone numbers appeared on more than one row) and was refused. If the journey side
 * ever stops being unique this function must refuse too — hence the explicit check below
 * rather than a bare `.single()` that would throw somewhere unhelpful.
 *
 * Returns null when: no token match, no journey for that email, or more than one journey.
 * "More than one" is deliberately a refusal, never a pick-the-first.
 */
export type ClientJourneyRow = {
  id: string;
  good_standing: boolean | null;
  good_standing_days: number | null;
  lto_eligible: boolean | null;
  program_track: string | null;
};

export async function getClientJourneyForToken(
  token: string,
): Promise<ClientJourneyRow | null> {
  if (!UUID_RE.test(token.trim())) return null;
  const svc = createServiceRoleClient();

  const { data: bg, error: bgErr } = await svc
    .from("background_checks")
    .select("email")
    .eq("license_upload_token", token.trim())
    .gt("license_upload_token_expires_at", new Date().toISOString())
    .maybeSingle();

  if (bgErr) {
    console.error("[getClientJourneyForToken] bg lookup", bgErr.message);
    throw new Error("We could not load your status right now.");
  }

  const email = (bg?.email ?? "").trim().toLowerCase();
  if (!email) return null;

  const { data: journeys, error: jErr } = await svc
    .from("client_journey")
    .select("id, good_standing, good_standing_days, lto_eligible, program_track")
    .ilike("customer_email", email)
    .limit(2);

  if (jErr) {
    console.error("[getClientJourneyForToken] journey lookup", jErr.message);
    throw new Error("We could not load your status right now.");
  }

  // Exactly one, or nothing. An ambiguous email must never show one person another's progress.
  if (!journeys || journeys.length !== 1) return null;
  return journeys[0] as ClientJourneyRow;
}
