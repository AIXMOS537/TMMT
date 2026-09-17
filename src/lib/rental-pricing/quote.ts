/**
 * Rental quote resolution — pure, no I/O.
 *
 * WHY THIS EXISTS (2026-09-16)
 * `rental_pricing_rules` has carried 10 active, seeded rows since 2026-06-03 and
 * `rental_insurance_products` has carried 6. Verified against production on
 * 2026-09-16: ZERO lines of application code read either table. Every quote TMMT
 * has given since June was worked out by hand while a complete, coherent rate
 * card sat in the database unread. This module is the missing reader.
 *
 * The matching contract is inferred from the seeded data's own shape, which is
 * a classic most-specific-wins rule table:
 *
 *   tier-only rows           match_priority  0   (economy/mid/luxury floor rates)
 *   make+model rows          match_priority 20-25 (Tesla Model 3, BMW 3 Series...)
 *   make-only luxury rows    match_priority 30   (any Porsche 2018+)
 *   flagship make+model      match_priority 35   (S-Class, 7 Series)
 *
 * So: collect every rule that MATCHES the vehicle, then take the highest
 * match_priority. Ties break toward the more specific rule, then oldest, so the
 * result is deterministic and never depends on row order from the database.
 */

export const VEHICLE_TIERS = ["economy", "mid", "luxury"] as const;
export type VehicleTier = (typeof VEHICLE_TIERS)[number];

/** Mirrors the public.insurance_coverage_source enum exactly. */
export const COVERAGE_SOURCES = [
  "renter_own",
  "tmmt_internal",
  "corporate_non_owner",
  "pending",
] as const;
export type CoverageSource = (typeof COVERAGE_SOURCES)[number];

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

export type InsuranceProduct = {
  id: string;
  tier: VehicleTier;
  coverage_source: CoverageSource;
  name: string;
  weekly_premium_cents: number;
  min_liability_cents: number;
  requires_background_approved: boolean;
  active: boolean;
};

export type QuotableVehicle = {
  tier: VehicleTier;
  make?: string | null;
  model?: string | null;
  year?: number | null;
};

/** Case- and whitespace-insensitive; the rule table and the fleet table disagree on both. */
function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/**
 * A rule matches when every constraint it actually states is satisfied.
 * A null make/model/year bound is a wildcard, which is what makes the
 * priority-0 tier rows act as the floor for their tier.
 */
export function ruleMatches(rule: PricingRule, vehicle: QuotableVehicle): boolean {
  if (!rule.active) return false;
  if (rule.tier !== vehicle.tier) return false;
  if (rule.make !== null && !sameText(rule.make, vehicle.make)) return false;
  if (rule.model !== null && !sameText(rule.model, vehicle.model)) return false;

  // A rule that states a year bound cannot match a vehicle whose year we do not
  // know. Guessing here would silently hand a 2012 car the 2020+ Tesla rate.
  if (rule.year_min !== null || rule.year_max !== null) {
    if (typeof vehicle.year !== "number" || !Number.isFinite(vehicle.year)) return false;
    if (rule.year_min !== null && vehicle.year < rule.year_min) return false;
    if (rule.year_max !== null && vehicle.year > rule.year_max) return false;
  }
  return true;
}

/** How many constraints a rule actually pins down. Used only to break priority ties. */
function specificity(rule: PricingRule): number {
  return (
    (rule.make !== null ? 1 : 0) +
    (rule.model !== null ? 1 : 0) +
    (rule.year_min !== null ? 1 : 0) +
    (rule.year_max !== null ? 1 : 0)
  );
}

/**
 * Most-specific-wins. Returns null when nothing matches — callers must treat
 * that as "no price", never as "free". There is deliberately no fallback rate.
 */
export function resolvePricingRule(
  rules: readonly PricingRule[],
  vehicle: QuotableVehicle
): PricingRule | null {
  const matches = rules.filter((r) => ruleMatches(r, vehicle));
  if (matches.length === 0) return null;

  return matches.reduce((best, candidate) => {
    if (candidate.match_priority !== best.match_priority) {
      return candidate.match_priority > best.match_priority ? candidate : best;
    }
    const cs = specificity(candidate);
    const bs = specificity(best);
    if (cs !== bs) return cs > bs ? candidate : best;
    return candidate.id < best.id ? candidate : best; // stable, order-independent
  });
}

