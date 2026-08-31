import { rentalsPortalOrigin } from "@/lib/rentals-portal";

export function portalOrigin() {
  return rentalsPortalOrigin();
}

/**
 * These become merge fields on the GHL contact, so whatever they return is what
 * a customer taps in an SMS or an email.
 *
 * /track and /client/updates do not exist in this app — no route, no page. Both
 * were being written into tmmt_track_url and tmmt_portal_url and sent out, so
 * every customer following one landed on a 404. Until those screens are built
 * they point at the login page, which is real, and the case reference rides
 * along so nothing is lost when they are.
 *
 * When /track ships, change these two back and nothing else has to move.
 */
export function trackCaseUrl(refCode: string) {
  return `${portalOrigin()}/login?ref=${encodeURIComponent(refCode)}`;
}

export function clientUpdatesUrl() {
  return `${portalOrigin()}/login`;
}

export function clientLoginUrl() {
  return `${portalOrigin()}/login`;
}
