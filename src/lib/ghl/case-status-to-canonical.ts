import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import type { CaseStatus } from "@/lib/workflow/statuses";

/**
 * When ops advances a case, map to GHL rental pipeline canonical stage for outbound sync.
 * Override via GHL_CASE_STATUS_MAP_JSON env (minified JSON object).
 */
const DEFAULT_MAP: Partial<Record<CaseStatus, CanonicalRenterStage>> = {
  intake_submitted: "inquiry",
  initial_contact_needed: "contacted",
  initial_contact_complete: "qualifying",
  internal_review: "qualifying",
  task_assignment: "payment_pending",
  vendor_needed: "booked",
  vendor_assigned: "pickup_scheduled",
  vendor_in_progress: "active_rental",
  vendor_completed: "return_due",
  internal_quality_check: "returned",
  customer_follow_up: "extended",
  awaiting_approval: "return_due",
  completed: "closed_won",
  closed: "closed_won",
  blocked: "escalation",
};

let cached: Partial<Record<CaseStatus, CanonicalRenterStage>> | null = null;

function loadMap(): Partial<Record<CaseStatus, CanonicalRenterStage>> {
  if (cached) return cached;
  try {
    const raw = process.env.GHL_CASE_STATUS_MAP_JSON;
    if (raw) {
      cached = JSON.parse(raw) as Partial<Record<CaseStatus, CanonicalRenterStage>>;
      return cached;
    }
  } catch {
    /* fall through */
  }
  cached = DEFAULT_MAP;
  return cached;
}

export function canonicalStageForCaseStatus(status: CaseStatus): CanonicalRenterStage | null {
  return loadMap()[status] ?? null;
}
