"use client";

import {
  canApplyDiscountedRate,
  type DiscountEvaluation,
} from "@/lib/rental-pricing/evaluate-discount";
import {
  INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT,
  STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT,
  SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT,
} from "@/lib/rental-pricing/constants";

type Props = {
  evaluation: DiscountEvaluation;
  managerApproved: boolean;
  supervisorApproved: boolean;
  onManagerApprovedChange: (approved: boolean) => void;
  onSupervisorApprovedChange: (approved: boolean) => void;
  onApplyCloseRate?: (weekly: number) => void;
  applyButtonClassName?: string;
};

export function DiscountApprovalActions({
  evaluation,
  managerApproved,
  supervisorApproved,
  onManagerApprovedChange,
  onSupervisorApprovedChange,
  onApplyCloseRate,
  applyButtonClassName = "mt-2 text-xs font-medium underline",
}: Props) {
  const canApply = canApplyDiscountedRate(evaluation, {
    managerApproved,
    supervisorApproved,
  });

  const applyBlockedLabel =
    evaluation.approvalTier === "supervisor"
      ? "Apply rate (supervisor/owner approval required)"
      : "Apply rate (manager approval required)";

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        ≤{STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT}% staff · {STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT}–
        {SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT - 1}% manager (notify at ≥
        {INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT}%) · ≥{SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT}%
        supervisor/owner
      </p>

      {evaluation.requiresInternalSupervisorNotify && evaluation.canCloseOnThisVehicle && (
        <div className="rounded-md border border-sky-200 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-800 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
          <p className="font-medium">Internal notice — supervisor / owner</p>
          <p className="mt-1 opacity-90">
            {evaluation.internalNotifyMessage ??
              `Discount is ${evaluation.discountPercent.toFixed(1)}% off. Flag leadership internally; manager may still approve.`}
          </p>
          <p className="mt-1 text-[11px] opacity-80">
            This does not block closing. Document who was notified when you save the deal.
          </p>
        </div>
      )}

      {evaluation.requiresManagerApproval && evaluation.canCloseOnThisVehicle && (
        <div className="rounded-md border border-violet-200 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-800 px-3 py-2 text-xs text-violet-900 dark:text-violet-100">
          <p className="font-medium">Manager approval required</p>
          <p className="mt-1 opacity-90">
            Discount is {evaluation.discountPercent.toFixed(1)}% off list (above{" "}
            {STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT}%, below {SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT}
            %).
            {evaluation.requiresInternalSupervisorNotify &&
              " At 20%+ also notify supervisor/owner internally."}
          </p>
          <label className="mt-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={managerApproved}
              onChange={(e) => onManagerApprovedChange(e.target.checked)}
              className="rounded border-violet-400"
            />
            <span>Manager has approved this discount</span>
          </label>
        </div>
      )}

      {evaluation.requiresSupervisorApproval && evaluation.canCloseOnThisVehicle && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          <p className="font-medium">Supervisor / owner approval required</p>
          <p className="mt-1 opacity-90">
            Discount is {evaluation.discountPercent.toFixed(1)}% off list (at or above{" "}
            {SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT}%). A manager cannot approve this alone.
          </p>
          <label className="mt-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={supervisorApproved}
              onChange={(e) => onSupervisorApprovedChange(e.target.checked)}
              className="rounded border-amber-500"
            />
            <span>Supervisor or owner has approved this discount</span>
          </label>
        </div>
      )}

      {evaluation.canCloseOnThisVehicle && onApplyCloseRate && (
        <button
          type="button"
          className={`${applyButtonClassName} ${!canApply ? "opacity-50 cursor-not-allowed no-underline" : ""}`}
          disabled={!canApply}
          onClick={() => canApply && onApplyCloseRate(evaluation.discountedWeeklyCents / 100)}
        >
          {canApply
            ? `Apply $${(evaluation.discountedWeeklyCents / 100).toFixed(0)}/wk to weekly rate`
            : applyBlockedLabel}
        </button>
      )}
    </div>
  );
}
