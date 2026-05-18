import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { REQUEST_TYPES } from "@/lib/workflow/statuses";
import { processUnifiedIntake } from "@/lib/intake/unified";

const Body = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  request_type: z.enum(REQUEST_TYPES).optional(),
  subject: z.string().min(1),
  details: z.string().optional(),
  source: z.string().optional(),
  airtable_id: z.string().optional(),
  payload: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Public webhook endpoint for external intake sources (Airtable automation,
 * GoHighLevel webhook, Zapier, n8n, etc.). Gate it with the INTAKE_WEBHOOK_SECRET
 * header so it can't be spammed.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INTAKE_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-intake-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const result = await processUnifiedIntake({
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      request_type: data.request_type,
      subject: data.subject,
      details: data.details,
      source: data.source ?? "api",
      airtable_id: data.airtable_id,
      payload: data.payload,
      tags: data.tags,
    });

    return NextResponse.json({
      ok: true,
      case: { id: result.caseId, ref_code: result.refCode, status: result.status },
      intake_id: result.intakeId,
      routing: result.routing,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "intake failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
