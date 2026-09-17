import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildQuote,
  eligibleInsurance,
  type InsuranceProduct,
  type PricingRule,
  type QuotableVehicle,
  type RentalQuote,
  type VehicleTier,
} from "./quote";

/**
 * Database side of the quote engine.
 *
 * RLS was verified against production on 2026-09-16 before this file was
 * written, because a table with RLS on and no SELECT policy returns zero rows
 * instead of an error — which reads as "no rates exist" and would quote $0:
 *
 *   rental_pricing_rules      org_member_read (authenticated, is_staff OR is_org_member)
 *                             pricing_rules_anon_browse (anon, active = true)
 *   rental_insurance_products insurance_products_public_read (anon+authenticated, active = true)
 *
 * Both are readable. Org scoping is enforced by the policy, not by this file,
 * so callers do not pass an org id — but see the zero-row guard below: an empty
 * result is still treated as a hard failure, never as a free rental.
 */

const RULE_COLUMNS =
  "id, tier, make, model, year_min, year_max, daily_rate_cents, weekly_rate_cents, deposit_cents, match_priority, active";

const INSURANCE_COLUMNS =
  "id, tier, coverage_source, name, weekly_premium_cents, min_liability_cents, requires_background_approved, active";

export async function fetchPricingRules(supabase: SupabaseClient): Promise<PricingRule[]> {
  const { data, error } = await supabase
    .from("rental_pricing_rules")
    .select(RULE_COLUMNS)
    .eq("active", true);
  if (error) throw new Error(`rental_pricing_rules read failed: ${error.message}`);
  return (data ?? []) as PricingRule[];
}

export async function fetchInsuranceProducts(supabase: SupabaseClient): Promise<InsuranceProduct[]> {
  const { data, error } = await supabase
    .from("rental_insurance_products")
    .select(INSURANCE_COLUMNS)
    .eq("active", true);
  if (error) throw new Error(`rental_insurance_products read failed: ${error.message}`);
  return (data ?? []) as InsuranceProduct[];
}

export type QuoteFailure =
  | { ok: false; reason: "no_pricing_rules" }
  | { ok: false; reason: "no_matching_rule" }
  | { ok: false; reason: "insurance_required_background_not_approved" };

export type QuoteSuccess = {
  ok: true;
  quote: RentalQuote;
  /** Every coverage the renter may legitimately pick, cheapest first. */
  insuranceOptions: InsuranceProduct[];
};

export type QuoteResult = QuoteSuccess | QuoteFailure;

/**
 * Quote a vehicle for a term.
 *
 * Fails CLOSED in three distinct ways rather than returning a cheap-looking
 * number. A caller that ignores `ok` gets a type error, not a $0 booking.
 *
 * `insuranceProductId` is optional: omit it to price the rental bare and show
 * the renter their options; pass it to lock coverage into the quote. Passing an
 * id the renter is not eligible for is refused, not silently dropped.
 */
export async function quoteVehicle(
  supabase: SupabaseClient,
  args: {
    vehicle: QuotableVehicle;
    days: number;
    backgroundApproved: boolean;
    insuranceProductId?: string | null;
  }
): Promise<QuoteResult> {
  const [rules, products] = await Promise.all([
    fetchPricingRules(supabase),
    fetchInsuranceProducts(supabase),
  ]);

  // Zero rows is not "everything is free" — it means RLS shut us out or the
  // rate card was emptied. Either way, refuse.
  if (rules.length === 0) return { ok: false, reason: "no_pricing_rules" };

  const insuranceOptions = eligibleInsurance(products, {
    tier: args.vehicle.tier,
    backgroundApproved: args.backgroundApproved,
  });

  let chosen: InsuranceProduct | null = null;
  if (args.insuranceProductId) {
    chosen = insuranceOptions.find((p) => p.id === args.insuranceProductId) ?? null;
    if (!chosen) return { ok: false, reason: "insurance_required_background_not_approved" };
  }

  const quote = buildQuote({
    vehicle: args.vehicle,
    rules,
    days: args.days,
    insuranceProduct: chosen,
  });
  if (!quote) return { ok: false, reason: "no_matching_rule" };

  return { ok: true, quote, insuranceOptions };
}

/**
 * Maps a row from the LIVE `fleet` table (43 rows, Airtable-derived) onto the
 * shape the quote engine wants.
 *
 * TIER IS NOT READ FROM `vehicle_class`. Verified against production
 * 2026-09-16: only 3 of 43 rows have a vehicle_class at all, and all three are
 * wrong — a Tesla Model 3 filed as "sport_bike", a 2013 Corolla as
 * "sport_car", a Model Y as "sport_suv". Deriving a price tier from that
 * column would misprice the fleet in both directions.
 *
 * So tier must be passed in deliberately by the caller (an operator choosing
 * it, or a backfill that sets it once per car). With no tier there is no
 * tier-card quote — but the car can still be quoted off its own posted price
 * via `fleet-rate.ts`, which is the preferred path anyway.
 */
export function fleetRowToQuotable(
  row: {
    vehicle_make?: string | null;
    vehicle_model?: string | null;
    year?: number | string | null;
  },
  tier: VehicleTier
): QuotableVehicle {
  const yearNum =
    typeof row.year === "number"
      ? row.year
      : typeof row.year === "string" && row.year.trim() !== ""
        ? Number(row.year)
        : null;

  return {
    tier,
    make: row.vehicle_make?.trim() ?? null,
    model: row.vehicle_model?.trim() ?? null,
    year: yearNum !== null && Number.isFinite(yearNum) ? yearNum : null,
  };
}

/**
 * Normalises a tier that a HUMAN supplied (a form select, a backfill script).
 * Deliberately NOT applied to `fleet.vehicle_class` — see above.
 */
export function normalizeTier(value: string | null | undefined): VehicleTier | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (["economy", "econ", "standard", "base"].includes(v)) return "economy";
  if (["mid", "mid-tier", "midtier", "mid tier", "premium"].includes(v)) return "mid";
  if (["luxury", "lux", "exotic"].includes(v)) return "luxury";
  return null;
}
