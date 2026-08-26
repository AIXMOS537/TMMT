import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { dispatchGhlWebhook } from "@/lib/ghl/dispatch";
import { consumeGhlEventId, verifyGhlWebhook } from "@/lib/ghl/webhook-auth";

export async function handleGhlWebhookPost(
  req: NextRequest,
  force?: Parameters<typeof dispatchGhlWebhook>[2]
) {
  const rawBody = await req.text();
  const auth = verifyGhlWebhook(req, rawBody);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: auth.status });
  }

  let json: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 });
    }
    json = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const idem = await consumeGhlEventId(json, supabase);
  if (!idem.ok) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 409 });
  }

  const result = await dispatchGhlWebhook(supabase, json, force);
  return NextResponse.json(result.body, { status: result.status });
}
