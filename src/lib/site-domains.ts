/**
 * ONE app (tmmt-ops on Vercel) serves staff, owner command center, training
 * and the intake forms. Everything PUBLIC — marketing, checkout, funnels —
 * lives on the GHL site at allinonemanagementsolutions.com (twin .net).
 * tmmt-command-center / tmmt-training-site / aixmos-offer are retired and
 * PAUSED on Vercel (503). aixmos-landing is the exception: it is NOT retired
 * and is still serving at aixmos-landing.vercel.app — owner decision
 * 2026-09-09, left up as-is. Nothing in this file routes to it.
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

/** Public All In One Management site (GHL). Every public visitor is routed here. */
export const AIXMOS_PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_AIXMOS_SITE_URL ?? "https://allinonemanagementsolutions.com"
).replace(/\/$/, "");

/** Where an anonymous visitor lands when they hit the app's front door. */
export function publicSiteRedirectUrl(campaign: string): string {
  return `${AIXMOS_PUBLIC_ORIGIN}/?utm_source=tmmt-ops&utm_medium=redirect&utm_campaign=${campaign}`;
}

const TMMT_PUBLIC_HOSTS = new Set([
  "tmmt-ops.vercel.app",
  "tmmtrentals.com",
  "www.tmmtrentals.com",
]);

/** Hosts of the one app. Marketing entry points on these bounce to the GHL site. */
export function isTmmtPublicHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return TMMT_PUBLIC_HOSTS.has(h);
}

/**
 * Direct hits on marketing entry points bounce to the GHL site. Requests
 * proxied from the public site (x-forwarded-host) are never bounced.
 */
export function shouldBounceTmmtCreditToAixmos(
  host: string | null,
  forwardedHost: string | null,
): boolean {
  if (!isTmmtPublicHost(host)) return false;
  const original = (forwardedHost ?? host)?.split(",")[0]?.trim() ?? host;
  return isTmmtPublicHost(original);
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

/**
 * Maps a marketing entry point typed on the app onto the GHL public site.
 * The intake forms themselves (/forms/*) stay on the app — the GHL site links
 * to them. Rental SKUs (training, rental-in-a-box, flagship) stay on TMMT.
 */
export function aixmosCreditPath(pathname: string): string | null {
  const utm = (campaign: string) =>
    `/?utm_source=tmmt-ops&utm_medium=redirect&utm_campaign=${campaign}`;
  if (pathname === "/credit" || pathname === "/funding") return utm("credit");
  const m = /^\/lp\/(moe_legacy|moe-legacy|aixmos)\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  const sku = m[2];
  if (sku === "intro-97") return utm("credit-guidance");
  if (sku === "lead-magnet") return utm("playbook");
  return null;
}

export function aixmosCreditRedirectUrl(pathname: string): string | null {
  const path = aixmosCreditPath(pathname);
  return path ? `${AIXMOS_PUBLIC_ORIGIN}${path}` : null;
}
