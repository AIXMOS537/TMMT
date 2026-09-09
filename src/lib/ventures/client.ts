import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCommandCenterClient, isCommandCenterBridgeConfigured } from "@/lib/command-center-bridge/client";
import { tryCreateServiceRoleClient } from "@/lib/supabase-service";

/**
 * Where venture data actually lives.
 *
 * The venture registry was written against a "TMMT Command Center" Supabase
 * project reached through COMMAND_CENTER_SUPABASE_URL / _SERVICE_KEY. Measured
 * 2026-09-09: that project does not exist. There is exactly one Supabase
 * project on the account, and `ventures` is a table IN IT — its own comment
 * reads "Portfolio businesses hosted in the command center; TMMT Rentals is
 * venture #1", alongside `verticals`, `services`, and the fleet / tickets /
 * insurance / pricing tables the venture screens read.
 *
 * So the command center is not somewhere else. It is here.
 *
 * This resolver keeps the door open for a genuinely separate project — if the
 * COMMAND_CENTER_* pair is ever set, it still wins — and otherwise uses this
 * app's own service-role client instead of pretending the data is unreachable.
 * It deliberately does NOT change `isCommandCenterBridgeConfigured()`, because
 * `ghl/dealer-lead-sync.ts` reads that to decide whether to write; flipping a
 * sync on is an owner's call, not a side effect of this file.
 */
export function resolveVentureDb(): SupabaseClient | null {
  if (isCommandCenterBridgeConfigured()) return createCommandCenterClient();
  return tryCreateServiceRoleClient();
}

/** True when venture data is reachable at all — either project counts. */
export function isVentureDbConfigured(): boolean {
  return resolveVentureDb() !== null;
}
