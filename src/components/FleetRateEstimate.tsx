"use client";

import { useMemo } from "react";
import {
  DEFAULT_INSURANCE_MARKUP,
  suggestRentalRateFromFleetRow,
} from "@/lib/rental-pricing/suggest-rental-rate";

type Props = {
  acquisitionCost?: string | number | null;
  listPrice?: string | number | null;
  operatorInsuranceMonthly?: string | number | null;
  insuranceMarkup?: string | number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  year?: string | number | null;
  onApply?: (rates: { weekly: number; daily: number; lowest: number }) => void;
};

function num(v: string | number | null | undefined): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function FleetRateEstimate({
  acquisitionCost,
  listPrice,
  operatorInsuranceMonthly,
  insuranceMarkup,
  vehicleMake,
  vehicleModel,
  year,
  onApply,
}: Props) {
  const suggestion = useMemo(() => {
    return suggestRentalRateFromFleetRow({
      acquisition_cost: num(acquisitionCost),
      list_price: num(listPrice),
      operator_insurance_monthly: num(operatorInsuranceMonthly),
      insurance_markup_multiplier: num(insuranceMarkup) ?? DEFAULT_INSURANCE_MARKUP,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      year: num(year),
    });
  }, [
    acquisitionCost,
    listPrice,
    operatorInsuranceMonthly,
    insuranceMarkup,
    vehicleMake,
    vehicleModel,
    year,
  ]);

  return (
    <div className="sm:col-span-2 rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40 p-4 space-y-2 text-sm">
      <p className="font-medium text-blue-900 dark:text-blue-100">Suggested let-go rate</p>
      <p className="text-xs text-blue-800 dark:text-blue-300">
        Car value sets baseline rent; your monthly insurance × at least {DEFAULT_INSURANCE_MARKUP}×
        is added for the renter.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-blue-700 dark:text-blue-400">Weekly</p>
          <p className="text-lg font-semibold text-blue-950 dark:text-white">
            ${(suggestion.suggestedWeeklyLetGoCents / 100).toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-blue-700 dark:text-blue-400">Daily</p>
          <p className="text-lg font-semibold text-blue-950 dark:text-white">
            ${(suggestion.suggestedDailyLetGoCents / 100).toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-blue-700 dark:text-blue-400">Rent only</p>
          <p className="font-medium">${(suggestion.vehicleWeeklyRentCents / 100).toFixed(0)}/wk</p>
        </div>
        <div>
          <p className="text-xs text-blue-700 dark:text-blue-400">Ins. pass-through</p>
          <p className="font-medium">${(suggestion.renterInsuranceWeeklyCents / 100).toFixed(0)}/wk</p>
        </div>
      </div>
      <ul className="text-xs text-blue-800 dark:text-blue-300 list-disc list-inside space-y-0.5">
        {suggestion.breakdown.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {onApply && (
        <button
          type="button"
          className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
          onClick={() =>
            onApply({
              weekly: suggestion.suggestedWeeklyLetGoCents / 100,
              daily: suggestion.suggestedDailyLetGoCents / 100,
              lowest: suggestion.suggestedLowestWeeklyCents / 100,
            })
          }
        >
          Apply to weekly rate fields
        </button>
      )}
    </div>
  );
}
