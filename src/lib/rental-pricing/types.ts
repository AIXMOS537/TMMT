export type VehicleTier = "economy" | "mid" | "luxury";

export type InsuranceCoverageSource =
  | "renter_own"
  | "tmmt_internal"
  | "corporate_non_owner"
  | "pending";

export type PricingRuleRow = {
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
};

export type VehicleInput = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  tier?: VehicleTier | null;
};

export type RentalQuoteInput = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  tier?: VehicleTier | null;
  rentalDays?: number;
  insuranceSource?: InsuranceCoverageSource;
  backgroundCheckStatus?: string | null;
  riskScore?: number | null;
  /** Cost-basis pricing overrides matrix when set with insurance monthly. */
  acquisitionCostCents?: number | null;
  listPriceCents?: number | null;
  operatorInsuranceMonthlyCents?: number | null;
  insuranceMarkupMultiplier?: number | null;
  useCostBasis?: boolean;
};

export type RentalQuoteLine = {
  label: string;
  amountCents: number;
  kind: "rent" | "deposit" | "insurance";
};

export type RentalRateEstimateSummary = {
  vehicleValueCents: number;
  vehicleWeeklyRentCents: number;
  renterInsuranceWeeklyCents: number;
  suggestedWeeklyLetGoCents: number;
  suggestedDailyLetGoCents: number;
  breakdown: string[];
};

export type RentalQuote = {
  tier: VehicleTier;
  make: string | null;
  model: string | null;
  year: number | null;
  pricingRuleId: string | null;
  pricingMode: "matrix" | "cost_basis";
  dailyRateCents: number;
  weeklyRateCents: number;
  depositCents: number;
  insuranceSource: InsuranceCoverageSource;
  insuranceWeeklyCents: number;
  insuranceProductName: string | null;
  lines: RentalQuoteLine[];
  totalCents: number;
  lotReleaseEligible: boolean;
  lotReleaseBlockers: string[];
  costEstimate?: RentalRateEstimateSummary;
};
