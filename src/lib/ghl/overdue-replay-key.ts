import { createHash } from "node:crypto";

/**
 * Replay key for the overdue-payment signal (`/api/webhooks/ghl/overdue`, T-02c).
 *
 * The producers (n8n daily schedule, `push_overdue_to_ghl.py`) send
 * `{ contact_id, customer_name?, amount_due?, due_date?, source? }` — no
 * webhook id, no event id, no timestamp. There is nothing stable to dedupe
 * on, so the key is a content hash of the fields that define the overdue
 * STATE (contact, amount, due date) plus the UTC day the delivery arrived.
 *
 * Why the day bucket: the producer re-sends every overdue row once a day on
 * purpose ("still overdue"), and `ghl_webhook_events` is never pruned, so a
 * bare content hash would drop that daily signal forever after the first
 * one — and the `payment-overdue` tag would never be re-applied if someone
 * removed it in GHL. The retries that matter (n8n / HTTP retry storms,
 * double deliveries) land seconds to minutes apart; a per-day window catches
 * those and keeps the daily cadence, which is also what the workflow doc asks
 * for ("no duplicate alerts same day").
 *
 * Trade-off, stated: a legitimately identical re-send on the SAME UTC day is
 * dropped; a retry that straddles midnight UTC gets through (harmless — the
 * tag is idempotent, the cost is one extra sync_events row). `customer_name`
 * and `source` are presentation, not state, and are left out of the hash so
 * two producers reporting the same debt collapse to one event.
 */
export interface OverdueSignal {
  contact_id: string;
  amount_due?: string | number;
  due_date?: string;
}

export function overdueReplayKey(signal: OverdueSignal, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const amount = signal.amount_due == null ? "" : String(signal.amount_due).trim();
  const due = (signal.due_date ?? "").trim();
  const digest = createHash("sha256")
    .update(`${signal.contact_id}|${amount}|${due}|${day}`, "utf8")
    .digest("hex");
  return `overdue:v1:${digest}`;
}
