"use client";

import { useEffect, useMemo, useState } from "react";
import { STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT } from "@/lib/rental-pricing/constants";
import { DiscountApprovalActions } from "@/components/DiscountApprovalActions";
import {
  evaluateDiscount,
  findAlternativeVehicles,
  type DiscountMode,
  type FleetVehicleForPricing,
} from "@/lib/rental-pricing/evaluate-discount";
import { suggestRentalRateFromFleetRow } from "@/lib/rental-pricing/suggest-rental-rate";

type Props = {
  acquisitionCost?: string | number | null;
  listPrice?: string | number | null;
  operatorInsuranceMonthly?: string | number | null;
  insuranceMarkup?: string | number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  year?: string | number | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  fleet?: FleetVehicleForPricing[];
  onApplyCloseRate?: (weekly: number) => void;
};

function num(v: string | number | null | undefined): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function FleetDiscountPanel({
  acquisitionCost,
  listPrice,
  operatorInsuranceMonthly,
  insuranceMarkup,
  vehicleMake,
  vehicleModel,
  year,
  vehicleId,
  vehicleName,
  fleet = [],
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
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        year: num(year),
      }),
    [acquisitionCost, listPrice, operatorInsuranceMonthly, insuranceMarkup, vehicleMake, vehicleModel, year]
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
    if (!evaluation?.shouldReferAlternatives) return [];
    const target =
      discountMode === "target_weekly"
        ? Number(discountValue)
        : evaluation.discountedWeeklyCents / 100;
    return findAlternativeVehicles(target, fleet, { excludeVehicleId: vehicleId ?? undefined });
  }, [evaluation, discountMode, discountValue, fleet, vehicleId]);

  const statusClass =
    evaluation?.status === "approved"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : evaluation?.status === "marginal"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-red-50 border-red-200 text-red-900";

  return (
    <div className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-3 text-sm">
      <p className="font-medium text-gray-900 dark:text-white">Close deal — discount</p>
      <p className="text-xs text-gray-600 dark:text-slate-400">
        List ${(suggestion.suggestedWeeklyLetGoCents / 100).toFixed(0)}/wk · Floor $
        {(suggestion.minAcceptableWeeklyCents / 100).toFixed(0)}/wk · Max $
        {suggestion.maxDiscountWeeklyDollars.toFixed(0)}/wk off · Staff auto-approve up to{" "}
        {STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT}% off
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          Type
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 dark:bg-slate-800"
            value={discountMode}
            onChange={(e) => setDiscountMode(e.target.value as DiscountMode)}
          >
            <option value="percent">% off</option>
            <option value="fixed_off">$ off / week</option>
            <option value="target_weekly">Client $/week</option>
          </select>
        </label>
        <label className="text-xs">
          Value
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1.5 dark:bg-slate-800"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </label>
      </div>
      {evaluation && (
        <div className={`rounded border p-3 ${statusClass}`}>
          <p className="font-medium capitalize">{evaluation.status}</p>
          <p className="text-xs mt-1">{evaluation.message}</p>
          <p className="text-xs mt-1">
            Close at ${(evaluation.discountedWeeklyCents / 100).toFixed(0)}/wk · Margin{" "}
            {evaluation.vehicleMarginPercent.toFixed(1)}%
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
        <div className="border-t pt-2 space-y-1">
          <p className="font-medium text-xs">Refer — other vehicles at this price</p>
          {vehicleName && (
            <p className="text-xs text-gray-500">{vehicleName} cannot clear margin here.</p>
          )}
          <ul className="space-y-1">
            {alternatives.map((a) => (
              <li key={a.vehicleId ?? a.label} className="text-xs flex justify-between gap-2">
                <span>{a.label}</span>
                <span>{a.vehicleMarginPercent.toFixed(1)}% margin</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
