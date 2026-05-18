import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { executeRouting } from "@/lib/routing/execute";
import { suggestedNextStatus, type RequestType } from "@/lib/workflow/statuses";

export type UnifiedIntakeInput = {
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  request_type?: RequestType;
  subject: string;
  details?: string | null;
  source?: string;
  airtable_id?: string | null;
  payload?: Record<string, unknown>;
  tags?: string[];
};

export type UnifiedIntakeResult = {
  intakeId: string;
  caseId: string;
  refCode: string;
  status: string;
  routing?: Awaited<ReturnType<typeof executeRouting>>;
};

/**
 * Single path for web form, API webhook, and team tools: intake row → case → sync_event → routing.
 */
export async function processUnifiedIntake(
  input: UnifiedIntakeInput
): Promise<UnifiedIntakeResult> {
  const supabase = createSupabaseServiceClient();
  const requestType = input.request_type ?? "other";
  const source = input.source ?? "api";

  const { data: intake, error: intakeErr } = await supabase
    .from("customer_intake_forms")
    .insert({
      customer_name: input.customer_name,
      customer_email: input.customer_email ?? null,
      customer_phone: input.customer_phone ?? null,
      request_type: requestType,
      subject: input.subject,
      details: input.details ?? null,
      source,
      airtable_id: input.airtable_id ?? null,
      payload: input.payload ?? {},
    })
    .select("id")
    .single();
  if (intakeErr || !intake) {
    throw new Error(intakeErr?.message ?? "intake insert failed");
  }

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .insert({
      intake_id: intake.id,
      customer_name: input.customer_name,
      customer_email: input.customer_email ?? null,
      customer_phone: input.customer_phone ?? null,
      request_type: requestType,
      subject: input.subject,
      description: input.details ?? null,
      airtable_id: input.airtable_id ?? null,
      status: suggestedNextStatus(requestType),
    })
    .select("id, ref_code, status")
    .single();
  if (caseErr || !c) {
    throw new Error(caseErr?.message ?? "case insert failed");
  }

  await supabase.from("sync_events").insert({
    source,
    event_type: "intake.created",
    external_id: c.id,
    payload: {
      intake_id: intake.id,
      case_id: c.id,
      ref_code: c.ref_code,
      request_type: requestType,
    },
    processed: true,
  });

  try {
    await supabase.from("activity_logs").insert({
      entity: "case",
      entity_id: c.id,
      action: "intake_created",
      data: { intake_id: intake.id, request_type: requestType, ref_code: c.ref_code },
    });
  } catch {
    /* optional on minimal schema */
  }

  const routing = await executeRouting({
    source,
    tags: input.tags ?? [requestType],
    businessLine: requestType.startsWith("rental") ? "rentals" : undefined,
    caseId: c.id,
    customerName: input.customer_name,
    subject: input.subject,
    customFields: input.payload,
  });

  return {
    intakeId: intake.id,
    caseId: c.id,
    refCode: c.ref_code,
    status: c.status,
    routing,
  };
}
