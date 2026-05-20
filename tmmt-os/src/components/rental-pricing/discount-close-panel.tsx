"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluateDiscount,
  findAlternativeVehicles,
  maxDiscountWeeklyDollars,
  type DiscountMode,
  type FleetVehicleForPricing,
} from "@/lib/rental-pricing/evaluate-discount";
import { suggestRentalRateFromFleetRow } from "@/lib/rental-pricing/suggest-rental-rate";
import { STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT } from "@/lib/rental-pricing/constants";
import { DiscountApprovalActions } from "@/components/rental-pricing/discount-approval-actions";

type Props = {
  acquisitionCost?: string | number | null;
  listPrice?: string | number | null;
  operatorInsuranceMonthly?: string | number | null;
  insuranceMarkup?: string | number | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  tier?: string | null;
  vehicleId?: string | null;
  vehicleLabel?: string | null;
  /** Other fleet rows for referral when this unit cannot close */
  fleetAlternates?: FleetVehicleForPricing[];
  onApplyCloseRate?: (weekly: number) => void;
};

function num(v: string | number | null | undefined): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function DiscountClosePanel({
  acquisitionCost,
  listPrice,
  operatorInsuranceMonthly,
  insuranceMarkup,
  make,
  model,
  year,
  tier,
  vehicleId,
  vehicleLabel,
  fleetAlternates = [],
  onApplyCloseRate,
}: Props) {
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [managerApproved, setManagerApproved] = useState(false);
  const [supervisorApproved, setSupervisorApproved] = useState(false);

  const suggestion = useMemo(
    () =>
      suggestRentalRateFromFleetRow({
        acquisition_cost: num(acquisitionCost),
        list_price: num(listPrice),
        operator_insurance_monthly: num(operatorInsuranceMonthly),
        insurance_markup_multiplier: num(insuranceMarkup),
        vehicle_make: make,
        vehicle_model: model,
        year: num(year),
        tier: tier as "economy" | "mid" | "luxury" | undefined,
      }),
    [acquisitionCost, listPrice, operatorInsuranceMonthly, insuranceMarkup, make, model, year, tier]
  );

  const evaluation = useMemo(() => {
    const value = Number(discountValue);
    if (!Number.isFinite(value)) return null;
    return evaluateDiscount(suggestion, { mode: discountMode, value });
  }, [suggestion, discountMode, discountValue]);

  useEffect(() => {
    setManagerApproved(false);
    setSupervisorApproved(false);
  }, [discountMode, discountValue]);

  const alternatives = useMemo(() => {
    if (!evaluation?.shouldReferAlternatives && evaluation?.status !== "rejected") {
      return [];
    }
    const target =
      discountMode === "target_weekly"
        ? Number(discountValue)
        : (evaluation?.discountedWeeklyCents ?? 0) / 100;
    if (!Number.isFinite(target) || target <= 0) return [];
    return findAlternativeVehicles(target, fleetAlternates, {
      excludeVehicleId: vehicleId,
      preferTier: tier as "economy" | "mid" | "luxury" | undefined,
    });
  }, [evaluation, discountMode, discountValue, fleetAlternates, vehicleId, tier]);

  const maxOff = maxDiscountWeeklyDollars(suggestion);

  const statusColor =
    evaluation?.status === "approved"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : evaluation?.status === "marginal"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-red-800 bg-red-50 border-red-200";

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
      <div>
        <p className="font-medium">Close the deal — discount check</p>
        <p className="text-xs text-muted-foreground mt-1">
          List ${(suggestion.suggestedWeeklyLetGoCents / 100).toFixed(0)}/wk · Floor $
          {(suggestion.minAcceptableWeeklyCents / 100).toFixed(0)}/wk · Max discount $
          {maxOff.toFixed(0)}/wk off · Staff auto-approve up to {STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT}%
          off
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Discount type
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={discountMode}
            onChange={(e) => setDiscountMode(e.target.value as DiscountMode)}
          >
            <option value="percent">% off list</option>
            <option value="fixed_off">$ off per week</option>
            <option value="target_weekly">Client target $/week</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {discountMode === "percent"
            ? "Percent off"
            : discountMode === "fixed_off"
              ? "Dollars off / week"
              : "Target $ / week"}
          <input
            type="number"
            step="0.01"
            min={0}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </label>
      </div>

      {evaluation && (
        <div className={`rounded-md border p-3 ${statusColor}`}>
          <p className="font-medium capitalize">{evaluation.status}</p>
          <p className="text-xs mt-1">{evaluation.message}</p>
          <p className="text-xs mt-2">
            Close at <strong>${(evaluation.discountedWeeklyCents / 100).toFixed(0)}/wk</strong>
            {" "}({evaluation.discountPercent.toFixed(1)}% off) · Vehicle margin{" "}
            <strong>{evaluation.vehicleMarginPercent.toFixed(1)}%</strong>
          </p>
          <DiscountApprovalActions
            evaluation={evaluation}
            managerApproved={managerApproved}
            supervisorApproved={supervisorApproved}
            onManagerApprovedChange={setManagerApproved}
            onSupervisorApprovedChange={setSupervisorApproved}
            onApplyCloseRate={onApplyCloseRate}
          />
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="font-medium text-sm">Refer to another vehicle</p>
          <p className="text-xs text-muted-foreground">
            {vehicleLabel
              ? `${vehicleLabel} cannot clear margin at this price. These units can:`
              : "These available units can close at the client's target:"}
          </p>
          <ul className="space-y-2">
            {alternatives.map((alt) => (
              <li
                key={alt.vehicleId ?? alt.label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
              >
                <span>
                  <strong>{alt.label}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · {alt.tier} · {alt.make} {alt.model}
                  </span>
                </span>
                <span className="text-right">
                  ${(alt.atClientTargetWeeklyCents / 100).toFixed(0)}/wk ·{" "}
                  {alt.vehicleMarginPercent.toFixed(1)}% margin
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation?.shouldReferAlternatives && alternatives.length === 0 && fleetAlternates.length > 0 && (
        <p className="text-xs text-amber-700">
          No other vehicles in fleet meet this price with acceptable margin. Consider a higher target
          or different tier.
        </p>
      )}
    </div>
  );
}
