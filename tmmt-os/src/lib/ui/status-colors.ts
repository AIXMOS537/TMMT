import type { CaseStatus, RequestType, VendorJobStatus } from "@/lib/workflow/statuses";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import type { SyncRecordStatus } from "@/lib/crm-sync/labels";

/** Airtable-style semantic tones — shared across badges, rows, and filter pills. */
export type StatusTone =
  | "slate"
  | "blue"
  | "sky"
  | "teal"
  | "violet"
  | "amber"
  | "orange"
  | "emerald"
  | "red";

export const TONE_STYLES: Record<
  StatusTone,
  { badge: string; row: string; border: string; dot: string; pill: string; pillActive: string }
> = {
  slate: {
    badge: "bg-slate-100/90 text-slate-800 border-slate-200/80",
    row: "bg-slate-50/70 hover:bg-slate-100/80",
    border: "border-l-slate-400",
    dot: "bg-slate-500",
    pill: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    pillActive: "bg-slate-700 text-white border-slate-700",
  },
  blue: {
    badge: "bg-blue-100 text-blue-900 border-blue-200",
    row: "bg-blue-50/90 hover:bg-blue-100/80",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100",
    pillActive: "bg-blue-600 text-white border-blue-600",
  },
  sky: {
    badge: "bg-sky-100 text-sky-900 border-sky-200",
    row: "bg-sky-50/90 hover:bg-sky-100/80",
    border: "border-l-sky-500",
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
    pillActive: "bg-sky-600 text-white border-sky-600",
  },
  teal: {
    badge: "bg-teal-100 text-teal-900 border-teal-200",
    row: "bg-teal-50/90 hover:bg-teal-100/80",
    border: "border-l-teal-500",
    dot: "bg-teal-500",
    pill: "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100",
    pillActive: "bg-teal-600 text-white border-teal-600",
  },
  violet: {
    badge: "bg-violet-100 text-violet-900 border-violet-200",
    row: "bg-violet-50/90 hover:bg-violet-100/80",
    border: "border-l-violet-500",
    dot: "bg-violet-500",
    pill: "bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100",
    pillActive: "bg-violet-600 text-white border-violet-600",
  },
  amber: {
    badge: "bg-amber-100 text-amber-950 border-amber-200",
    row: "bg-amber-50/90 hover:bg-amber-100/80",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100",
    pillActive: "bg-amber-600 text-white border-amber-600",
  },
  orange: {
    badge: "bg-orange-100 text-orange-950 border-orange-200",
    row: "bg-orange-50/90 hover:bg-orange-100/80",
    border: "border-l-orange-500",
    dot: "bg-orange-500",
    pill: "bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-100",
    pillActive: "bg-orange-600 text-white border-orange-600",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200",
    row: "bg-emerald-50/90 hover:bg-emerald-100/80",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
    pillActive: "bg-emerald-600 text-white border-emerald-600",
  },
  red: {
    badge: "bg-red-100 text-red-900 border-red-200",
    row: "bg-red-50/90 hover:bg-red-100/80",
    border: "border-l-red-500",
    dot: "bg-red-500",
    pill: "bg-red-50 text-red-800 border-red-200 hover:bg-red-100",
    pillActive: "bg-red-600 text-white border-red-600",
  },
};

export function toneStyles(tone: StatusTone) {
  return TONE_STYLES[tone];
}

export const CASE_STATUS_TONE: Record<CaseStatus, StatusTone> = {
  intake_submitted: "blue",
  initial_contact_needed: "amber",
  initial_contact_complete: "sky",
  internal_review: "violet",
  task_assignment: "violet",
  vendor_needed: "orange",
  vendor_assigned: "teal",
  vendor_in_progress: "teal",
  vendor_completed: "sky",
  internal_quality_check: "amber",
  customer_follow_up: "orange",
  awaiting_approval: "amber",
  completed: "emerald",
  closed: "slate",
  blocked: "red",
};

export const VENDOR_JOB_TONE: Record<VendorJobStatus, StatusTone> = {
  offered: "amber",
  accepted: "blue",
  declined: "red",
  scheduled: "sky",
  in_progress: "teal",
  pending_review: "orange",
  completed: "emerald",
  rejected: "red",
  paid: "emerald",
  cancelled: "slate",
};

export const REQUEST_TYPE_TONE: Record<RequestType, StatusTone> = {
  rental_booking: "violet",
  rental_support: "violet",
  maintenance: "orange",
  repair: "orange",
  detail: "teal",
  tow: "red",
  inspection: "sky",
  delivery: "blue",
  content: "violet",
  consulting: "blue",
  other: "slate",
};

export const SYNC_STATUS_TONE: Record<SyncRecordStatus, StatusTone> = {
  pending_airtable: "sky",
  pending_verification: "amber",
  verified: "emerald",
  rejected: "red",
  error: "red",
};

export const CANONICAL_STAGE_TONE: Record<CanonicalRenterStage, StatusTone> = {
  inquiry: "blue",
  contacted: "sky",
  qualifying: "violet",
  payment_pending: "amber",
  booked: "emerald",
  pickup_scheduled: "teal",
  active_rental: "emerald",
  return_due: "orange",
  returned: "slate",
  extended: "amber",
  escalation: "red",
  closed_won: "emerald",
  closed_lost: "slate",
};

export const PACKAGE_TONE: Record<string, StatusTone> = {
  starter: "slate",
  growth: "blue",
  elite: "violet",
  custom: "amber",
};

export function getCaseStatusTone(status: CaseStatus): StatusTone {
  return CASE_STATUS_TONE[status] ?? "slate";
}
