import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The ONE place a service-role Supabase client is built (Remediation F-14).
 *
 * Before this, four factories and five inline `createClient(url, serviceKey)`
 * sites each read SUPABASE_SERVICE_ROLE_KEY themselves, with three different
 * option sets and no `server-only` marker on most of them. Every service-role
 * client now comes from here, so:
 *
 *   - `import "server-only"` above is the guard that actually stops the key
 *     from being pulled into a client bundle — any "use client" module that
 *     imports (transitively) from this file fails the Next.js build.
 *   - `src/lib/supabase-factories.test.ts` fails if `createClient(` from
 *     `@supabase/supabase-js` or the service-key env name reappears anywhere
 *     else under src/, shared/ or packages/.
 *
 * Options are the same for every caller: no session persistence and no
 * refresh timer, because a service-role client never holds a user session.
 */
const SERVICE_ROLE_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/**
 * Lowest-level builder: a service-role client for an explicit project.
 * Only for bridges to a *different* Supabase project (see
 * `command-center-bridge/client.ts`); app code uses `createServiceRoleClient`.
 */
export function buildServiceRoleClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, SERVICE_ROLE_OPTIONS);
}

/**
 * Service-role client for this app's Supabase project. Throws when env is
 * missing, so a misconfigured deploy fails loudly at the call site rather than
 * running with an undefined key. Never import from client components.
 *
 * `SUPABASE_URL` is accepted as a fallback for the URL (the retired
 * `agent/supabase-server` factory honoured it, and some worker environments
 * set only the private name).
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return buildServiceRoleClient(url, key);
}

/**
 * Same client, or `null` when the env is not configured. For call sites that
 * degrade on purpose (webhook idempotency, rate limiters) instead of failing
 * the request — the caller decides what "not configured" means.
 */
export function tryCreateServiceRoleClient(): SupabaseClient | null {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}
