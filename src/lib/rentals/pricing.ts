// Pure pricing logic — deliberately NOT `import "server-only"`. There are no secrets and no
// I/O here, and the tested libs in this repo (e.g. compliance.ts) follow the same rule:
// `server-only` ships inside Next and does not resolve under vitest, so importing it in pure
// logic buys nothing and costs you the ability to test it. Callers do the DB work.

/**
 * Rental quoting — the app layer for a pricing engine that already exists in the DB.
 *
 * `rental_pricing_rules` (10 live rows) and `rental_insurance_products` (6) were built and
 * populated with real money, then never referenced by a single source file. Nothing here
 * invents pricing; it resolves what is already in the database. If a rate looks wrong, fix
 * the row, not this file.
 *
 * MATCHING CONTRACT (mirrors the table's own design):
 *   - Rules cascade by `match_priority` DESC — specific beats general. Live example:
 *     Mercedes S-Class (35) beats Porsche-any (30) beats BMW 3 Series (25) beats
 *     Tesla (20) beats the tier-wildcard fallback (0).
 *   - `make`/`model` NULL means wildcard.
 *   - `year_min`/`year_max` NULL means unbounded.
 *   - `active=false` rows are invisible.
 *
 * TIER IS NOT TRUSTWORTHY ON THE FLEET ROW. `fleet.vehicle_class` is populated on only 3 of
 * 43 cars, so we do NOT require it. A make/model rule carries its own tier and wins on its
 * own merits; tier is only used for the priority-0 fallback, and when we can't establish one
 * we refuse to quote rather than guess. Guessing a tier here silently misprices a real car.
 */

export type VehicleTier = "economy" | "mid" | "luxury";
export type InsuranceCoverageSource =
  | "renter_own"
  | "tmmt_internal"
  | "corporate_non_owner"
  | "pending";

export type PricingRule = {
  id: string;
  tier: VehicleTier;
  make: string | null;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  daily_rate_cents: number;
  weekly_rate_cents: number;
  deposit_cents: number;
  match_priority: number;
  active: boolean;
};

export type VehicleFacts = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  /** fleet.vehicle_class — null on ~93% of the fleet. Optional on purpose. */
  tier?: VehicleTier | null;
};

export type Quote = {
  rule_id: string;
  tier: VehicleTier;
  daily_cents: number;
  weekly_cents: number;
  deposit_cents: number;
  /** How the rule was reached — surfaced so a human can audit a price, not just see one. */
  matched_on: "make_model_year" | "make_model" | "make" | "tier_fallback";
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function ruleApplies(rule: PricingRule, v: VehicleFacts): boolean {
  if (!rule.active) return false;
  if (rule.make && norm(rule.make) !== norm(v.make)) return false;
  if (rule.model && norm(rule.model) !== norm(v.model)) return false;
  // A rule with a year bound cannot match a vehicle of unknown year — that would be a guess.
  if (rule.year_min != null) {
    if (v.year == null || v.year < rule.year_min) return false;
  }
  if (rule.year_max != null) {
    if (v.year == null || v.year > rule.year_max) return false;
  }
  // Wildcard (priority-0 fallback) rules are tier-addressed: they only apply if we know the tier.
  if (!rule.make && !rule.model) {
    if (!v.tier) return false;
    if (rule.tier !== v.tier) return false;
  }
  return true;
}

function matchedOn(rule: PricingRule): Quote["matched_on"] {
  if (rule.make && rule.model && (rule.year_min != null || rule.year_max != null)) return "make_model_year";
  if (rule.make && rule.model) return "make_model";
  if (rule.make) return "make";
  return "tier_fallback";
}

/**
 * Resolve the winning rule. Returns null when nothing applies — callers MUST treat null as
 * "cannot quote", never as "free" or "use a default". An unpriced car does not leave the lot.
 */
export function resolveQuote(rules: PricingRule[], v: VehicleFacts): Quote | null {
  const applicable = rules.filter((r) => ruleApplies(r, v));
  if (applicable.length === 0) return null;

  // Highest priority wins. Ties broken by the more specific rule, then by lower price —
  // if two rules genuinely tie, quote the customer the cheaper one rather than the luckier one.
  const specificity = (r: PricingRule) => (r.make ? 2 : 0) + (r.model ? 1 : 0);
  applicable.sort(
    (a, b) =>
      b.match_priority - a.match_priority ||
      specificity(b) - specificity(a) ||
      a.daily_rate_cents - b.daily_rate_cents
  );

  const win = applicable[0];
  return {
    rule_id: win.id,
    tier: win.tier,
    daily_cents: win.daily_rate_cents,
    weekly_cents: win.weekly_rate_cents,
    deposit_cents: win.deposit_cents,
    matched_on: matchedOn(win),
  };
}

/**
 * Price a stay. Weekly rate applies per whole week; remainder days bill at the daily rate,
 * capped at the weekly rate so a 6-day remainder can never cost more than a 7-day week.
 */
export function priceStay(quote: Quote, days: number): {
  days: number;
  weeks: number;
  remainder_days: number;
  rental_cents: number;
  deposit_cents: number;
  due_at_signing_cents: number;
} {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`priceStay: days must be a positive integer, got ${days}`);
  }
  const weeks = Math.floor(days / 7);
  const remainder_days = days % 7;
  const remainderRaw = remainder_days * quote.daily_cents;
  const remainderCharged = Math.min(remainderRaw, quote.weekly_cents);
  const rental_cents = weeks * quote.weekly_cents + remainderCharged;
  return {
    days,
    weeks,
    remainder_days,
    rental_cents,
    deposit_cents: quote.deposit_cents,
    due_at_signing_cents: rental_cents + quote.deposit_cents,
  };
}

/** Whole days between two instants, rounded up — a 25-hour rental is 2 days, not 1. */
export function stayDays(startsAt: Date, endsAt: Date): number {
  const ms = endsAt.getTime() - startsAt.getTime();
  if (!(ms > 0)) throw new Error("stayDays: endsAt must be after startsAt");
  return Math.ceil(ms / 86_400_000);
}
