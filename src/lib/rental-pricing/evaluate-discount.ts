import type { VehicleTier } from "./types";
import {
  type RentalRateSuggestion,
  suggestRentalRateFromFleetRow,
} from "./suggest-rental-rate";

import {
  DEFAULT_MIN_VEHICLE_MARGIN_PERCENT,
  INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT,
  MANAGER_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
  STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT,
  SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
} from "./constants";

export {
  DEFAULT_MIN_VEHICLE_MARGIN_PERCENT,
  INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT,
  MANAGER_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
  STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT,
  SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
} from "./constants";

/** Who must sign off before staff applies the discounted rate. */
export type DiscountApprovalTier = "none" | "manager" | "supervisor";

export type DiscountMode = "percent" | "fixed_off" | "target_weekly";

export type DiscountInput = {
  mode: DiscountMode;
  /** Percent off list (10 = 10%), dollars off/week, or target $/week depending on mode. */
  value: number;
};

export type DiscountStatus = "approved" | "marginal" | "rejected";

export type DiscountEvaluation = {
  status: DiscountStatus;
  baseWeeklyCents: number;
  discountedWeeklyCents: number;
  discountCents: number;
  discountPercent: number;
  vehicleRentWeeklyCents: number;
  insuranceWeeklyCents: number;
  vehicleMarginPercent: number;
  minAcceptableWeeklyCents: number;
  targetMarginPercent: number;
  minMarginPercent: number;
  message: string;
  canCloseOnThisVehicle: boolean;
  shouldReferAlternatives: boolean;
  approvalTier: DiscountApprovalTier;
  /** >10% and <30% — manager may approve. */
  requiresManagerApproval: boolean;
  /** ≥30% — supervisor or owner must approve. */
  requiresSupervisorApproval: boolean;
  /** ≥20% and <30% — manager can close but supervisor/owner should be notified internally. */
  requiresInternalSupervisorNotify: boolean;
  internalNotifyMessage: string | null;
  managerApprovalThresholdPercent: number;
  supervisorApprovalThresholdPercent: number;
  internalNotifyMinPercent: number;
  staffAutoApproveMaxDiscountPercent: number;
};

export type FleetVehicleForPricing = {
  id?: string;
  vehicle_name?: string | null;
  label?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  tier?: VehicleTier | null;
  vehicle_status?: string | null;
  status?: string | null;
  acquisition_cost?: number | null;
  list_price?: number | null;
  operator_insurance_monthly?: number | null;
  insurance_markup_multiplier?: number | null;
  min_margin_percent?: number | null;
};

export type VehicleAlternative = {
  vehicleId: string | null;
  label: string;
  make: string | null;
  model: string | null;
  year: number | null;
  tier: VehicleTier;
  status: string | null;
  suggestedWeeklyCents: number;
  minAcceptableWeeklyCents: number;
  atClientTargetWeeklyCents: number;
  vehicleMarginPercent: number;
  headroomCents: number;
};

const AVAILABLE_STATUSES = new Set([
  "available",
  "coming soon",
  "active",
  "true",
]);

export function computeMinAcceptableWeekly(
  suggestion: RentalRateSuggestion,
  minVehicleMarginPercent?: number
): number {
  const minMargin = minVehicleMarginPercent ?? DEFAULT_MIN_VEHICLE_MARGIN_PERCENT;
  const minVehicleRent = Math.round(
    suggestion.baselineWeeklyFromValueCents * (1 + minMargin / 100)
  );
  return minVehicleRent + suggestion.renterInsuranceWeeklyCents;
}

export function vehicleMarginPercent(
  suggestion: RentalRateSuggestion,
  discountedWeeklyCents: number
): number {
  const vehicleRent = discountedWeeklyCents - suggestion.renterInsuranceWeeklyCents;
  if (suggestion.baselineWeeklyFromValueCents <= 0) return 0;
  return (
    ((vehicleRent - suggestion.baselineWeeklyFromValueCents) /
      suggestion.baselineWeeklyFromValueCents) *
    100
  );
}

export function resolveDiscountApprovalTier(
  discountPercent: number,
  options?: {
    staffMaxPercent?: number;
    supervisorThresholdPercent?: number;
  }
): DiscountApprovalTier {
  const staffMax = options?.staffMaxPercent ?? STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT;
  const supervisorAt =
    options?.supervisorThresholdPercent ?? SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT;

  if (discountPercent >= supervisorAt) return "supervisor";
  if (discountPercent > staffMax) return "manager";
  return "none";
}

