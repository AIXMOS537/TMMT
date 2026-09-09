import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addContactTag } from "@/lib/ghl/client";
import { consumeGhlEventId } from "@/lib/ghl/webhook-auth";
import { overdueReplayKey } from "@/lib/ghl/overdue-replay-key";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { secretMatches } from "@/lib/secure-compare";

const Body = z.object({
  contact_id: z.string().min(1),
  customer_name: z.string().optional(),
  amount_due: z.union([z.string(), z.number()]).optional(),
  due_date: z.string().optional(),
  source: z.string().optional(),
});

/**
 * Inbound overdue payment signal (n8n / push_overdue_to_ghl.py).
 * Applies GHL tag `payment-overdue` for GHL_OVERDUE_WORKFLOW_SETUP workflows.
 *
 * Order of guards (T-02c): secret → parse → REPLAY GATE → sync_events → tag.
 * The payload carries no event id or timestamp, so the replay gate keys on a
 * content hash bucketed by UTC day (`overdueReplayKey`) and rides the shared
 * GHL idempotency store (`consumeGhlEventId`: `ghl_webhook_events`, with the
 * in-memory + `reportDegraded` fallback every other GHL route already has).
 * A retried delivery is a 200 no-op: no sync_events row, no tag call.
 */
export async function POST(req: NextRequest) {
  const secret =
    process.env.GHL_OVERDUE_WEBHOOK_SECRET ?? process.env.GHL_WEBHOOK_SECRET;
  if (!secretMatches(req.headers.get("x-ghl-secret"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createServiceRoleClient();

  // ── REPLAY GATE ────────────────────────────────────────────────────────
  // Same (contact, amount, due date) on the same UTC day = the same signal.
  // The producer's deliberate daily "still overdue" re-send gets a new key
  // each day; an n8n / HTTP retry inside the day does not. 200, not 409: the
  // producer is a cron that treats non-2xx as a failure to alert on.
  const idem = await consumeGhlEventId({ webhookId: overdueReplayKey(data) }, supabase);
  if (!idem.ok) {
    console.warn("[ghl/overdue] duplicate overdue signal, dropping replay", { contact_id: data.contact_id });
    return NextResponse.json({ ok: true, duplicate: true, contact_id: data.contact_id });
  }

  await supabase.from("sync_events").insert({
    source: "overdue_payment",
    event_type: "payment.overdue",
    external_id: data.contact_id,
    payload: data as unknown as Record<string, unknown>,
    processed: false,
  });

  let ghlTagApplied = false;
  try {
    await addContactTag(data.contact_id, "payment-overdue");
    ghlTagApplied = true;
  } catch (err) {
    console.error("[ghl/overdue] tag", err);
  }

  return NextResponse.json({
    ok: true,
    contact_id: data.contact_id,
    ghl_tag_applied: ghlTagApplied,
    message: ghlTagApplied
      ? "Tagged payment-overdue in GHL."
      : "Logged event; set GHL_API_KEY + GHL_LOCATION_ID to auto-tag.",
  });
}
