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

export const INTAKE_REQUEST_TYPES = [
  { value: "rental_inquiry", label: "Vehicle rental inquiry" },
  { value: "maintenance", label: "Maintenance / repair" },
  { value: "inspection", label: "Inspection" },
  { value: "towing", label: "Towing / transport" },
  { value: "detailing", label: "Detailing / cleaning" },
  { value: "insurance", label: "Insurance / claims" },
  { value: "general", label: "General request" },
] as const;

export function formatCaseStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatVendorJobStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
