/**
 * Stage pending exec_va_tasks as SMS drafts in `automation_outbox`.
 *
 * WHY THIS EXISTS
 *   `generate_va_tasks_v2()` has been filling `exec_va_tasks` every day at 12:00
 *   and nothing has ever read the queue: 808 pending rows, 0 messages ever sent,
 *   0 rows in `agent_messages`. The GHL sender (`sendConversationMessage`) is
 *   built, tested and compliance-gated, and has zero callers. This is the
 *   missing middle.
 *
 * WHAT IT DOES NOT DO
 *   **It never sends.** It writes drafts to `automation_outbox` with
 *   status='queued', which is this system's established "waiting for the owner
 *   to tap send" surface. Nothing here calls GHL, Twilio, or any network egress.
 *
 * THE GATE IS NOT RE-IMPLEMENTED HERE
 *   Every candidate goes through `assertOutboundAllowed` — the same function
 *   `sendConversationMessage` calls at send time. So a draft that reaches the
 *   outbox is one the real sender would also have accepted, and the A2P /
 *   do-not-contact / per-lead opt-out rules are enforced once, in one place.
 *
 *   Anything the gate refuses is NOT written to the outbox at all. It is counted
 *   and reported instead. That is deliberate: `automation_outbox.status` is
 *   constrained to queued|sent|failed|cancelled, so there is no honest way to
 *   park a "held for approval" row there, and filling the owner's send queue
 *   with 600 rows he must not send would be worse than not filling it.
 */

import { assertOutboundAllowed, type OutboundReason } from "@/lib/outbound-gate";
import { createServiceRoleClient } from "@/lib/supabase-service";
import type { SupabaseClient } from "@supabase/supabase-js";

/** TMMT RENTALS. exec_va_tasks carries no org_id — every row is a house task. */
export const TMMT_RENTALS_ORG_ID = "8e651b25-e7c8-4356-af64-1716a82053b0";
export const TMMT_RENTALS_VERTICAL = "property";

export const OUTBOX_AUTOMATION = "va-task-sms";

/**
 * Which queue categories are an outbound message at all, and of what kind.
 *
 * `bgcheck_review` is absent on purpose: it is VISION internal review work, not
 * a message to a customer. `generate_va_tasks_v2` deliberately does not even
 * apply the do-not-contact filter to it for the same reason.
 *
 * transactional vs marketing decides the A2P gate: marketing terminates at the
 * owner-approval gate, transactional does not.
 */
export const MESSAGEABLE: Readonly<Record<string, "transactional" | "marketing">> = {
  payment_followup: "transactional",
  ticket_collect: "transactional",
  waitlist_contact: "marketing",
  lead_reengagement: "marketing",
};

export interface VaTaskRow {
  id: string;
  category: string;
  subject_name: string | null;
  subject_phone: string | null;
  context: Record<string, unknown> | null;
}

export interface StageSummary {
  dryRun: boolean;
  considered: number;
  staged: number;
  skippedNotMessageable: number;
  skippedNoPhone: number;
  skippedAlreadyQueued: number;
  refusedByGate: number;
  /** Gate reason -> count, e.g. { gate_hold: 606, dnc: 2 }. */
  refusedByReason: Record<string, number>;
  drafts: Array<{ taskId: string; category: string; to: string; body: string }>;
}

