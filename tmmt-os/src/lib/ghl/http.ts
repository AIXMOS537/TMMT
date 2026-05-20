import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { dispatchGhlWebhook } from "@/lib/ghl/dispatch";
import { verifyGhlWebhook } from "@/lib/ghl/webhook-auth";

export async function handleGhlWebhookPost(
  req: NextRequest,
  force?: Parameters<typeof dispatchGhlWebhook>[2]
) {
  const auth = verifyGhlWebhook(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: auth.status });
  }

  const json = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const result = await dispatchGhlWebhook(supabase, json, force);
  return NextResponse.json(result.body, { status: result.status });
}
