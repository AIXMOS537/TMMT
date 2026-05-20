import type { VehicleTier, VehicleInput } from "./types";
import { inferVehicleTier } from "./infer-tier";
import {
  DEFAULT_INSURANCE_MARKUP,
  DEFAULT_MIN_VEHICLE_MARGIN_PERCENT,
  DEFAULT_PROFIT_MARGIN_PERCENT,
} from "./constants";

export { DEFAULT_INSURANCE_MARKUP } from "./constants";

/** Weekly rent as % of vehicle value — baseline “price of the car” recovery by tier. */
const WEEKLY_VALUE_RATE: Record<VehicleTier, number> = {
  economy: 0.0085,
  mid: 0.0105,
  luxury: 0.0135,
};

const TIER_DEPOSIT_FLOOR_CENTS: Record<VehicleTier, number> = {
  economy: 40000,
  mid: 50000,
  luxury: 100000,
};

/** Rough MSRP proxy when no acquisition/list price on file. */
const TIER_VALUE_PROXY_CENTS: Record<VehicleTier, number> = {
  economy: 2_800_000,
  mid: 4_500_000,
  luxury: 9_500_000,
};

const DEPOSIT_PERCENT_OF_VALUE = 0.06;
const DAILY_VS_WEEKLY_PREMIUM = 1.1;

export type SuggestRentalRateInput = {
  vehicleValueCents: number;
  operatorInsuranceMonthlyCents: number;
  insuranceMarkupMultiplier?: number;
  tier?: VehicleTier;
  profitMarginPercent?: number;
  make?: string | null;
  model?: string | null;
  year?: number | null;
};

export type RentalRateSuggestion = {
  tier: VehicleTier;
  vehicleValueCents: number;
  vehicleValueSource: "provided" | "estimated";
  operatorInsuranceMonthlyCents: number;
  insuranceMarkupMultiplier: number;
  renterInsuranceMonthlyCents: number;
  renterInsuranceWeeklyCents: number;
  baselineWeeklyFromValueCents: number;
  profitMarginPercent: number;
  vehicleWeeklyRentCents: number;
  /** Total weekly to let the car go (rent + insurance pass-through). */
  suggestedWeeklyLetGoCents: number;
  suggestedDailyLetGoCents: number;
  suggestedDepositCents: number;
  suggestedLowestWeeklyCents: number;
  /** Hard floor — discounts below this should refer to other vehicles. */
  minAcceptableWeeklyCents: number;
  minVehicleMarginPercent: number;
  maxDiscountWeeklyDollars: number;
  breakdown: string[];
};

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Estimate depreciated value from tier + year when cost fields are missing. */
export function estimateVehicleValueCents(input: VehicleInput): number {
  const tier = input.tier ?? inferVehicleTier(input);
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - (input.year ?? currentYear));
  const depreciation = Math.pow(0.88, age);
  return Math.round(TIER_VALUE_PROXY_CENTS[tier] * depreciation);
}

/** Pick best available vehicle value: acquisition → list → estimated. */
export function resolveVehicleValueCents(input: {
  acquisitionCostCents?: number | null;
  listPriceCents?: number | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  tier?: VehicleTier | null;
}): { cents: number; source: "acquisition" | "list" | "estimated" } {
  if (input.acquisitionCostCents != null && input.acquisitionCostCents > 0) {
    return { cents: input.acquisitionCostCents, source: "acquisition" };
  }
  if (input.listPriceCents != null && input.listPriceCents > 0) {
    return { cents: input.listPriceCents, source: "list" };
  }
  return {
    cents: estimateVehicleValueCents(input),
    source: "estimated",
  };
}

/**
 * Suggest what to charge per week/day from:
 * - Car value (baseline weekly rent)
 * - Operator insurance monthly × markup (≥2×) → renter insurance weekly
 */
