"use client";

import { useCallback, useEffect, useState } from "react";
import type { RentalRateSuggestion } from "@/lib/rental-pricing/suggest-rental-rate";
import { DEFAULT_INSURANCE_MARKUP } from "@/lib/rental-pricing/suggest-rental-rate";

type Props = {
  acquisitionCost?: string | number | null;
  listPrice?: string | number | null;
  operatorInsuranceMonthly?: string | number | null;
  insuranceMarkup?: string | number | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  tier?: string | null;
  onApplySuggested?: (rates: {
    weekly: number;
    daily: number;
    lowestWeekly: number;
  }) => void;
};

function num(v: string | number | null | undefined): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function RentalRateEstimatePanel({
  acquisitionCost,
  listPrice,
  operatorInsuranceMonthly,
  insuranceMarkup,
  make,
  model,
  year,
  tier,
  onApplySuggested,
}: Props) {
  const [suggestion, setSuggestion] = useState<RentalRateSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const acq = num(acquisitionCost);
    const list = num(listPrice);
    const ins = num(operatorInsuranceMonthly);
    const markup = num(insuranceMarkup);
    if (acq != null) params.set("acquisitionCost", String(acq));
    if (list != null) params.set("listPrice", String(list));
    if (ins != null) params.set("operatorInsuranceMonthly", String(ins));
    if (markup != null) params.set("insuranceMarkup", String(markup));
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    const y = num(year);
    if (y != null) params.set("year", String(y));
    if (tier) params.set("tier", tier);

    try {
      const res = await fetch(`/api/rental/estimate?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Estimate failed");
        setSuggestion(null);
        return;
      }
      setSuggestion(json.suggestion);
    } catch {
      setError("Could not load estimate");
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  }, [acquisitionCost, listPrice, operatorInsuranceMonthly, insuranceMarkup, make, model, year, tier]);

  useEffect(() => {
    const t = setTimeout(fetchEstimate, 400);
    return () => clearTimeout(t);
  }, [fetchEstimate]);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">Suggested let-go rate</p>
        <button
          type="button"
          onClick={fetchEstimate}
          className="text-xs text-primary hover:underline"
          disabled={loading}
        >
          {loading ? "Calculating…" : "Recalculate"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses vehicle value (cost/list) for baseline rent and your monthly insurance × at least{" "}
        {DEFAULT_INSURANCE_MARKUP}× for the renter insurance portion.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {suggestion && !error && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Weekly (let go)</p>
              <p className="text-lg font-semibold">
                ${(suggestion.suggestedWeeklyLetGoCents / 100).toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Daily</p>
              <p className="text-lg font-semibold">
                ${(suggestion.suggestedDailyLetGoCents / 100).toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rent (vehicle only)</p>
              <p className="font-medium">${(suggestion.vehicleWeeklyRentCents / 100).toFixed(0)}/wk</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Insurance pass-through</p>
              <p className="font-medium">
                ${(suggestion.renterInsuranceWeeklyCents / 100).toFixed(0)}/wk
                <span className="text-muted-foreground text-xs">
                  {" "}
                  (${(suggestion.renterInsuranceMonthlyCents / 100).toFixed(0)}/mo)
                </span>
              </p>
            </div>
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            {suggestion.breakdown.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {onApplySuggested && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() =>
                onApplySuggested({
                  weekly: suggestion.suggestedWeeklyLetGoCents / 100,
                  daily: suggestion.suggestedDailyLetGoCents / 100,
                  lowestWeekly: suggestion.suggestedLowestWeeklyCents / 100,
                })
              }
            >
              Apply suggested rates to form
            </button>
          )}
        </>
      )}
    </div>
  );
}
