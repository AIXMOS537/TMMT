import type { ApplicationStatus, UserRole } from "./types";

export const WORKFLOW_STEPS: ApplicationStatus[] = [
  "onboarding",
  "questionnaire_in_progress",
  "questionnaire_complete",
  "coach_reviewed",
  "advisor_reviewed",
  "admin_reviewed",
  "supervisor_approved",
  "client_consent_given",
  "submitted",
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  onboarding: "Onboarding",
  questionnaire_in_progress: "Questionnaire in progress",
  questionnaire_complete: "Questionnaire complete",
  coach_reviewed: "Coach reviewed",
  advisor_reviewed: "Advisor reviewed",
  admin_reviewed: "Admin verified",
  supervisor_approved: "Supervisor approved",
  client_consent_given: "Client consent",
  submitted: "Submitted",
  prepared_for_manual: "Manual submission prep",
  returned_for_corrections: "Returned for corrections",
};

/** Which app face owns client vs staff transitions */
export const STATUS_FACE: Record<
  ApplicationStatus,
  "learn" | "work" | "both"
> = {
  onboarding: "learn",
  questionnaire_in_progress: "learn",
  questionnaire_complete: "learn",
  coach_reviewed: "work",
  advisor_reviewed: "work",
  admin_reviewed: "work",
  supervisor_approved: "work",
  client_consent_given: "learn",
  submitted: "both",
  prepared_for_manual: "work",
  returned_for_corrections: "both",
};

const STAFF_TRANSITIONS: Partial<
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  questionnaire_complete: ["coach_reviewed", "returned_for_corrections"],
  coach_reviewed: ["advisor_reviewed", "returned_for_corrections"],
  advisor_reviewed: ["admin_reviewed", "returned_for_corrections"],
  admin_reviewed: ["supervisor_approved", "returned_for_corrections"],
  supervisor_approved: ["client_consent_given"],
  returned_for_corrections: ["questionnaire_in_progress"],
};

const CLIENT_TRANSITIONS: Partial<
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  onboarding: ["questionnaire_in_progress"],
  questionnaire_in_progress: ["questionnaire_complete"],
  supervisor_approved: ["client_consent_given"],
  client_consent_given: ["submitted"],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  role: UserRole
): boolean {
  if (role === "client") {
    return CLIENT_TRANSITIONS[from]?.includes(to) ?? false;
  }
  if (role === "coach") {
    return (
      STAFF_TRANSITIONS[from]?.includes(to) ??
      (from === "questionnaire_complete" && to === "coach_reviewed")
    );
  }
  return STAFF_TRANSITIONS[from]?.includes(to) ?? false;
}

export function workflowProgress(status: ApplicationStatus): number {
  const idx = WORKFLOW_STEPS.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / WORKFLOW_STEPS.length) * 100);
}
