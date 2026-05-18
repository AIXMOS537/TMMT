import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addContactTag } from "@/lib/ghl/client";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
 */
export async function POST(req: NextRequest) {
  const secret =
    process.env.GHL_OVERDUE_WEBHOOK_SECRET ?? process.env.GHL_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-ghl-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createSupabaseServiceClient();

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
