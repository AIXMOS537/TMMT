/**
 * Staff-only domain routing (ops hub on Vercel).
 * Public marketing / checkout / funnels stay on GHL at
 * allinonemanagementsolutions.com (and the twin .net GHL site).
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

/** Public AIXMOS / All In One Management site. Credit funnels live here, not on TMMT. */
export const AIXMOS_PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_AIXMOS_SITE_URL ?? "https://aixmos-landing.vercel.app"
).replace(/\/$/, "");

const TMMT_PUBLIC_HOSTS = new Set([
  "tmmt-ops.vercel.app",
  "tmmt-command-center.vercel.app",
  "tmmtrentals.com",
  "www.tmmtrentals.com",
]);

/** Rental/ops hosts that must not serve AIXMOS Credit landing pages. */
export function isTmmtPublicHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return TMMT_PUBLIC_HOSTS.has(h);
}

/**
 * Direct TMMT hits bounce credit URLs to AIXMOS. Requests proxied from the
 * AIXMOS landing (rewrite, x-forwarded-host) must still render the form.
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
  "https://aixmos-landing.vercel.app",
  "https://www.aixmos-landing.vercel.app",
  "https://allinonemanagementsolutions.com",
  "https://www.allinonemanagementsolutions.com",
  "https://aixmos.com",
  "https://www.aixmos.com",
]);

/** Origins allowed to POST phone leads into the ops webhook from the AIXMOS site. */
export function isAixmosCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const o = origin.replace(/\/$/, "");
  return o === AIXMOS_PUBLIC_ORIGIN || AIXMOS_CORS_ORIGINS.has(o);
}

/**
 * Maps a TMMT-hosted credit URL onto the AIXMOS public path.
 * Rental SKUs (training, rental-in-a-box, flagship) stay on TMMT.
 */
export function aixmosCreditPath(pathname: string): string | null {
  if (pathname === "/credit" || pathname === "/funding") return "/forms";
  if (pathname.startsWith("/forms/credit-funding-intake")) return "/forms/credit-funding-intake";
  if (pathname.startsWith("/forms/academy-join")) return "/forms/academy-join";
  if (pathname.startsWith("/forms/operator-apply")) return "/forms/operator-apply";
  if (pathname.startsWith("/forms/sovereign")) return "/forms/sovereign";
  if (pathname.startsWith("/forms/apply")) return "/forms/apply";
  if (pathname.startsWith("/forms/dealer-apply")) return "/forms/dealer-apply";
  if (pathname.startsWith("/forms/affiliates")) return "/forms/affiliates";
  const m = /^\/lp\/(moe_legacy|moe-legacy|aixmos)\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  const sku = m[2];
  if (sku === "intro-97") return "/forms/academy-join";
  if (sku === "lead-magnet") return "/lp/playbook";
  return null;
}

export function aixmosCreditRedirectUrl(pathname: string): string | null {
  const path = aixmosCreditPath(pathname);
  return path ? `${AIXMOS_PUBLIC_ORIGIN}${path}` : null;
}
