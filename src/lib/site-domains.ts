/**
 * ONE app (tmmt-ops on Vercel) serves staff, owner command center, training,
 * the public landing pages and the intake forms. TMMT OS keeps its own
 * visitors: nothing here routes anyone to the partner site at
 * allinonemanagementsolutions.com (twin .net) — that is an opt-in referral
 * and it lives in @/lib/partner-handoff.
 * The old aixmos-landing / tmmt-command-center / tmmt-training-site /
 * aixmos-offer Vercel projects are retired (2026-09-03).
 *
 * Do NOT default to the apex .com/.net — those already resolve to GHL
 * (Cloudflare → sites.ludicrous.cloud). Do NOT use app.* — that CNAME is
 * GHL's white-label login (whitelabel.ludicrous.cloud).
 */

export const OWNER_HUB_HOST =
  process.env.NEXT_PUBLIC_OWNER_HUB_HOST ??
  "ops.allinonemanagementsolutions.com";

const LEGACY_OWNER_HUB_ALIASES = new Set([
  "admin.tmmtrentals.net",
  "tmmtrentals.net",
  "www.tmmtrentals.net",
]);

export function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isOwnerHubHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return (
    h === OWNER_HUB_HOST ||
    h === `www.${OWNER_HUB_HOST}` ||
    h === `admin.${OWNER_HUB_HOST}` ||
    LEGACY_OWNER_HUB_ALIASES.has(h)
  );
}

export function ownerHubOrigin(): string {
  return `https://${OWNER_HUB_HOST}`;
}

/**
 * The partner's public site. Kept only so the CORS allow-list below can name
 * it and so /partners/all-in-one can link to it after someone opts in.
 *
 * It is NOT a routing destination. `publicSiteRedirectUrl`,
 * `isTmmtPublicHost`, `shouldBounceTmmtCreditToAixmos`, `aixmosCreditPath`
 * and `aixmosCreditRedirectUrl` used to live here and were the machinery that
 * bounced TMMT visitors to the partner homepage. They are gone — the only
 * sanctioned hand-off is `partnerHandoffUrl` in @/lib/partner-handoff, and it
 * refuses to build a URL without recorded consent.
 */
export const AIXMOS_PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_AIXMOS_SITE_URL ?? "https://allinonemanagementsolutions.com"
).replace(/\/$/, "");

const TMMT_PUBLIC_HOSTS = new Set([
  "tmmt-ops.vercel.app",
  "tmmtrentals.com",
  "www.tmmtrentals.com",
]);

/**
 * Hosts of the one app. Used to pick which brand a form renders under —
 * host classification, nothing more.
 *
 * This used to be the trigger for the partner bounce as well, which is how a
 * branding helper ended up deciding who got sent off the site. It no longer
 * feeds any redirect.
 */
export function isTmmtPublicHost(host: string | null): boolean {
  return TMMT_PUBLIC_HOSTS.has(normalizeHost(host));
}

const AIXMOS_CORS_ORIGINS = new Set([
  "https://allinonemanagementsolutions.com",
  "https://www.allinonemanagementsolutions.com",
  "https://allinonemanagementsolutions.net",
  "https://www.allinonemanagementsolutions.net",
  "https://aixmos.com",
  "https://www.aixmos.com",
]);

/** Origins allowed to POST leads into the ops webhook from the public GHL site. */
export function isAixmosCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const o = origin.replace(/\/$/, "");
  return o === AIXMOS_PUBLIC_ORIGIN || AIXMOS_CORS_ORIGINS.has(o);
}