/** @deprecated Use resolveDiscountApprovalTier */
export function discountRequiresManagerApproval(
  discountPercent: number,
  thresholdPercent: number = MANAGER_APPROVAL_DISCOUNT_THRESHOLD_PERCENT
): boolean {
  const tier = resolveDiscountApprovalTier(discountPercent, {
    staffMaxPercent: thresholdPercent,
  });
  return tier === "manager";
}

export function evaluateDiscount(
  suggestion: RentalRateSuggestion,
  input: DiscountInput,
  options?: {
    minVehicleMarginPercent?: number;
    managerApprovalThresholdPercent?: number;
  }
): DiscountEvaluation {
  const minMargin = options?.minVehicleMarginPercent ?? DEFAULT_MIN_VEHICLE_MARGIN_PERCENT;
  const managerThreshold =
    options?.managerApprovalThresholdPercent ?? MANAGER_APPROVAL_DISCOUNT_THRESHOLD_PERCENT;
  const base = suggestion.suggestedWeeklyLetGoCents;
  const insurance = suggestion.renterInsuranceWeeklyCents;
  const minAcceptable = computeMinAcceptableWeekly(suggestion, minMargin);
  const targetMargin = suggestion.profitMarginPercent;

  let discountedWeekly: number;
  let discountCents: number;

  switch (input.mode) {
    case "percent": {
      const pct = Math.min(100, Math.max(0, input.value));
      discountCents = Math.round(base * (pct / 100));
      discountedWeekly = base - discountCents;
      break;
    }
    case "fixed_off": {
      discountCents = Math.round(input.value * 100);
      discountedWeekly = base - discountCents;
      break;
    }
    case "target_weekly": {
      discountedWeekly = Math.round(input.value * 100);
      discountCents = Math.max(0, base - discountedWeekly);
      break;
    }
  }

  discountedWeekly = Math.max(insurance, discountedWeekly);
  const vehicleRent = discountedWeekly - insurance;
  const marginPct = vehicleMarginPercent(suggestion, discountedWeekly);
  const discountPercent = base > 0 ? (discountCents / base) * 100 : 0;

  let status: DiscountStatus;
  let message: string;
  let canClose = false;
  let shouldRefer = false;

  if (discountedWeekly >= minAcceptable && marginPct >= minMargin) {
    if (marginPct >= targetMargin * 0.65) {
      status = "approved";
      message = `Discount approved — ${marginPct.toFixed(1)}% margin on vehicle rent (floor ${minMargin}%).`;
      canClose = true;
    } else {
      status = "marginal";
      message = `Can close with manager awareness — margin ${marginPct.toFixed(1)}% is above floor ${minMargin}% but below target ${targetMargin}%.`;
      canClose = true;
    }
  } else if (discountedWeekly >= minAcceptable) {
    status = "marginal";
    message = `Total meets floor $${(minAcceptable / 100).toFixed(0)}/wk but vehicle margin ${marginPct.toFixed(1)}% is thin — confirm before closing.`;
    canClose = true;
  } else {
    status = "rejected";
    shouldRefer = true;
    canClose = false;
    message = `Cannot close on this unit at $${(discountedWeekly / 100).toFixed(0)}/wk — floor is $${(minAcceptable / 100).toFixed(0)}/wk (${minMargin}% min margin). Refer client to another vehicle.`;
  }

  const approvalTier = canClose
    ? resolveDiscountApprovalTier(discountPercent, {
        staffMaxPercent: STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT,
        supervisorThresholdPercent: SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
      })
    : "none";

  const requiresManagerApproval = approvalTier === "manager";
  const requiresSupervisorApproval = approvalTier === "supervisor";
  const requiresInternalSupervisorNotify =
    requiresManagerApproval &&
    discountPercent >= INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT &&
    discountPercent < SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT;

  let internalNotifyMessage: string | null = null;
  if (requiresInternalSupervisorNotify) {
    internalNotifyMessage =
      discountPercent >= INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT
        ? `Internal flag: ${discountPercent.toFixed(1)}% discount — notify supervisor/owner for awareness. Manager may still approve and apply the rate.`
        : null;
  }

  if (requiresManagerApproval) {
    message += ` Manager approval required: ${discountPercent.toFixed(1)}% off (staff auto-approve up to ${STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT}%).`;
    if (requiresInternalSupervisorNotify) {
      message += ` At ${discountPercent.toFixed(1)}%, supervisor/owner should be notified internally; manager sign-off is still sufficient.`;
    }
  } else if (requiresSupervisorApproval) {
    message += ` Supervisor or owner approval required: ${discountPercent.toFixed(1)}% off (at or above ${SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT}%). Manager sign-off alone is not sufficient.`;
  }

  return {
    status,
    baseWeeklyCents: base,
    discountedWeeklyCents: discountedWeekly,
    discountCents,
    discountPercent,
    vehicleRentWeeklyCents: vehicleRent,
    insuranceWeeklyCents: insurance,
    vehicleMarginPercent: marginPct,
    minAcceptableWeeklyCents: minAcceptable,
    targetMarginPercent: targetMargin,
    minMarginPercent: minMargin,
    message,
    canCloseOnThisVehicle: canClose,
    shouldReferAlternatives: shouldRefer,
    approvalTier,
    requiresManagerApproval,
    requiresSupervisorApproval,
    requiresInternalSupervisorNotify,
    internalNotifyMessage,
    managerApprovalThresholdPercent: managerThreshold,
    supervisorApprovalThresholdPercent: SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
    internalNotifyMinPercent: INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT,
    staffAutoApproveMaxDiscountPercent: STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT,
  };
}

