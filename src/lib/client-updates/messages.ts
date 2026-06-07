import type { CaseStatus } from "@/lib/workflow/statuses";
import { CASE_STATUS_LABEL } from "@/lib/workflow/statuses";

/** Plain-language status for renters, investors, and partners — reduces "what's the update?" calls. */
export const CASE_STATUS_CLIENT_MESSAGE: Record<CaseStatus, string> = {
  intake_submitted: "We received your request and queued it for the team.",
  initial_contact_needed: "Our team will reach out shortly — you can also message us here instead of calling.",
  initial_contact_complete: "We've made first contact. Watch this page for the next step.",
  internal_review: "We're reviewing your request internally.",
  task_assignment: "We're assigning the right person to handle this.",
  vendor_needed: "We're lining up the right vendor or specialist.",
  vendor_assigned: "A vendor has been assigned to your request.",
  vendor_in_progress: "Work is in progress on your request.",
  vendor_completed: "Vendor work is complete — we're doing our quality check.",
  internal_quality_check: "We're verifying everything before we close the loop with you.",
  customer_follow_up: "We may need something from you — check your tickets or messages here.",
  awaiting_approval: "Waiting on a final approval before we finish.",
  completed: "This request is complete. Open a new ticket if you need anything else.",
  closed: "This request is closed.",
  blocked: "This request is on hold — we'll update you here when it moves again.",
};

export function clientStatusLabel(status: CaseStatus) {
  return CASE_STATUS_LABEL[status] ?? status;
}

export function clientStatusMessage(status: CaseStatus) {
  return CASE_STATUS_CLIENT_MESSAGE[status] ?? "Your request is being handled by our team.";
}