/**
 * Insurance options for a tier, filtered by whether the renter's background
 * check has actually come back approved.
 *
 * `requires_background_approved` is true on all six seeded products, so an
 * unapproved renter gets an EMPTY list, not a cheaper one. That is the correct
 * failure direction: no coverage offered rather than coverage offered on an
 * unvetted driver. `renter_own` is not a product row — it is the renter proving
 * their own policy, handled at verification time.
 */
export function eligibleInsurance(
  products: readonly InsuranceProduct[],
  args: { tier: VehicleTier; backgroundApproved: boolean }
): InsuranceProduct[] {
  return products
    .filter((p) => p.active && p.tier === args.tier)
    .filter((p) => (p.requires_background_approved ? args.backgroundApproved : true))
    .sort((a, b) => a.weekly_premium_cents - b.weekly_premium_cents || a.id.localeCompare(b.id));
}

export type QuoteLine = { label: string; amount_cents: number };

export type RentalQuote = {
  tier: VehicleTier;
  pricing_rule_id: string;
  quoted_daily_cents: number;
  quoted_weekly_cents: number;
  quoted_deposit_cents: number;
  /** Weeks billed. Partial weeks bill the remaining days at the daily rate. */
  weeks: number;
  extra_days: number;
  insurance: { product_id: string; name: string; weekly_premium_cents: number } | null;
  lines: QuoteLine[];
  /** Rent + insurance for the term. Excludes the refundable deposit. */
  subtotal_cents: number;
  /** What the renter must actually put up front: subtotal + refundable deposit. */
  due_now_cents: number;
};

/**
 * Whole weeks bill weekly, leftover days bill daily, and the daily leftover is
 * capped at the weekly rate so a 13-day rental can never cost more than 14 days.
 * Gig drivers rent by the week, so the weekly rate is the real product here.
 */
export function buildQuote(args: {
  vehicle: QuotableVehicle;
  rules: readonly PricingRule[];
  days: number;
  insuranceProduct?: InsuranceProduct | null;
}): RentalQuote | null {
  const days = Math.max(1, Math.floor(args.days));
  const rule = resolvePricingRule(args.rules, args.vehicle);
  if (!rule) return null;

  const weeks = Math.floor(days / 7);
  const extraDays = days % 7;

  const weeklyPortion = weeks * rule.weekly_rate_cents;
  // Never let the daily remainder exceed one more week.
  const dailyPortion = Math.min(extraDays * rule.daily_rate_cents, rule.weekly_rate_cents);

  const lines: QuoteLine[] = [];
  if (weeks > 0) lines.push({ label: `Rental — ${weeks} week${weeks === 1 ? "" : "s"}`, amount_cents: weeklyPortion });
  if (extraDays > 0) lines.push({ label: `Rental — ${extraDays} day${extraDays === 1 ? "" : "s"}`, amount_cents: dailyPortion });

  const ins = args.insuranceProduct ?? null;
  // Insurance is priced weekly, so any partial week is a billed week.
  const insuranceWeeks = weeks + (extraDays > 0 ? 1 : 0);
  const insuranceTotal = ins ? ins.weekly_premium_cents * insuranceWeeks : 0;
  if (ins) {
    lines.push({
      label: `${ins.name} — ${insuranceWeeks} week${insuranceWeeks === 1 ? "" : "s"}`,
      amount_cents: insuranceTotal,
    });
  }

  const subtotal = weeklyPortion + dailyPortion + insuranceTotal;

  return {
    tier: rule.tier,
    pricing_rule_id: rule.id,
    quoted_daily_cents: rule.daily_rate_cents,
    quoted_weekly_cents: rule.weekly_rate_cents,
    quoted_deposit_cents: rule.deposit_cents,
    weeks,
    extra_days: extraDays,
    insurance: ins
      ? { product_id: ins.id, name: ins.name, weekly_premium_cents: ins.weekly_premium_cents }
      : null,
    lines,
    subtotal_cents: subtotal,
    due_now_cents: subtotal + rule.deposit_cents,
  };
}

/** Cents -> "$1,234.00". Quotes are money; never render raw cents to a renter. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
