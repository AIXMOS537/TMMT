import type { CanonicalRenterStage } from "./types";

export const CANONICAL_STAGE_LABEL: Record<CanonicalRenterStage, string> = {
  inquiry: "New inquiry",
  contacted: "Contacted",
  qualifying: "Qualifying",
  payment_pending: "Payment pending",
  booked: "Booked",
  pickup_scheduled: "Pickup scheduled",
  active_rental: "Active rental",
  return_due: "Return due",
  returned: "Returned",
  extended: "Extended",
  escalation: "Escalation",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

export type SyncRecordStatus =
  | "pending_airtable"
  | "pending_verification"
  | "verified"
  | "rejected"
  | "error";

export const SYNC_STATUS_LABEL: Record<SyncRecordStatus, string> = {
  pending_airtable: "Pending Airtable",
  pending_verification: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
  error: "Error",
};
