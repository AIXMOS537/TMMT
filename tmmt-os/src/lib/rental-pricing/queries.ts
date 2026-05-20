import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PricingRuleRow } from "./types";
import type { InsuranceProductRow } from "@/lib/rental-insurance/resolve";

export async function fetchPricingRules(): Promise<PricingRuleRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_pricing_rules")
    .select(
      "id, tier, make, model, year_min, year_max, daily_rate_cents, weekly_rate_cents, deposit_cents, match_priority"
    )
    .eq("active", true)
    .order("match_priority", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw error;
  }
  return (data ?? []) as PricingRuleRow[];
}

export async function fetchInsuranceProducts(): Promise<InsuranceProductRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_insurance_products")
    .select(
      "tier, coverage_source, name, weekly_premium_cents, min_liability_cents, requires_background_approved, corporate_carrier_name, corporate_policy_template"
    )
    .eq("active", true);

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw error;
  }
  return (data ?? []) as InsuranceProductRow[];
}
