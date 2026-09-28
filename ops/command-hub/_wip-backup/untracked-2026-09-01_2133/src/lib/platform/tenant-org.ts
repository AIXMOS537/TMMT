/**
 * The bridge between the two tenancy systems, which until now did not know
 * about each other.
 *
 *   BRAND  — `tenant-resolve.ts`, a build-time map from host or slug to logo,
 *            theme and display name. Edge-safe, no database, `id` is a slug.
 *   ORG    — `organizations.id`, a uuid. What RLS actually enforces, and what
 *            `acting_org_id()` stamps on every write.
 *
 * A request resolving to the TMMT *brand* told us nothing about which *org* its
 * data belongs to. Host-based tenancy needs both: the brand to render, the org
 * to scope.
 *
 * TWO TIERS, DELIBERATELY:
 *
 *   1. The house orgs are listed here as constants. They are fixed, they are
 *      hot, and a database round trip in Edge middleware on every request is a
 *      cost paid forever to look up an answer that never changes.
 *   2. Everyone else resolves from `organization_domains` via `org_id_for_host()`
 *      — server-side, cached. That is what lets an operator's domain go live
 *      without a redeploy, which is the whole point of a registry table.
 *
 * So this file answers instantly for the two hosts that matter most and returns
 * undefined for the rest, which is the signal to ask the database.
 */
import { normalizeHost, resolveTenantByHost } from "./tenant-resolve";

/** Header carrying the resolved org uuid from middleware to server components. */
export const ORG_HEADER = "x-aixmos-org";

/** Header carrying the normalized request host, so server code need not re-parse it. */
export const HOST_HEADER = "x-aixmos-host";

export const HOUSE_ORG_IDS = {
  tmmt: "8e651b25-e7c8-4356-af64-1716a82053b0",
  aixmos: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

/**
 * Brand slug -> org uuid, for the house brands only.
 *
 * Keyed by every slug and alias the brand map accepts, because `resolveTenant`
 * may hand back any of them. `moe-legacy` is deliberately absent: it has an
 * organizations row but is not a house org, so it goes through the database
 * like any other tenant.
 */
const SLUG_TO_ORG: Record<string, string> = {
  tmmt: HOUSE_ORG_IDS.tmmt,
  tmmt_property: HOUSE_ORG_IDS.tmmt,
  "tmmt-rentals": HOUSE_ORG_IDS.tmmt,
  aixmos: HOUSE_ORG_IDS.aixmos,
  aixmos537: HOUSE_ORG_IDS.aixmos,
};

export function orgIdForTenantSlug(slug: string | null | undefined): string | undefined {
  const key = String(slug ?? "").trim().toLowerCase();
  return key ? SLUG_TO_ORG[key] : undefined;
}

/**
 * Host -> org uuid, without touching the database.
 *
 * Returns undefined for any host that is not a house brand — including hosts
 * that ARE registered in organization_domains. That is not a failure: it is the
 * caller's cue to fall back to `org_id_for_host()`. Guessing here would be
 * worse than admitting ignorance, because a wrong org id silently writes one
 * tenant's data into another's.
 */
export function orgIdForHostStatic(host: string | null | undefined): string | undefined {
  const clean = normalizeHost(host);
  if (!clean) return undefined;
  const brand = resolveTenantByHost(clean);
  if (!brand) return undefined;
  return orgIdForTenantSlug(brand.slug) ?? orgIdForTenantSlug(brand.id);
}

export function isHouseOrgId(orgId: string | null | undefined): boolean {
  return orgId === HOUSE_ORG_IDS.tmmt || orgId === HOUSE_ORG_IDS.aixmos;
}