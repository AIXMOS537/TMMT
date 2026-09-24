"use server";

/**
 * Owner approval queue for `exec_va_tasks`.
 *
 * The classifier (`classify_va_tasks`) only recommends: it writes `triage_*`
 * columns and nothing else. Until this file existed nothing in the app read the
 * queue, so every `needs_approval` row sat pending forever. These actions give
 * staff a durable place to record decisions:
 *
 *   approve  — owner only. Records `result.approval` and leaves the row pending
 *              with `handled_at` null. It is an authority record, not a send: no
 *              message, payment, or external call happens here. A future worker
 *              may act only on rows carrying `result.approval`.
 *   handled  — staff. Marks the task done outside the system (`handled_at`).
 *   dismiss  — staff. Closes the task without action (`handled_at`).
 *
 * Only `handled_at` and `result` are written. `status` and `triage_*` are never
 * touched so the generator's idempotency and the classifier stay authoritative.
 * Every write is fenced on `handled_at is null` and the affected-row count is
 * checked, so a stale screen cannot overwrite a newer decision.
 */

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isOwnerUser, isStaffUser } from "@/lib/auth-roles";
import { onlyOpenVaTasks } from "@/lib/ops/va-task-lifecycle";

export type VaTriage = "needs_approval" | "auto" | "ignore" | "untriaged";
export type VaDecision = "approve" | "handled" | "dismiss";

export type VaQueueRow = {
  id: number;
  created_at: string;
  sweep_date: string;
  category: string;
  priority: string;
  agent: string;
  subject_name: string | null;
  subject_phone: string | null;
  subject_email: string | null;
  context: Record<string, unknown> | null;
  triage: string | null;
  triage_reason: string | null;
  triage_confidence: number | null;
  triaged_at: string | null;
  source_table: string | null;
  source_id: string | null;
  result: Record<string, unknown> | null;
};

export type VaQueueSummary = {
  needs_approval: number;
  approved: number;
  auto: number;
  ignore: number;
  untriaged: number;
  canApprove: boolean;
};

export type VaDecisionReceipt = {
  id: number;
  decision: VaDecision;
  at: string;
  by: string;
};

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const ROW_COLUMNS =
  "id, created_at, sweep_date, category, priority, agent, subject_name, subject_phone, subject_email, context, triage, triage_reason, triage_confidence, triaged_at, source_table, source_id, result";

const MAX_LIMIT = 500;
const NOTE_MAX = 1000;

type Actor = { id: string; label: string; owner: boolean };

async function requireStaff(): Promise<ActionResult<Actor>> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // redirect() throws NEXT_REDIRECT — the caller never receives a return value
  if (!user) redirect("/login");

  if (!isStaffUser(user)) {
    return { success: false, error: "Not authorized." };
  }
  return {
    success: true,
    data: { id: user.id, label: user.email ?? user.id, owner: isOwnerUser(user) },
  };
}

function applyTriage<Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(
  query: Q,
  triage: VaTriage
): Q {
  return triage === "untriaged" ? query.is("triage", null) : query.eq("triage", triage);
}

export async function listVaQueue(opts: {
  triage: VaTriage;
  category?: string;
  limit?: number;
}): Promise<ActionResult<VaQueueRow[]>> {
  const auth = await requireStaff();
  if (!auth.success) return auth;

  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 200), 1), MAX_LIMIT);
  const db = createServiceRoleClient();
  let query = onlyOpenVaTasks(db.from("exec_va_tasks").select(ROW_COLUMNS));
  query = applyTriage(query, opts.triage);
  if (opts.category) query = query.eq("category", opts.category);

  const { data, error } = await query
    .order("sweep_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[va-queue] list failed:", error.message);
    return { success: false, error: `Could not load the queue: ${error.message}` };
  }
  return { success: true, data: (data ?? []) as unknown as VaQueueRow[] };
}

export async function getVaQueueSummary(): Promise<ActionResult<VaQueueSummary>> {
  const auth = await requireStaff();
  if (!auth.success) return auth;

  const db = createServiceRoleClient();
  const base = () =>
    onlyOpenVaTasks(db.from("exec_va_tasks").select("id", { count: "exact", head: true }));

  const [needs, approved, auto, ignore, untriaged] = await Promise.all([
    base().eq("triage", "needs_approval"),
    base().eq("triage", "needs_approval").not("result->approval", "is", null),
    base().eq("triage", "auto"),
    base().eq("triage", "ignore"),
    base().is("triage", null),
  ]);

  const failed = [needs, approved, auto, ignore, untriaged].find((r) => r.error);
  if (failed?.error) {
    console.error("[va-queue] summary failed:", failed.error.message);
    return { success: false, error: `Could not load counts: ${failed.error.message}` };
  }

  return {
    success: true,
    data: {
      needs_approval: needs.count ?? 0,
      approved: approved.count ?? 0,
      auto: auto.count ?? 0,
      ignore: ignore.count ?? 0,
      untriaged: untriaged.count ?? 0,
      canApprove: auth.data.owner,
    },
  };
}

export async function decideVaTask(
  id: number,
  decision: VaDecision,
  note?: string
): Promise<ActionResult<VaDecisionReceipt>> {
  const auth = await requireStaff();
  if (!auth.success) return auth;
  const actor = auth.data;

  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, error: "Invalid task id." };
  }
  if (decision !== "approve" && decision !== "handled" && decision !== "dismiss") {
    return { success: false, error: "Invalid decision." };
  }
  if (decision === "approve" && !actor.owner) {
    return { success: false, error: "Only the owner can approve a task." };
  }
  const trimmedNote = (note ?? "").trim().slice(0, NOTE_MAX) || null;

  const db = createServiceRoleClient();
  const { data: row, error: readError } = await db
    .from("exec_va_tasks")
    .select("id, status, handled_at, result")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.error("[va-queue] read failed:", readError.message);
    return { success: false, error: `Could not read the task: ${readError.message}` };
  }
  if (!row) return { success: false, error: "Task not found." };
  if (row.handled_at) return { success: false, error: "Task was already handled." };
  if (row.status !== "pending") {
    return { success: false, error: `Task is ${String(row.status)}, not pending.` };
  }

  const at = new Date().toISOString();
  const existing =
    row.result && typeof row.result === "object" && !Array.isArray(row.result)
      ? (row.result as Record<string, unknown>)
      : {};

  const patch: { result: Record<string, unknown>; handled_at?: string } =
    decision === "approve"
      ? { result: { ...existing, approval: { by: actor.label, at, note: trimmedNote } } }
      : {
          result: { ...existing, decision: { kind: decision, by: actor.label, at, note: trimmedNote } },
          handled_at: at,
        };

  const { data: updated, error: writeError } = await db
    .from("exec_va_tasks")
    .update(patch)
    .eq("id", id)
    .is("handled_at", null)
    .select("id");

  if (writeError) {
    console.error("[va-queue] write failed:", writeError.message);
    return { success: false, error: `Could not save the decision: ${writeError.message}` };
  }
  if (!updated || updated.length !== 1) {
    return {
      success: false,
      error: "Task changed before the decision was saved. Reload and try again.",
    };
  }

  return { success: true, data: { id, decision, at, by: actor.label } };
}
