import { createServiceRoleClient } from "@/lib/supabase-service";
import { syncContactPortalFields } from "@/lib/ghl/sync-contact-portal-fields";
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
  business_line?: string;
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

function isMissingColumnError(message: string | undefined, column: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes(column) && (m.includes("column") || m.includes("schema cache"));
}

/**
 * Single path for web form, API webhook, and team tools: intake row → case → sync_event → routing.
 */
export async function processUnifiedIntake(
  input: UnifiedIntakeInput
): Promise<UnifiedIntakeResult> {
  const supabase = createServiceRoleClient();
  const requestType = input.request_type ?? "other";
  const source = input.source ?? "api";
  const businessLine =
    input.business_line ?? (requestType.startsWith("rental") ? "rentals" : null);

  const intakeBase = {
    customer_name: input.customer_name,
    customer_email: input.customer_email ?? null,
    customer_phone: input.customer_phone ?? null,
    request_type: requestType,
    subject: input.subject,
    details: input.details ?? null,
    source,
    airtable_id: input.airtable_id ?? null,
    payload: input.payload ?? {},
  };

  const intakePayload = businessLine
    ? { ...intakeBase, business_line: businessLine }
    : intakeBase;

  let intake = await supabase
    .from("customer_intake_forms")
    .insert(intakePayload as typeof intakeBase)
    .select("id")
    .single();

  if (intake.error && businessLine && isMissingColumnError(intake.error.message, "business_line")) {
    intake = await supabase.from("customer_intake_forms").insert(intakeBase).select("id").single();
  }
  if (intake.error || !intake.data) {
    throw new Error(intake.error?.message ?? "intake insert failed");
  }

  const caseBase = {
    intake_id: intake.data.id,
    customer_name: input.customer_name,
    customer_email: input.customer_email ?? null,
    customer_phone: input.customer_phone ?? null,
    request_type: requestType,
    subject: input.subject,
    description: input.details ?? null,
    airtable_id: input.airtable_id ?? null,
    status: suggestedNextStatus(requestType),
  };

  const casePayload = businessLine
    ? { ...caseBase, business_line: businessLine }
    : caseBase;

  let caseRow = await supabase
    .from("cases")
    .insert(casePayload as typeof caseBase)
    .select("id, ref_code, status")
    .single();

  if (caseRow.error && businessLine && isMissingColumnError(caseRow.error.message, "business_line")) {
    caseRow = await supabase.from("cases").insert(caseBase).select("id, ref_code, status").single();
  }
  if (caseRow.error || !caseRow.data) {
    throw new Error(caseRow.error?.message ?? "case insert failed");
  }

  const c = caseRow.data;

  await supabase.from("sync_events").insert({
    source,
    event_type: "intake.created",
    external_id: c.id,
    payload: {
      intake_id: intake.data.id,
      case_id: c.id,
      ref_code: c.ref_code,
      request_type: requestType,
      business_line: businessLine,
    },
    processed: true,
  });

  try {
    await supabase.from("activity_logs").insert({
      entity: "case",
      entity_id: c.id,
      action: "intake_created",
      data: {
        intake_id: intake.data.id,
        request_type: requestType,
        ref_code: c.ref_code,
        business_line: businessLine,
      },
    });
  } catch {
    /* optional on minimal schema */
  }

  const routing = await executeRouting({
    source,
    tags: input.tags ?? [requestType],
    businessLine: businessLine ?? undefined,
    caseId: c.id,
    customerName: input.customer_name,
    subject: input.subject,
    customFields: input.payload,
  });

  void syncContactPortalFields({
    refCode: c.ref_code,
    caseId: c.id,
    customerEmail: input.customer_email,
    ghlContactId:
      typeof input.payload?.ghl_contact_id === "string"
        ? input.payload.ghl_contact_id
        : typeof (input.payload?.ghl as { contact_id?: string } | undefined)?.contact_id === "string"
          ? (input.payload!.ghl as { contact_id: string }).contact_id
          : null,
  });

  return {
    intakeId: intake.data.id,
    caseId: c.id,
    refCode: c.ref_code,
    status: c.status,
    routing,
  };
}
