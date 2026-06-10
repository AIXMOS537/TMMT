import type { BaseCreditPath, CreditBillingPlan, CreditPath } from "./types";

export const PATH_A_MONTHLY_MAX_CENTS = 9700;
export const PATH_B_TOTAL_CENTS = 50000;
export const PATH_B_DOWN_CENTS = 25000;
export const PATH_B_BALANCE_CENTS = 25000;
export const PATH_C_MENTORSHIP_CENTS = 100000;
export const PAYMENT_PLAN_WINDOW_DAYS = 45;

export function isBasePath(path: CreditPath): path is BaseCreditPath {
  return path === "monthly_97" || path === "payment_plan_500";
}

export function activeBasePlan(plans: CreditBillingPlan[]): CreditBillingPlan | null {
  return (
    plans.find(
      (p) =>
        !p.is_add_on &&
        p.status === "active" &&
        (p.credit_path === "monthly_97" || p.credit_path === "payment_plan_500")
    ) ?? null
  );
}

export function hasMentorshipDfy(plans: CreditBillingPlan[]): boolean {
  return plans.some(
    (p) => p.credit_path === "mentorship_dfy_1000" && p.status === "active" && p.paid_at
  );
}

export function basePathSatisfied(plans: CreditBillingPlan[]): boolean {
  const monthly = plans.find(
    (p) => p.credit_path === "monthly_97" && !p.is_add_on && p.status === "active"
  );
  if (monthly) return true;

  const plan = plans.find(
    (p) => p.credit_path === "payment_plan_500" && !p.is_add_on && p.status === "completed"
  );
  return Boolean(plan?.paid_at);
}

export function canAddBasePath(plans: CreditBillingPlan[], next: BaseCreditPath): boolean {
  const active = activeBasePlan(plans);
  if (!active) return true;
  return active.credit_path === next;
}

export function canAddMentorship(plans: CreditBillingPlan[]): boolean {
  return basePathSatisfied(plans) && !hasMentorshipDfy(plans);
}

export function pathLabel(path: CreditPath): string {
  switch (path) {
    case "monthly_97":
      return "Enrollment — up to $97/mo";
    case "payment_plan_500":
      return "Payment plan — $250 + $250";
    case "mentorship_dfy_1000":
      return "Mentorship — Done for you ($1,000)";
    default:
      return path;
  }
}

export function ghlTagForPath(path: CreditPath): string {
  switch (path) {
    case "monthly_97":
      return "credit:monthly-97";
    case "payment_plan_500":
      return "credit:plan-250-250";
    case "mentorship_dfy_1000":
      return "credit:mentorship-dfy";
    default:
      return "credit:unknown";
  }
}