function firstString(ctx: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!ctx) return null;
  for (const k of keys) {
    const v = ctx[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function money(raw: string | null): string {
  if (!raw) return "a balance";
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "a balance";
}

/**
 * Draft the message for a task.
 *
 * Kept short, factual, and gentle by intent — a collections text that threatens
 * is both bad practice and against how this business is run. Every draft offers
 * a reply path and carries STOP, which is what makes the opt-out route that
 * writes `incoming_leads.opted_out` reachable in the first place.
 *
 * Exported so the wording is unit-testable without a database.
 */
export function draftMessage(task: VaTaskRow, agentName: string): string | null {
  const who = (task.subject_name ?? "").trim().split(/\s+/)[0] || "Hi";
  const ctx = task.context;

  switch (task.category) {
    case "payment_followup": {
      const amt = money(firstString(ctx, "past_due", "amount"));
      return `${who} - ${agentName} at TMMT Rentals. We show ${amt} past due on your rental. If that's not right, or you need to arrange something, just reply here. Reply STOP to opt out.`;
    }
    case "ticket_collect": {
      const amt = money(firstString(ctx, "total_owed"));
      return `${who} - ${agentName} at TMMT Rentals. We show ${amt} in outstanding tickets on your rental. Reply here and we'll sort it out. Reply STOP to opt out.`;
    }
    case "waitlist_contact": {
      const what = firstString(ctx, "vehicle_type", "make") ?? "a vehicle";
      return `${who} - ${agentName} at TMMT Rentals. You asked to hear when ${what} opens up. Still interested? Reply here. Reply STOP to opt out.`;
    }
    case "lead_reengagement":
      return `${who} - ${agentName} at TMMT Rentals. You enquired about renting with us. Still looking? Reply here and I'll help. Reply STOP to opt out.`;
    default:
      return null;
  }
}

export interface StageOptions {
  /** Nothing is written unless this is explicitly false. */
  dryRun?: boolean;
  limit?: number;
  categories?: string[];
  organizationId?: string;
  vertical?: string;
  agentName?: string;
  /**
   * Owner approval for MARKETING sends. Without it the gate returns gate_hold
   * for every marketing category and none are staged. This is the only lever
   * that releases lead_reengagement / waitlist_contact, and it must come from a
   * human decision, never a default.
   */
  ownerApproved?: boolean;
  db?: SupabaseClient;
}

export async function stageVaTaskMessages(opts: StageOptions = {}): Promise<StageSummary> {
  const {
    dryRun = true,
    limit = 500,
    categories,
    organizationId = TMMT_RENTALS_ORG_ID,
    vertical = TMMT_RENTALS_VERTICAL,
    agentName = "Taj",
    ownerApproved = false,
    db = createServiceRoleClient(),
  } = opts;

  const wanted = categories ?? Object.keys(MESSAGEABLE);

  const summary: StageSummary = {
    dryRun,
    considered: 0,
    staged: 0,
    skippedNotMessageable: 0,
    skippedNoPhone: 0,
    skippedAlreadyQueued: 0,
    refusedByGate: 0,
    refusedByReason: {},
    drafts: [],
  };

  const { data, error } = await db
    .from("exec_va_tasks")
    .select("id, category, subject_name, subject_phone, context")
    .eq("status", "pending")
    .in("category", wanted)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`exec_va_tasks read failed: ${error.message}`);
  const tasks = (data ?? []) as VaTaskRow[];

  for (const task of tasks) {
    summary.considered += 1;

    const smsType = MESSAGEABLE[task.category];
    if (!smsType) {
      summary.skippedNotMessageable += 1;
      continue;
    }

    const phone = task.subject_phone?.trim();
    if (!phone) {
      summary.skippedNoPhone += 1;
      continue;
    }

    const body = draftMessage(task, agentName);
    if (!body) {
      summary.skippedNotMessageable += 1;
      continue;
    }

    // Idempotency: never stack a second unsent draft for the same task.
    const dupe = await db
      .from("automation_outbox")
      .select("id")
      .eq("source_table", "exec_va_tasks")
      .eq("record_id", task.id)
      .eq("status", "queued")
      .limit(1)
      .maybeSingle();
    if (dupe.error) throw new Error(`automation_outbox dedupe read failed: ${dupe.error.message}`);
    if (dupe.data) {
      summary.skippedAlreadyQueued += 1;
      continue;
    }

    // The same gate the real sender runs. Fails closed on a read error.
    const gate = await assertOutboundAllowed({
      phone,
      organizationId,
      vertical,
      type: smsType,
      ownerApproved,
      db,
    });

    if (!gate.allowed) {
      summary.refusedByGate += 1;
      const reason: OutboundReason = gate.reason;
      summary.refusedByReason[reason] = (summary.refusedByReason[reason] ?? 0) + 1;
      continue;
    }

    summary.drafts.push({ taskId: task.id, category: task.category, to: phone, body });

    if (dryRun) {
      summary.staged += 1;
      continue;
    }

    const ins = await db.from("automation_outbox").insert({
      automation: OUTBOX_AUTOMATION,
      channel: "sms",
      to_address: phone,
      subject: task.category,
      body,
      source_table: "exec_va_tasks",
      record_id: task.id,
      status: "queued",
      org_id: organizationId,
    });
    if (ins.error) throw new Error(`automation_outbox insert failed: ${ins.error.message}`);
    summary.staged += 1;
  }

  return summary;
}
