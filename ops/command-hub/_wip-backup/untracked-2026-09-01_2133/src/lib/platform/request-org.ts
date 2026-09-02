/**
 * Which org does this request belong to?
 *
 * Server-side only — imports the service Supabase client and must never be
 * pulled into Edge middleware or a client component.
 *
 * Order, and why:
 *
 *   1. The `x-aixmos-org` header middleware set for a house host. Free.
 *   2. `org_id_for_host()` against `organization_domains`, for operator domains
 *      registered after the last deploy. One round trip, then cached.
 *   3. undefined — an unknown host. NOT a default org: falling back to the
 *      house org here would silently show one tenant another tenant's data,
 *      which is the exact failure host-based tenancy exists to prevent. An
 *      unknown host is an error for the caller to handle, not a guess to make.
 */
import { createServiceSupabase } from "@/lib/agent/supabase-server";
import { normalizeHost } from "./tenant-resolve";
import { ORG_HEADER, HOST_HEADER, orgIdForHostStatic } from "./tenant-org";

/**
 * Hosts change rarely; requests are constant. A short TTL keeps an operator's
 * newly verified domain live within a minute without paying for a lookup on
 * every request. Negative results are cached too — an unknown host under load
 * would otherwise hammer the database with the same failing query.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { orgId: string | null; at: number }>();

export function clearOrgHostCache(): void {
  cache.clear();
}

async function lookupHost(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.orgId;

  let orgId: string | null = null;
  try {
    const db = createServiceSupabase();
    const { data } = await db.rpc("org_id_for_host", { p_host: host });
    orgId = (typeof data === "string" && data) || null;
  } catch {
    // A lookup failure is not an authorization decision. Return null and let
    // the caller treat it as an unknown host; never fall through to a default
    // org just because the database was briefly unreachable.
    orgId = null;
  }

  cache.set(host, { orgId, at: Date.now() });
  return orgId;
}

/** Resolve the org for a request, given its headers. */
export async function orgIdForRequest(
  headers: Headers | { get(name: string): string | null },
): Promise<string | undefined> {
  const fromMiddleware = headers.get(ORG_HEADER);
  if (fromMiddleware) return fromMiddleware;

  const host = normalizeHost(headers.get(HOST_HEADER) ?? headers.get("host"));
  if (!host) return undefined;

  // Middleware may not have run (route handlers excluded by the matcher, or a
  // direct server-side call), so re-check the static map before the database.
  const staticHit = orgIdForHostStatic(host);
  if (staticHit) return staticHit;

  return (await lookupHost(host)) ?? undefined;
}

/** True when the host is registered to an org — verified domains only. */
export async function isKnownHost(host: string | null | undefined): Promise<boolean> {
  const clean = normalizeHost(host);
  if (!clean) return false;
  if (orgIdForHostStatic(clean)) return true;
  return (await lookupHost(clean)) !== null;
}