export function canApplyDiscountedRate(
  evaluation: DiscountEvaluation,
  approvals: { managerApproved: boolean; supervisorApproved: boolean }
): boolean {
  if (!evaluation.canCloseOnThisVehicle) return false;
  switch (evaluation.approvalTier) {
    case "none":
      return true;
    case "manager":
      return approvals.managerApproved;
    case "supervisor":
      return approvals.supervisorApproved;
    default:
      return false;
  }
}

function vehicleLabel(v: FleetVehicleForPricing): string {
  return (
    v.vehicle_name ??
    v.label ??
    [v.year, v.vehicle_make ?? v.make, v.vehicle_model ?? v.model]
      .filter(Boolean)
      .join(" ") ??
    "Fleet vehicle"
  );
}

function isAvailable(v: FleetVehicleForPricing): boolean {
  const s = String(v.vehicle_status ?? v.status ?? "available").toLowerCase();
  return AVAILABLE_STATUSES.has(s) || s.includes("available");
}

/**
 * When this vehicle cannot close, find other units where the client's target
 * weekly rate still clears the minimum margin floor.
 */
export function findAlternativeVehicles(
  clientTargetWeeklyDollars: number,
  fleet: FleetVehicleForPricing[],
  options?: {
    minVehicleMarginPercent?: number;
    excludeVehicleId?: string | null;
    preferTier?: VehicleTier | null;
    limit?: number;
  }
): VehicleAlternative[] {
  const targetCents = Math.round(clientTargetWeeklyDollars * 100);
  const limit = options?.limit ?? 6;
  const alternatives: VehicleAlternative[] = [];

  for (const v of fleet) {
    if (options?.excludeVehicleId && v.id === options.excludeVehicleId) continue;
    if (!isAvailable(v)) continue;

    const minMargin =
      v.min_margin_percent ?? options?.minVehicleMarginPercent ?? DEFAULT_MIN_VEHICLE_MARGIN_PERCENT;
    const suggestion = suggestRentalRateFromFleetRow(v);
    const minAcceptable = computeMinAcceptableWeekly(suggestion, minMargin);

    if (targetCents < minAcceptable) continue;

    const evaluation = evaluateDiscount(suggestion, {
      mode: "target_weekly",
      value: clientTargetWeeklyDollars,
    }, { minVehicleMarginPercent: minMargin });

    if (!evaluation.canCloseOnThisVehicle) continue;

    alternatives.push({
      vehicleId: v.id ?? null,
      label: vehicleLabel(v),
      make: v.vehicle_make ?? v.make ?? null,
      model: v.vehicle_model ?? v.model ?? null,
      year: v.year ?? null,
      tier: suggestion.tier,
      status: (v.vehicle_status ?? v.status ?? null) as string | null,
      suggestedWeeklyCents: suggestion.suggestedWeeklyLetGoCents,
      minAcceptableWeeklyCents: minAcceptable,
      atClientTargetWeeklyCents: targetCents,
      vehicleMarginPercent: evaluation.vehicleMarginPercent,
      headroomCents: targetCents - minAcceptable,
    });
  }

  alternatives.sort((a, b) => {
    if (options?.preferTier) {
      const aTier = a.tier === options.preferTier ? 1 : 0;
      const bTier = b.tier === options.preferTier ? 1 : 0;
      if (aTier !== bTier) return bTier - aTier;
    }
    return b.vehicleMarginPercent - a.vehicleMarginPercent;
  });

  return alternatives.slice(0, limit);
}

/** Max discount ($/wk off) that still clears the margin floor on this vehicle. */
export function maxDiscountWeeklyDollars(
  suggestion: RentalRateSuggestion,
  minVehicleMarginPercent?: number
): number {
  const minAcceptable = computeMinAcceptableWeekly(suggestion, minVehicleMarginPercent);
  return Math.max(0, (suggestion.suggestedWeeklyLetGoCents - minAcceptable) / 100);
}
