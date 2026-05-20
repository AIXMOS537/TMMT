/** Staff-only domain routing (.net owner hub). Public marketing lives on GHL (.com). */

export const OWNER_HUB_HOST =
  process.env.NEXT_PUBLIC_OWNER_HUB_HOST ?? "tmmtrentals.net";

export function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isOwnerHubHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return (
    h === OWNER_HUB_HOST ||
    h === `www.${OWNER_HUB_HOST}` ||
    h === "admin.tmmtrentals.net"
  );
}

export function ownerHubOrigin(): string {
  return `https://${OWNER_HUB_HOST}`;
}
