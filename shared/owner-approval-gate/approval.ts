/**
 * shared/owner-approval-gate/approval.ts
 *
 * THE core AIXMOS primitive. No customer-facing message and no financial
 * action executes without explicit owner approval. See root CLAUDE.md section 2.
 *
 * Pattern: an action is created as PENDING, surfaced to the owner (Muhammad Taha — sole owner),
 * and only an APPROVED action may be executed. Anything else throws.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type GatedActionType =
  | "customer_message"      // SMS, email, status update to a client
  | "dispute_letter"        // credit-bureau dispute
  | "charge_fee"            // any Stripe charge
  | "pay_commission"        // operator payout
  | "submit_funding_app"    // funding application to a lender/funder
  | "move_money"            // any transfer
  | "production_automation_edit"; // push automation change live

export interface GatedAction {
  id: string;
  type: GatedActionType;
  payload: Record<string, unknown>;
  createdBy: string;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
}

export class ApprovalRequiredError extends Error {
  constructor(actionType: GatedActionType, status: ApprovalStatus) {
    super(
      `OWNER APPROVAL REQUIRED: action "${actionType}" is "${status}", not "approved". ` +
        `It cannot execute until an owner approves it.`
    );
    this.name = "ApprovalRequiredError";
  }
}

/**
 * Call IMMEDIATELY before executing any gated action.
 * Throws unless the action has been explicitly approved by an owner.
 */
export function assertApproved(action: GatedAction): void {
  if (action.status !== "approved") {
    throw new ApprovalRequiredError(action.type, action.status);
  }
}

/**
 * Helper to create a pending action. Persist this (Supabase) and surface it
 * to the owner queue (GoHighLevel / portal / Slack) for review.
 * IMPLEMENT: persistence + notification. Do NOT auto-approve.
 */
export function createPendingAction(
  type: GatedActionType,
  payload: Record<string, unknown>,
  createdBy: string
): GatedAction {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    createdBy,
    status: "pending",
  };
}

// TODO(claude-code): wire persistence to Supabase table `gated_actions`,
// notification to the owner approval queue, and an approve/reject endpoint.
// NEVER add an auto-approve path. A test that bypasses approval is a wrong test.
