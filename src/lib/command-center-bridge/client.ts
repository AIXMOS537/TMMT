import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Optional read-only bridge to root TMMT Command Center Supabase (contracts, background_checks). */
export function isCommandCenterBridgeConfigured(): boolean {
  return Boolean(
    process.env.COMMAND_CENTER_SUPABASE_URL?.trim() &&
      process.env.COMMAND_CENTER_SUPABASE_SERVICE_KEY?.trim()
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCommandCenterClient(): SupabaseClient<any, "public", any> | null {
  const url = process.env.COMMAND_CENTER_SUPABASE_URL?.trim();
  const key = process.env.COMMAND_CENTER_SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
