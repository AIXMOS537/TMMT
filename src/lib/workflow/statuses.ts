// =============================================================================
// Workflow vocabulary — keep in lock-step with the live schema (the init
// migration is not in the repo; see supabase/schema/README.md)
// =============================================================================

import { DB_USER_ROLES, type DbUserRole } from "@/lib/db-vocab";

/**
 * The `public.user_role` enum (`profiles.role`). This used to be a second
 * hand-typed copy; it is now the one in `src/lib/db-vocab.ts`, which is
 * type-checked as a subset of the app role tokens in `src/lib/auth-roles.ts`
 * (F-15). Kept under its old name so existing imports keep working.
 */
export const USER_ROLES = DB_USER_ROLES;
export type UserRole = DbUserRole;

export const CASE_STATUSES = [
  "intake_submitted",
  "initial_contact_needed",
  "initial_contact_complete",
  "internal_review",
  "task_assignment",
  "vendor_needed",
  "vendor_assigned",
  "vendor_in_progress",
  "vendor_completed",
  "internal_quality_check",
  "customer_follow_up",
  "awaiting_approval",
  "completed",
  "closed",
  "blocked",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const VENDOR_JOB_STATUSES = [
  "offered",
  "accepted",
  "declined",
  "scheduled",
  "in_progress",
  "pending_review",
  "completed",
  "rejected",
  "paid",
  "cancelled",
] as const;
export type VendorJobStatus = (typeof VENDOR_JOB_STATUSES)[number];

export const REQUEST_TYPES = [
  "rental_booking",
  "rental_support",
  "maintenance",
  "repair",
  "detail",
  "tow",
  "inspection",
  "delivery",
  "content",
  "consulting",
  "other",
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

/**
 * Forward-only happy-path transitions for cases. The DB doesn't enforce these
 * — they're the engine's "what should normally happen next" guide. Any staff
 * member can still set status manually via the case detail page.
 */
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  intake_submitted: ["initial_contact_needed", "internal_review", "blocked"],
  initial_contact_needed: ["initial_contact_complete", "blocked"],
  initial_contact_complete: ["internal_review"],
  internal_review: ["task_assignment", "vendor_needed", "awaiting_approval", "blocked", "completed"],
  task_assignment: ["vendor_needed", "internal_quality_check", "awaiting_approval"],
  vendor_needed: ["vendor_assigned", "blocked"],
  vendor_assigned: ["vendor_in_progress", "blocked"],
  vendor_in_progress: ["vendor_completed", "blocked"],
  vendor_completed: ["internal_quality_check"],
  internal_quality_check: ["customer_follow_up", "vendor_in_progress", "awaiting_approval"],
  customer_follow_up: ["awaiting_approval", "completed"],
  awaiting_approval: ["completed", "blocked"],
  completed: ["closed"],
  closed: [],
  blocked: ["internal_review", "closed"],
};

/** Map request type → suggested initial next status after intake. */
export function suggestedNextStatus(requestType: RequestType): CaseStatus {
  switch (requestType) {
    case "rental_booking":
    case "rental_support":
    case "consulting":
      return "initial_contact_needed";
    case "maintenance":
    case "repair":
    case "detail":
    case "tow":
    case "inspection":
    case "delivery":
    case "content":
      return "internal_review";
    default:
      return "initial_contact_needed";
  }
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  intake_submitted: "Intake submitted",
  initial_contact_needed: "Initial contact needed",
  initial_contact_complete: "Initial contact done",
  internal_review: "Internal review",
  task_assignment: "Task assignment",
  vendor_needed: "Vendor needed",
  vendor_assigned: "Vendor assigned",
  vendor_in_progress: "Vendor working",
  vendor_completed: "Vendor finished",
  internal_quality_check: "Quality check",
  customer_follow_up: "Customer follow-up",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  closed: "Closed",
  blocked: "Blocked",
};

export const VENDOR_JOB_LABEL: Record<VendorJobStatus, string> = {
  offered: "Offered",
  accepted: "Accepted",
  declined: "Declined",
  scheduled: "Scheduled",
  in_progress: "In progress",
  pending_review: "Pending review",
  completed: "Completed",
  rejected: "Rejected by ops",
  paid: "Paid",
  cancelled: "Cancelled",
};

/** What the vendor is allowed to set themselves from each status. */
export const VENDOR_ALLOWED_TRANSITIONS: Record<VendorJobStatus, VendorJobStatus[]> = {
  offered: ["accepted", "declined"],
  accepted: ["scheduled", "in_progress"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["pending_review"],
  pending_review: [],
  completed: [],
  rejected: [],
  declined: [],
  paid: [],
  cancelled: [],
};

/** Map vendor job state → the case status the parent case should reflect. */
export function caseStatusForVendorJob(s: VendorJobStatus): CaseStatus | null {
  switch (s) {
    case "offered":
    case "accepted":
    case "scheduled":
      return "vendor_assigned";
    case "in_progress":
      return "vendor_in_progress";
    case "pending_review":
    case "completed":
      return "vendor_completed";
    default:
      return null;
  }
}

// =============================================================================
// Client engagement phases — what the CLIENT sees on their build tracker.
//
// Deliberately NOT a second case pipeline. CASE_STATUSES above is the internal
// operational vocabulary (15 states, vendor hand-offs, quality checks); a client
// should never see "vendor_needed". These four are the outward-facing summary of
// the same work, and `ENGAGEMENT_PHASE_FOR_CASE` is the one-way projection from
// the internal state to the client-visible one. Add states to CASE_STATUSES, not
// here — this list is meant to stay four items long.
// =============================================================================

export const ENGAGEMENT_PHASES = ["intake", "agreement", "build", "live"] as const;
export type EngagementPhase = (typeof ENGAGEMENT_PHASES)[number];

export const ENGAGEMENT_PHASE_LABEL: Record<EngagementPhase, string> = {
  intake: "Intake",
  agreement: "Agreement",
  build: "Build",
  live: "Live",
};

/** What the client is told is happening, in their words, not ours. */
export const ENGAGEMENT_PHASE_BLURB: Record<EngagementPhase, string> = {
  intake: "We're learning how your business runs today.",
  agreement: "Scope and terms are being agreed.",
  build: "Your system is being built.",
  live: "Your system is running.",
};

/** Phases are forward-only and strictly ordered — index doubles as rank. */
export function engagementPhaseRank(phase: EngagementPhase): number {
  return ENGAGEMENT_PHASES.indexOf(phase);
}

/**
 * Projection from the internal case pipeline to the client-visible phase.
 * Every CaseStatus must map, so a new internal state can never leave the
 * tracker blank — the test in statuses.test.ts enforces exhaustiveness.
 */
export const ENGAGEMENT_PHASE_FOR_CASE: Record<CaseStatus, EngagementPhase> = {
  intake_submitted: "intake",
  initial_contact_needed: "intake",
  initial_contact_complete: "intake",
  internal_review: "agreement",
  awaiting_approval: "agreement",
  task_assignment: "build",
  vendor_needed: "build",
  vendor_assigned: "build",
  vendor_in_progress: "build",
  vendor_completed: "build",
  internal_quality_check: "build",
  customer_follow_up: "build",
  blocked: "build",
  completed: "live",
  closed: "live",
};
