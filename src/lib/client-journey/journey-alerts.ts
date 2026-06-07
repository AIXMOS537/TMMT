import type { JourneyHub } from "./types";
import { basePathSatisfied } from "./credit-paths";

export type JourneyAlertTemplate = {
  alert_type: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high";
  dueInDays?: number;
  href?: string;
};

export function journeyAlertTemplates(hub: JourneyHub): JourneyAlertTemplate[] {
  const alerts: JourneyAlertTemplate[] = [];
  const email = hub.journey?.customer_email;

  if (!email) return alerts;

  if (!basePathSatisfied(hub.creditPlans)) {
    alerts.push({
      alert_type: "credit_path_required",
      title: "Choose your credit path",
      message:
        "Enroll in the $97/mo plan or complete the $250 down + $250 payment plan to continue toward lease-to-own.",
      priority: "high",
      href: "/client/credit",
    });
  }

  if (!hub.education.allAcknowledged) {
    alerts.push({
      alert_type: "credit_education_incomplete",
      title: "Complete credit education",
      message: "Read and acknowledge all sections on why credit repair matters before LTO.",
      priority: "high",
      href: "/client/credit",
    });
  }

  if (!hub.training.coreComplete) {
    alerts.push({
      alert_type: "training_core_incomplete",
      title: "Finish core training",
      message: `Complete all core rebuild modules (${hub.training.coreDone}/${hub.training.coreTotal} done) to unlock lease-to-own.`,
      priority: "high",
      href: "/client/training",
    });
  }

  const plan97 = hub.creditPlans.find(
    (p) => p.credit_path === "monthly_97" && p.status === "active" && !p.is_add_on
  );
  if (plan97?.next_billing_at) {
    alerts.push({
      alert_type: "credit_97_due",
      title: "Monthly enrollment due",
      message: "Your credit enrollment payment is coming up. Stay current to keep Path B waived.",
      priority: "normal",
      dueInDays: 3,
      href: "/client/billing",
    });
  }

  const planB = hub.creditPlans.find(
    (p) => p.credit_path === "payment_plan_500" && p.status === "active" && !p.is_add_on
  );
  if (planB?.due_at) {
    alerts.push({
      alert_type: "credit_250_balance_due",
      title: "Payment plan balance due",
      message: "Your $250 balance is due within the 30–45 day window. Pay in Billing to satisfy credit requirements.",
      priority: "high",
      dueInDays: 7,
      href: "/client/billing",
    });
  }

  if (hub.gates.day90GoodStanding && !hub.lto.eligible) {
    alerts.push({
      alert_type: "lto_blocked_training_incomplete",
      title: "LTO almost unlocked",
      message:
        "You have 90-day good standing. Finish education and core training to unlock lease-to-own.",
      priority: "high",
      href: "/client/path",
    });
  }

  if (hub.lto.eligible) {
    alerts.push({
      alert_type: "day_90_lto_unlock",
      title: "Lease-to-own unlocked",
      message: "You meet all requirements. Review documents and speak with TMMT to start LTO.",
      priority: "normal",
      href: "/client/documents",
    });
  }

  return alerts;
}
