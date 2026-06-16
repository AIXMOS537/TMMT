import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { logMemoryEvent } from "@/lib/memory";

export const dynamic = "force-dynamic";

/**
 * Slack → brain ingestor (Slack Events API). Verifies the Slack signing secret
 * (HMAC over the raw body, fail-closed), handles the url_verification handshake,
 * and logs message events as memory_events (source=slack) so recon/ask/the
 * morning brief see team chatter. Idempotent via dedupe_key.
 *
 * Setup: Slack app → Event Subscriptions → Request URL = /api/webhooks/slack;
 * subscribe to message.channels (+ groups/im as desired). Env: SLACK_SIGNING_SECRET.
 */
function verify(raw: string, ts: string | null, sig: string | null, secret: string): boolean {
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay guard
  const mine = "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${raw}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");

  if (body.type === "url_verification") {
    if (secret && !verify(raw, ts, sig, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ challenge: body.challenge });
  }

  if (!secret || !verify(raw, ts, sig, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.type === "event_callback" && body.event) {
    const e = body.event as Record<string, unknown>;
    if (e.type === "message" && !e.bot_id && typeof e.text === "string" && e.text) {
      await logMemoryEvent({
        action: "slack_message",
        source: "slack",
        actorKind: "team",
        actorLabel: typeof e.user === "string" ? e.user : "slack",
        summary: String(e.text).slice(0, 200),
        details: { channel: e.channel ?? null, ts: e.ts ?? null },
        dedupeKey: `slack:msg:${String(e.channel)}:${String(e.ts)}`,
        occurredAt: e.ts ? new Date(Number(e.ts) * 1000).toISOString() : undefined,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
