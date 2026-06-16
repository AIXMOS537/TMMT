import { NextResponse } from "next/server";
import {
  ingestQuoInbound,
  normalizePhone,
  type NormalizedQuoEvent,
} from "@/lib/quo/inbound";

export const dynamic = "force-dynamic";

/**
 * Quo poll fallback (Phase 3e). Safety net for missed webhooks: sweeps recent
 * inbound messages from the Quo (OpenPhone) REST API and ingests any not seen
 * yet. Ingestion is idempotent (dedupe_key), so overlap with the webhook is
 * harmless.
 *
 * Auth: CRON_SECRET (Bearer or x-cron-secret), matching the other cron routes.
 * Requires QUO_API_KEY (+ optional QUO_PHONE_NUMBER_ID). Degrades gracefully
 * when unset so the route never errors in environments that rely on webhooks.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.QUO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, skipped: "QUO_API_KEY not set" });
  }

  const phoneNumberId = process.env.QUO_PHONE_NUMBER_ID;
  const url = new URL("https://api.openphone.com/v1/messages");
  if (phoneNumberId) url.searchParams.set("phoneNumberId", phoneNumberId);
  url.searchParams.set("maxResults", "50");

  let items: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `quo api ${res.status}` },
        { status: 200 }
      );
    }
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    items = Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 200 }
    );
  }

  let ingested = 0;
  let assigned = 0;
  for (const m of items) {
    const direction = typeof m.direction === "string" ? m.direction : "incoming";
    if (direction !== "incoming" && direction !== "inbound") continue;
    const id = typeof m.id === "string" ? m.id : "";
    if (!id) continue;

    const toRaw = m.to;
    const event: NormalizedQuoEvent = {
      kind: "sms",
      externalId: id,
      fromPhone: normalizePhone(typeof m.from === "string" ? m.from : ""),
      toPhone: normalizePhone(
        Array.isArray(toRaw)
          ? (toRaw[0] as string)
          : typeof toRaw === "string"
          ? toRaw
          : ""
      ),
      text: typeof m.body === "string" ? m.body : undefined,
      occurredAt: typeof m.createdAt === "string" ? m.createdAt : undefined,
    };
    if (!event.fromPhone) continue;

    const result = await ingestQuoInbound(event);
    if (result.ok && !result.ignored) ingested += 1;
    if (result.assigned) assigned += 1;
  }

  return NextResponse.json({ ok: true, scanned: items.length, ingested, assigned });
}