export function suggestRentalRate(input: SuggestRentalRateInput): RentalRateSuggestion {
  const tier = input.tier ?? inferVehicleTier(input);
  const markup = Math.max(DEFAULT_INSURANCE_MARKUP, input.insuranceMarkupMultiplier ?? DEFAULT_INSURANCE_MARKUP);
  const marginPct = input.profitMarginPercent ?? DEFAULT_PROFIT_MARGIN_PERCENT;
  const value = Math.max(0, input.vehicleValueCents);
  const opInsMonth = Math.max(0, input.operatorInsuranceMonthlyCents);

  const renterInsuranceMonthlyCents = Math.round(opInsMonth * markup);
  const renterInsuranceWeeklyCents = Math.round((renterInsuranceMonthlyCents * 12) / 52);

  const baselineWeeklyFromValueCents = Math.round(value * WEEKLY_VALUE_RATE[tier]);
  const vehicleWeeklyRentCents = Math.round(
    baselineWeeklyFromValueCents * (1 + marginPct / 100)
  );

  const suggestedWeeklyLetGoCents = vehicleWeeklyRentCents + renterInsuranceWeeklyCents;
  const suggestedDailyLetGoCents = Math.round(
    (suggestedWeeklyLetGoCents / 7) * DAILY_VS_WEEKLY_PREMIUM
  );
  const suggestedDepositCents = Math.max(
    TIER_DEPOSIT_FLOOR_CENTS[tier],
    Math.round(value * DEPOSIT_PERCENT_OF_VALUE)
  );
  const minVehicleMarginPercent = DEFAULT_MIN_VEHICLE_MARGIN_PERCENT;
  const minVehicleRent = Math.round(
    baselineWeeklyFromValueCents * (1 + minVehicleMarginPercent / 100)
  );
  const minAcceptableWeeklyCents = minVehicleRent + renterInsuranceWeeklyCents;
  const suggestedLowestWeeklyCents = minAcceptableWeeklyCents;
  const maxDiscountWeeklyDollars = Math.max(
    0,
    (suggestedWeeklyLetGoCents - minAcceptableWeeklyCents) / 100
  );

  const breakdown = [
    `Vehicle value: $${centsToDollars(value).toLocaleString()} (${tier} tier)`,
    `Baseline rent from value: $${centsToDollars(baselineWeeklyFromValueCents).toFixed(0)}/wk (${(WEEKLY_VALUE_RATE[tier] * 100).toFixed(2)}% of value)`,
    `Rent with ${marginPct}% margin: $${centsToDollars(vehicleWeeklyRentCents).toFixed(0)}/wk`,
    `Your insurance: $${centsToDollars(opInsMonth).toFixed(0)}/mo → renter at ${markup}×: $${centsToDollars(renterInsuranceMonthlyCents).toFixed(0)}/mo ($${centsToDollars(renterInsuranceWeeklyCents).toFixed(0)}/wk)`,
    `Suggested let-go rate: $${centsToDollars(suggestedWeeklyLetGoCents).toFixed(0)}/wk · $${centsToDollars(suggestedDailyLetGoCents).toFixed(0)}/day`,
    `Suggested deposit: $${centsToDollars(suggestedDepositCents).toFixed(0)}`,
    `Margin floor (${minVehicleMarginPercent}%): $${centsToDollars(minAcceptableWeeklyCents).toFixed(0)}/wk · Max discount: $${maxDiscountWeeklyDollars.toFixed(0)}/wk off list`,
  ];

  return {
    tier,
    vehicleValueCents: value,
    vehicleValueSource: "provided",
    operatorInsuranceMonthlyCents: opInsMonth,
    insuranceMarkupMultiplier: markup,
    renterInsuranceMonthlyCents,
    renterInsuranceWeeklyCents,
    baselineWeeklyFromValueCents,
    profitMarginPercent: marginPct,
    vehicleWeeklyRentCents,
    suggestedWeeklyLetGoCents,
    suggestedDailyLetGoCents,
    suggestedDepositCents,
    suggestedLowestWeeklyCents,
    minAcceptableWeeklyCents,
    minVehicleMarginPercent,
    maxDiscountWeeklyDollars,
    breakdown,
  };
}

export function suggestRentalRateFromFleetRow(row: {
  acquisition_cost?: number | null;
  list_price?: number | null;
  acquisition_cost_cents?: number | null;
  list_price_cents?: number | null;
  operator_insurance_monthly?: number | null;
  operator_insurance_monthly_cents?: number | null;
  insurance_markup_multiplier?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  tier?: VehicleTier | null;
}): RentalRateSuggestion {
  const { cents, source } = resolveVehicleValueCents({
    acquisitionCostCents:
      row.acquisition_cost_cents ??
      (row.acquisition_cost != null ? dollarsToCents(Number(row.acquisition_cost)) : null),
    listPriceCents:
      row.list_price_cents ??
      (row.list_price != null ? dollarsToCents(Number(row.list_price)) : null),
    make: row.vehicle_make ?? row.make,
    model: row.vehicle_model ?? row.model,
    year: row.year,
    tier: row.tier,
  });

  const opIns =
    row.operator_insurance_monthly_cents ??
    (row.operator_insurance_monthly != null
      ? dollarsToCents(Number(row.operator_insurance_monthly))
      : 0);

  const suggestion = suggestRentalRate({
    vehicleValueCents: cents,
    operatorInsuranceMonthlyCents: opIns,
    insuranceMarkupMultiplier: row.insurance_markup_multiplier ?? DEFAULT_INSURANCE_MARKUP,
    tier: row.tier ?? undefined,
    make: row.vehicle_make ?? row.make,
    model: row.vehicle_model ?? row.model,
    year: row.year,
  });

  if (source === "estimated") {
    suggestion.vehicleValueSource = "estimated";
    suggestion.breakdown[0] = `Vehicle value (estimated): $${centsToDollars(cents).toLocaleString()} (${suggestion.tier})`;
  } else {
    suggestion.breakdown[0] = `Vehicle value (${source}): $${centsToDollars(cents).toLocaleString()} (${suggestion.tier})`;
  }

  return suggestion;
}
