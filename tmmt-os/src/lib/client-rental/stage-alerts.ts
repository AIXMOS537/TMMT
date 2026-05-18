import { CANONICAL_STAGE_LABEL } from "@/lib/crm-sync/labels";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import { normalizeRenterStage } from "@/lib/ops-command/stage-rules";

export type StageAlertTemplate = {
  alert_type: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high";
  dueInDays?: number;
};

/** Reminders surfaced to renters when GHL pipeline stage updates. */
export function alertsForCanonicalStage(
  stage: CanonicalRenterStage | string,
  ctx?: { ghlStageLabel?: string; vehicleLabel?: string }
): StageAlertTemplate[] {
  const normalized = normalizeRenterStage(stage);
  const label = CANONICAL_STAGE_LABEL[normalized] ?? normalized;
  const vehicle = ctx?.vehicleLabel ? ` (${ctx.vehicleLabel})` : "";
  const ghl = ctx?.ghlStageLabel ? ` — ${ctx.ghlStageLabel}` : "";

  const templates: Partial<Record<CanonicalRenterStage, StageAlertTemplate[]>> & {
    active_renter?: StageAlertTemplate[];
  } = {
    payment_pending: [
      {
        alert_type: "payment_due",
        title: "Payment due",
        message: `Your rental payment is due before pickup${vehicle}. Complete payment to stay on schedule.`,
        priority: "high",
        dueInDays: 2,
      },
    ],
    booked: [
      {
        alert_type: "rental_confirmed",
        title: "Rental confirmed",
        message: `You're booked${vehicle}. Watch for pickup details and required documents.`,
        priority: "normal",
      },
    ],
    pickup_scheduled: [
      {
        alert_type: "pickup_reminder",
        title: "Pickup scheduled",
        message: `Your vehicle pickup is coming up${vehicle}. Bring your license and payment confirmation.`,
        priority: "high",
        dueInDays: 1,
      },
    ],
    active_rental: [
      {
        alert_type: "service_check",
        title: "Mandatory service check",
        message: `During your active rental${vehicle}, complete the required service/oil check and report mileage if asked. Submit a maintenance ticket if anything needs attention.`,
        priority: "high",
        dueInDays: 7,
      },
    ],
    return_due: [
      {
        alert_type: "return_reminder",
        title: "Return due soon",
        message: `Your return date is approaching${vehicle}. Schedule return time and ensure the vehicle is clean and fueled per your agreement.`,
        priority: "high",
        dueInDays: 2,
      },
    ],
    returned: [
      {
        alert_type: "deposit_return",
        title: "Deposit review",
        message:
          "We've received your vehicle. Deposits and any deductions are being reviewed — you'll see updates under Billing.",
        priority: "normal",
        dueInDays: 5,
      },
    ],
    extended: [
      {
        alert_type: "extension_active",
        title: "Rental extended",
        message: `Your rental period was extended${ghl}. New return expectations apply — check Billing for any rate changes.`,
        priority: "normal",
      },
    ],
    escalation: [
      {
        alert_type: "account_attention",
        title: "Account needs attention",
        message:
          "There's an open issue on your rental account. Check your tickets or contact support if you have questions.",
        priority: "high",
      },
    ],
  };

  return (
    templates[normalized] ?? templates[stage as CanonicalRenterStage] ?? [
      {
        alert_type: "pipeline_update",
        title: label,
        message: `Your rental status is now: ${label}${ghl}.`,
        priority: "low",
      },
    ]
  );
}
