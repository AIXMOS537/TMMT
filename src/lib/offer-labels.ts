import type { GhlOfferId } from "./ghl-offers";

/**
 * Human labels for the offer ids that reach /forms/lead-intake as ?offer=.
 *
 * The money CTAs fall back to that form when a checkout link is not configured,
 * which is currently every one of them. The form is headed "Vehicle Rental
 * Inquiry", so before this existed a person clicking "$50,000 — full ecosystem"
 * arrived at a car-rental form with no sign of what they had clicked. The lead
 * was captured and attributable through utm_campaign, but the page told them
 * they were in the wrong place.
 */
const LABELS: Record<GhlOfferId, string> = {
  member97: "AIXMOS Membership — $97/mo",
  credit: "Credit + Funding Audit",
  llc: "LLC Setup — $397",
  base: "Base Infrastructure — $3,750",
  enterprise: "Enterprise Build — $7,500",
  carbox: "Car Rental in a Box — $15,000",
  ecommerce: "Credit + Funding + Rentals — $25,000",
  ecosystem: "Full Done-For-You Ecosystem",
  operator: "Operator Program",
  consult: "Strategy Call",
  aixmode: "AIX Mode",
  opsKit: "Ops Kit",
  commandKit: "Command Kit",
  dealerBundle: "Dealer Bundle",
};

/**
 * Label for a raw ?offer= value, or null when it is absent or unrecognised.
 *
 * Object.hasOwn, not a bare index: `?offer=__proto__` returned the inherited
 * prototype object through a plain lookup, so a crafted URL put `[object
 * Object]` in the heading. The value comes straight off the query string, so
 * it is attacker-controlled and only an own key may ever match.
 */
export function offerLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return Object.hasOwn(LABELS, raw) ? (LABELS as Record<string, string>)[raw] : null;
}
