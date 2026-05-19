/** Domain routing for AIXMOS (.com public) vs owner hub (.net). */

export const PUBLIC_SITE_HOST =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_HOST ?? "allinonemanagementsolutions.com";

export const OWNER_HUB_HOST =
  process.env.NEXT_PUBLIC_OWNER_HUB_HOST ?? "allinonemanagementsolutions.net";

export function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isOwnerHubHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return h === OWNER_HUB_HOST || h === `www.${OWNER_HUB_HOST}`;
}

export function isPublicSiteHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return h === PUBLIC_SITE_HOST || h === `www.${PUBLIC_SITE_HOST}`;
}

export function publicSiteOrigin(): string {
  return `https://${PUBLIC_SITE_HOST}`;
}

export function ownerHubOrigin(): string {
  return `https://${OWNER_HUB_HOST}`;
}
