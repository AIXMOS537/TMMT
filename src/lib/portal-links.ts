import { rentalsPortalOrigin } from "@/lib/rentals-portal";

export function portalOrigin() {
  return rentalsPortalOrigin();
}

export function trackCaseUrl(refCode: string) {
  return `${portalOrigin()}/track?ref=${encodeURIComponent(refCode)}`;
}

export function clientUpdatesUrl() {
  return `${portalOrigin()}/client/updates`;
}

export function clientLoginUrl() {
  return `${portalOrigin()}/login`;
}
