import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processUnifiedIntake } from "@/lib/intake/unified";
import { logSyncEvent, markSyncEventProcessed } from "@/lib/ghl/sync-event";
import { normalizeGhlEvent, pickContactFields, pickContactId } from "@/lib/ghl/payload";
import { upsertGhlContact } from "@/lib/ghl/handlers/opportunity-stage";

const Body = z.object({
  event: z.string().optional(),
  submission_id: z.string().optional(),
  form_id: z.string().optional(),
  form_name: z.string().optional(),
  fields: z.record(z.string(), z.any()).optional(),
  contact_id: z.string().optional(),
  business_line: z.string().optional(),
  create_case: z.boolean().optional(),
});

function pickSubmissionId(raw: Record<string, unknown>): string | undefined {
  const id = raw.submission_id ?? raw.submissionId ?? raw.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function pickFormFields(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.fields && typeof raw.fields === "object") {
    return raw.fields as Record<string, unknown>;
  }
  if (raw.answers && typeof raw.answers === "object") {
    return raw.answers as Record<string, unknown>;
  }
  const omit = new Set([
    "event",
    "type",
    "contact_id",
    "contactId",
    "contact",
    "form_id",
    "formId",
    "form_name",
    "formName",
    "submission_id",
    "submissionId",
    "id",
    "create_case",
    "business_line",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!omit.has(k)) out[k] = v;
  }
  return out;
}

function fieldAsString(fields: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = fields[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export async function handleFormSubmission(
  supabase: SupabaseClient,
  raw: Record<string, unknown>
) {
  const contactId = pickContactId(raw);
  const parsed = Body.safeParse({
    ...raw,
    contact_id: contactId,
    submission_id: pickSubmissionId(raw),
    form_id: (raw.form_id ?? raw.formId) as string | undefined,
    form_name: (raw.form_name ?? raw.formName) as string | undefined,
  });

  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const fields = pickFormFields(raw);
  const contactFields = pickContactFields(raw);
  const customerName =
    contactFields.name ??
    fieldAsString(fields, ["name", "full_name", "customer_name", "first_name"]) ??
    "GHL Form Lead";
  const customerEmail =
    contactFields.email ?? fieldAsString(fields, ["email", "customer_email"]);
  const customerPhone =
    contactFields.phone ?? fieldAsString(fields, ["phone", "customer_phone"]);

  const eventType = normalizeGhlEvent(raw) || "form.submitted";
  const eventId = await logSyncEvent(supabase, {
    event_type: eventType,
    external_id: parsed.data.submission_id ?? contactId ?? null,
    payload: raw,
  });

  if (contactId) {
    await upsertGhlContact(supabase, {
      ghl_contact_id: contactId,
      full_name: customerName,
      email: customerEmail,
      phone: customerPhone,
      raw_payload: raw,
    });
  }

  const formPayload = {
    ghl_submission_id: parsed.data.submission_id ?? null,
    ghl_contact_id: contactId ?? null,
    form_id: parsed.data.form_id ?? null,
    form_name: parsed.data.form_name ?? null,
    fields,
    source: "ghl",
    raw_payload: raw,
  };

  const formRes = parsed.data.submission_id
    ? await supabase
        .from("ghl_form_submissions")
        .upsert(formPayload, { onConflict: "ghl_submission_id" })
        .select("id")
        .single()
    : await supabase.from("ghl_form_submissions").insert(formPayload).select("id").single();

  const formRow = formRes.data;
  const formErr = formRes.error;

  if (formErr || !formRow) {
    return {
      status: 500 as const,
      body: { error: formErr?.message ?? "form submission insert failed" },
    };
  }

  const autoCase =
    parsed.data.create_case ??
    (process.env.GHL_FORM_AUTO_CASE !== "false" && customerName !== "GHL Form Lead");

  let intake: Awaited<ReturnType<typeof processUnifiedIntake>> | undefined;
  if (autoCase) {
    try {
      intake = await processUnifiedIntake({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        request_type: "rental_booking",
        subject: parsed.data.form_name ?? `GHL form ${parsed.data.form_id ?? "submission"}`,
        details: JSON.stringify(fields).slice(0, 8000),
        source: "ghl_form",
        business_line: parsed.data.business_line ?? "rentals",
        payload: { ghl_contact_id: contactId, form_submission_id: formRow.id, fields },
        tags: ["ghl", "form"],
      });

      await supabase
        .from("ghl_form_submissions")
        .update({ intake_id: intake.intakeId, case_id: intake.caseId })
        .eq("id", formRow.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "intake failed";
      if (eventId) {
        await supabase.from("sync_events").update({ error: message }).eq("id", eventId);
      }
      return {
        status: 500 as const,
        body: { error: message, form_submission_id: formRow.id },
      };
    }
  }

  if (eventId) {
    await markSyncEventProcessed(supabase, eventId);
  }

  return {
    status: 200 as const,
    body: {
      ok: true,
      handler: "form.submitted",
      form_submission_id: formRow.id,
      ghl_contact_id: contactId ?? null,
      case: intake
        ? { id: intake.caseId, ref_code: intake.refCode, status: intake.status }
        : null,
    },
  };
}
