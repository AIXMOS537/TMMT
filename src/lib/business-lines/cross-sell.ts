import { TMMT_BUSINESS_LINES, PRIMARY_PUBLIC_LINE_ID, type BusinessLineId } from "./registry";

/**
 * The services a renter can opt into while they wait for a car.
 *
 * Someone joins the waitlist because the fleet has nothing for them right now.
 * That is the moment they are most reachable and the moment TMMT has the least
 * to sell them — 104 people sat on that list with nothing offered, while
 * `customer_services`, the table built to record exactly this, had never been
 * written to once.
 *
 * Rentals is excluded: they are already waiting for it. Command-center-only
 * lines are excluded because they have no public intake to send anyone to.
 */
export type CrossSellService = {
  id: BusinessLineId;
  slug: string;
  name: string;
  blurb: string;
};

export function crossSellServices(): CrossSellService[] {
  return TMMT_BUSINESS_LINES.filter(
    (l) => l.id !== PRIMARY_PUBLIC_LINE_ID && l.role !== "command_center_only" && l.intake,
  ).map((l) => ({
    id: l.id,
    slug: l.intake!.slug,
    name: l.name,
    blurb: l.tagline || l.intake!.description,
  }));
}

/** Slug -> display name, for validating what came back from a form. */
export function crossSellNameForSlug(slug: string): string | null {
  return crossSellServices().find((s) => s.slug === slug)?.name ?? null;
}
