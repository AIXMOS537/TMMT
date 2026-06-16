import { NextRequest, NextResponse } from "next/server";
import { parseQuoWebhook, ingestQuoInbound } from "@/lib/quo/inbound";

/**
 * Quo (OpenPhone) inbound support webhook.
 *
 * Quo is the SOLE backend support channel — this is where every inbound support
 * call/SMS to the support number lands. It forwards the contact into the brain,
 * gates by the caller's opted-in service, and creates a support case for the
 * evaluate/plan/route agent.
 *
 * Auth: fail-closed shared secret, matching the GHL webhook pattern.
 *   Header: x-quo-webhook-secret == QUO_WEBHOOK_SECRET
 *
 * Configure the single Quo support number's webhooks (message.received,
 * call.completed) to POST here.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.QUO_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-quo-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseQuoWebhook(body);
  if (!event) {
    // Not an inbound message/call we handle (e.g. our own outbound) — ack so Quo
    // doesn't retry.
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const result = await ingestQuoInbound(event);
  // Always 200 on a well-formed inbound so the provider doesn't hammer retries;
  // the result body carries the real outcome for observability.
  return NextResponse.json(result, { status: 200 });
}
