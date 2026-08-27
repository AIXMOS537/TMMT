import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { resolveGhlLocationId, type GhlLocationKind } from "./client";

/**
 * Which GHL location an org's traffic belongs to, and whose credential may
 * authorize it.
 *
 * The old resolver read env vars only, so every org shared one location — and
 * the data agrees: all 1,637 rows in ghl_contacts carry the single location
 * 'Xcd8DZt5T4GWnBtBEC5V'. This resolves per-org, falling back to env.
 *
 * The distinction that matters is WHOSE agency the location sits in:
 *
 *   subaccount      Inside our agency. Our GHL_API_KEY authorizes it. We are
 *                   the landlord.
 *   foreign_agency  The operator owns the agency (Khan Strategies does). Our
 *                   key has no business there, and sending it would either fail
 *                   or — worse — succeed against the wrong account.
 *
 * So `ghlAuthForTarget()` REFUSES to hand back the server token for a foreign
 * agency. It fails closed. See the note on `credentialPending` below.
 */

export type GhlMode = "subaccount" | "foreign_agency";

export type GhlTarget =
  | { source: "org"; orgId: string; locationId: string; mode: GhlMode }
  | { source: "env"; locationId: string; mode: "subaccount" };

/**
 * Resolve the location for an org. Returns the env default when the org has no
 * active connection of its own — which is the normal case today, not an error.
 * Returns null only when there is no org connection AND no env default, i.e.
 * GHL is not configured at all.
 */
export async function resolveGhlTargetForOrg(
  orgId: string | null | undefined,
  fallbackKind: GhlLocationKind = "rentals"
): Promise<GhlTarget | null> {
  if (orgId) {
    const svc = createServiceRoleClient();
    // org_ghl_location() is SECURITY DEFINER and returns location + mode only —
    // never the credential id.
    const { data, error } = await svc
      .rpc("org_ghl_location", { p_org_id: orgId })
      .maybeSingle();

    if (error) {
      // A lookup failure must not silently reroute an operator's traffic into
      // the default location. Better to send nothing than to send it elsewhere.
      console.error("[ghl] org location lookup failed:", error.message);
      return null;
    }
    if (data) {
      const row = data as { location_id: string; mode: GhlMode };
      return {
        source: "org",
        orgId,
        locationId: row.location_id,
        mode: row.mode,
      };
    }
  }

  const envLocation = resolveGhlLocationId(fallbackKind);
  return envLocation
    ? { source: "env", locationId: envLocation, mode: "subaccount" }
    : null;
}

export type GhlAuth =
  | { ok: true; token: string; locationId: string }
  | { ok: false; reason: "not_configured" | "credential_pending" };

/**
 * The token to use for a target, or a refusal.
 *
 * `credential_pending` is returned for every foreign agency: per-agency
 * credentials live in Vault and the read path is not built yet. This is a
 * deliberate closed door rather than an open one — the alternative is sending
 * our agency token to an account we do not own, which is the single worst
 * failure mode in a reseller setup.
 */
export function ghlAuthForTarget(target: GhlTarget | null): GhlAuth {
  if (!target) return { ok: false, reason: "not_configured" };

  if (target.mode === "foreign_agency") {
    return { ok: false, reason: "credential_pending" };
  }

  const token = process.env.GHL_API_KEY?.trim();
  if (!token) return { ok: false, reason: "not_configured" };

  return { ok: true, token, locationId: target.locationId };
}
