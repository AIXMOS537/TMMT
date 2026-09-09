import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCommandCenterClient } from "@/lib/command-center-bridge/client";
import { tryCreateServiceRoleClient } from "@/lib/supabase-service";

/**
 * Where venture data actually lives.
 *
 * The venture registry was written against a "TMMT Command Center" Supabase
 * project reached through COMMAND_CENTER_SUPABASE_URL / _SERVICE_KEY. Measured
 * 2026-09-09 on the fleet's own canonical env file, those two point at
 *
 *     https://uapxakmlwnpfsftfeezx.supabase.co
 *
 * which is THIS app's project — the same URL as NEXT_PUBLIC_SUPABASE_URL. The
 * command center was never somewhere else. `ventures` is a table here, and its
 * own comment says so: "Portfolio businesses hosted in the command center;
 * TMMT Rentals is venture #1."
 *
 * The COMMAND_CENTER key is also DEAD — the live project answers it with
 * `401 {"message":"Unregistered API key"}`, while the app's own service-role
 * key answers 200. So "is the bridge configured?" is the wrong question: both
 * variables are set, and trusting that would pick a revoked key for a second
 * copy of the database we are already connected to.
 *
 * The rule is therefore about IDENTITY, not presence: use the bridge only when
 * it names a genuinely different project. Same host — or no host — means use
 * the app's own client.
 *
 * `isCommandCenterBridgeConfigured()` is deliberately left untouched:
 * `ghl/dealer-lead-sync.ts` reads it to decide whether to WRITE, and turning a
 * sync on is an owner's call, not a side effect of this file.
 */
function hostOf(url: string | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True only when the bridge names a project this app is not already talking to. */
export function bridgeIsADifferentProject(): boolean {
  const bridge = hostOf(process.env.COMMAND_CENTER_SUPABASE_URL);
  if (!bridge) return false;
  if (!process.env.COMMAND_CENTER_SUPABASE_SERVICE_KEY?.trim()) return false;
  const own = hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? hostOf(process.env.SUPABASE_URL);
  return own !== null && bridge !== own;
}

export function resolveVentureDb(): SupabaseClient | null {
  if (bridgeIsADifferentProject()) {
    const bridged = createCommandCenterClient();
    if (bridged) return bridged;
  }
  return tryCreateServiceRoleClient();
}

/** True when venture data is reachable at all. */
export function isVentureDbConfigured(): boolean {
  return resolveVentureDb() !== null;
}
