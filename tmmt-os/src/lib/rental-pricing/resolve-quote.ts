import type {
  InsuranceCoverageSource,
  PricingRuleRow,
  RentalQuote,
  RentalQuoteInput,
  RentalQuoteLine,
  VehicleTier,
} from "./types";
import { inferVehicleTier } from "./infer-tier";
import {
  resolveVehicleValueCents,
  suggestRentalRate,
} from "./suggest-rental-rate";
import {
  resolveInsuranceForQuote,
  type InsuranceProductRow,
} from "@/lib/rental-insurance/resolve";

const TIER_DEFAULTS: Record<
  VehicleTier,
  { daily: number; weekly: number; deposit: number }
> = {
  economy: { daily: 4500, weekly: 28000, deposit: 40000 },
  mid: { daily: 7500, weekly: 47000, deposit: 50000 },
  luxury: { daily: 15000, weekly: 95000, deposit: 100000 },
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function ruleMatches(
  rule: PricingRuleRow,
  tier: VehicleTier,
  make: string,
  model: string,
  year: number | null
): boolean {
  if (rule.tier !== tier || !rule) return false;
  if (rule.make && norm(rule.make) !== make) return false;
  if (rule.model && norm(rule.model) !== model) return false;
  if (year != null && rule.year_min != null && year < rule.year_min) return false;
  if (year != null && rule.year_max != null && year > rule.year_max) return false;
  return true;
}

export function pickPricingRule(
  rules: PricingRuleRow[],
  tier: VehicleTier,
  make: string | null,
  model: string | null,
  year: number | null
): PricingRuleRow | null {
  const m = norm(make);
  const mod = norm(model);
  const matches = rules
    .filter((r) => ruleMatches(r, tier, m, mod, year))
    .sort((a, b) => b.match_priority - a.match_priority);
  return matches[0] ?? rules.find((r) => r.tier === tier && !r.make && !r.model) ?? null;
}

export function resolveRentalQuote(
  input: RentalQuoteInput,
  pricingRules: PricingRuleRow[],
  insuranceProducts: InsuranceProductRow[]
): RentalQuote {
  const tier = input.tier ?? inferVehicleTier(input);
  const make = input.make?.trim() || null;
  const model = input.model?.trim() || null;
  const year = input.year ?? null;

  const rule = pickPricingRule(pricingRules, tier, make, model, year);
  const defaults = TIER_DEFAULTS[tier];

  const useCostBasis =
    input.useCostBasis ||
    (input.operatorInsuranceMonthlyCents != null && input.operatorInsuranceMonthlyCents > 0) ||
    input.acquisitionCostCents != null ||
    input.listPriceCents != null;

  let pricingMode: "matrix" | "cost_basis" = "matrix";
  let dailyRateCents = rule?.daily_rate_cents ?? defaults.daily;
  let weeklyRateCents = rule?.weekly_rate_cents ?? defaults.weekly;
  let depositCents = rule?.deposit_cents ?? defaults.deposit;
  let costEstimate: RentalQuote["costEstimate"];

  if (useCostBasis) {
    const { cents: vehicleValueCents } = resolveVehicleValueCents({
      acquisitionCostCents: input.acquisitionCostCents,
      listPriceCents: input.listPriceCents,
      make,
      model,
      year,
      tier,
    });
    const suggestion = suggestRentalRate({
      vehicleValueCents,
      operatorInsuranceMonthlyCents: input.operatorInsuranceMonthlyCents ?? 0,
      insuranceMarkupMultiplier: input.insuranceMarkupMultiplier ?? undefined,
      tier,
      make,
      model,
      year,
    });
    pricingMode = "cost_basis";
    weeklyRateCents = suggestion.suggestedWeeklyLetGoCents;
    dailyRateCents = suggestion.suggestedDailyLetGoCents;
    depositCents = suggestion.suggestedDepositCents;
    costEstimate = {
      vehicleValueCents: suggestion.vehicleValueCents,
      vehicleWeeklyRentCents: suggestion.vehicleWeeklyRentCents,
      renterInsuranceWeeklyCents: suggestion.renterInsuranceWeeklyCents,
      suggestedWeeklyLetGoCents: suggestion.suggestedWeeklyLetGoCents,
      suggestedDailyLetGoCents: suggestion.suggestedDailyLetGoCents,
      breakdown: suggestion.breakdown,
    };
  }

  const rentalDays = Math.max(1, input.rentalDays ?? 7);
  const rentCents =
    rentalDays >= 7
      ? Math.round((weeklyRateCents / 7) * rentalDays)
      : dailyRateCents * rentalDays;

  const insurance = resolveInsuranceForQuote({
    tier,
    requestedSource: input.insuranceSource ?? "pending",
    backgroundCheckStatus: input.backgroundCheckStatus,
    riskScore: input.riskScore,
    products: insuranceProducts,
  });

  const insuranceWeeklyCents =
    pricingMode === "cost_basis" && costEstimate
      ? costEstimate.renterInsuranceWeeklyCents
      : insurance.weeklyPremiumCents;

  const lines: RentalQuoteLine[] = [
    {
      label: `${tier} rental (${rentalDays} day${rentalDays === 1 ? "" : "s"})`,
      amountCents: rentCents,
      kind: "rent" as const,
    },
    {
      label: "Security deposit",
      amountCents: depositCents,
      kind: "deposit" as const,
    },
  ];

  const showInsuranceLine =
    insuranceWeeklyCents > 0 &&
    insurance.source !== "renter_own" &&
    pricingMode !== "cost_basis";

  if (showInsuranceLine) {
    const insuranceTotal = Math.round((insuranceWeeklyCents / 7) * rentalDays);
    lines.push({
      label: insurance.productName ?? "Insurance premium",
      amountCents: insuranceTotal,
      kind: "insurance",
    });
  }

  const insuranceTotalForPeriod = showInsuranceLine
    ? Math.round((insuranceWeeklyCents / 7) * rentalDays)
    : 0;

  const totalCents = rentCents + depositCents + insuranceTotalForPeriod;

  return {
    tier,
    make,
    model,
    year,
    pricingRuleId: pricingMode === "matrix" ? rule?.id ?? null : null,
    pricingMode,
    dailyRateCents,
    weeklyRateCents,
    depositCents,
    insuranceSource: insurance.source,
    insuranceWeeklyCents,
    insuranceProductName:
      pricingMode === "cost_basis"
        ? "Insurance (operator cost × markup)"
        : insurance.productName,
    lines,
    totalCents,
    lotReleaseEligible: insurance.lotReleaseEligible,
    lotReleaseBlockers: insurance.blockers,
    costEstimate,
  };
}

export type { InsuranceCoverageSource };
