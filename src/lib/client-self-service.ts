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
