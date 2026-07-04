/**
 * src/lib/approvals-core.ts
 *
 * Pure, client-safe helpers + row type for the owner-approval console. NO
 * `server-only`, NO Supabase — so both the client page and the vitest node
 * tests can import it. The server-only persistence lives in ./approvals.
 */

import type {
  ApprovalStatus,
  GatedActionType,
} from "../../shared/owner-approval-gate/approval";

export type Decision = "approve" | "reject";

/**
 * Row shape as stored in Supabase (snake_case columns).
 * Declared as a `type` (not `interface`) so it satisfies the
 * `Record<string, unknown>` constraint on the shared <DataTable/> component.
 */
export type DbGatedAction = {
  id: string;
  created_at: string;
  type: GatedActionType;
  payload: Record<string, unknown>;
  created_by: string;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  reason: string | null;
};

/** Only a still-pending action can be decided. Prevents re-deciding history. */
export function canDecide(status: ApprovalStatus): boolean {
  return status === "pending";
}

/** Map an owner decision to the resulting terminal status. */
export function decisionToStatus(decision: Decision): ApprovalStatus {
  return decision === "approve" ? "approved" : "rejected";
}

/** Human label for each gated action type (for the console UI). */
export function describeActionType(type: GatedActionType): string {
  switch (type) {
    case "customer_message":
      return "Customer message";
    case "dispute_letter":
      return "Credit-bureau dispute";
    case "charge_fee":
      return "Charge a fee";
    case "pay_commission":
      return "Pay a commission";
    case "submit_funding_app":
      return "Submit funding application";
    case "move_money":
      return "Move money";
    case "production_automation_edit":
      return "Edit production automation";
    default:
      return type;
  }
}
