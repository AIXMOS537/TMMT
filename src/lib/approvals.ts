import "server-only";

/**
 * src/lib/approvals.ts
 *
 * Wires the owner-approval primitive (shared/owner-approval-gate/approval.ts) to
 * its Supabase table `gated_actions` (migration 20260628120000). This is the
 * persistence + query layer for the owner-approval CONSOLE — the driver's seat
 * where every customer message / charge / dispute / payout waits for owner YES.
 *
 * There is intentionally NO auto-approve path. See root CLAUDE.md §2 and the
 * contract in approval.ts. A test or code path that bypasses approval is wrong.
 */

import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  type ApprovalStatus,
  type GatedActionType,
  createPendingAction,
} from "../../shared/owner-approval-gate/approval";
import {
  canDecide,
  decisionToStatus,
  type Decision,
  type DbGatedAction,
} from "@/lib/approvals-core";

const TABLE = "gated_actions";

// Re-export the client-safe core so server callers can import everything from
// one place. Pure helpers/types live in ./approvals-core (no server-only).
export {
  canDecide,
  decisionToStatus,
  describeActionType,
} from "@/lib/approvals-core";
export type { Decision, DbGatedAction } from "@/lib/approvals-core";

// ---- Persistence + queries (service role, server-only) --------------------

/**
 * Create a PENDING gated action and persist it. Surfaced to the owner console.
 * Callers (SMS/charge/dispute/payout paths) create this, then MUST wait for an
 * approved status before executing — never execute inline.
 */
export async function recordPendingAction(
  type: GatedActionType,
  payload: Record<string, unknown>,
  createdBy: string
): Promise<DbGatedAction> {
  const action = createPendingAction(type, payload, createdBy);
  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from(TABLE)
    .insert({
      id: action.id,
      type: action.type,
      payload: action.payload,
      created_by: action.createdBy,
      status: action.status,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to record pending action: ${error?.message ?? "unknown"}`);
  }
  return data as DbGatedAction;
}

/** List gated actions by status (default: the pending owner queue). */
export async function listGatedActions(
  status: ApprovalStatus = "pending"
): Promise<DbGatedAction[]> {
  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from(TABLE)
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to list gated actions: ${error.message}`);
  }
  return (data ?? []) as DbGatedAction[];
}

/**
 * Record an owner's decision on a pending action. The update is guarded by
 * `.eq("status", "pending")` so a concurrent decision can't be overwritten.
 */
export async function decideGatedAction(
  id: string,
  decision: Decision,
  approvedBy: string,
  reason?: string
): Promise<DbGatedAction> {
  const svc = createServiceRoleClient();

  const { data: current, error: readErr } = await svc
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();
  if (readErr || !current) {
    throw new Error("Action not found.");
  }
  if (!canDecide((current as DbGatedAction).status)) {
    throw new Error(`Action already ${(current as DbGatedAction).status}.`);
  }

  const { data, error } = await svc
    .from(TABLE)
    .update({
      status: decisionToStatus(decision),
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      reason: reason ?? null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Could not record decision (it may have just been decided).");
  }
  return data as DbGatedAction;
}
