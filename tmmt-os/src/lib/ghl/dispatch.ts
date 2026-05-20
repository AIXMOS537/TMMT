import type { SupabaseClient } from "@supabase/supabase-js";
import { handleAppointment } from "@/lib/ghl/handlers/appointment";
import { handleContact } from "@/lib/ghl/handlers/contact";
import { handleFormSubmission } from "@/lib/ghl/handlers/form";
import { handleOpportunityStage } from "@/lib/ghl/handlers/opportunity-stage";
import {
  isAppointmentPayload,
  isContactPayload,
  isFormPayload,
  isOpportunityStagePayload,
  normalizeGhlEvent,
} from "@/lib/ghl/payload";

export type GhlHandlerResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Route GHL webhook JSON by `event` / payload shape.
 * Dedicated sub-routes can call a specific handler directly.
 */
export async function dispatchGhlWebhook(
  supabase: SupabaseClient,
  raw: Record<string, unknown>,
  force?: "stage" | "contact" | "form" | "appointment"
): Promise<GhlHandlerResult> {
  if (force === "stage" || (!force && isOpportunityStagePayload(raw))) {
    return handleOpportunityStage(supabase, raw);
  }
  if (force === "contact" || (!force && isContactPayload(raw))) {
    return handleContact(supabase, raw);
  }
  if (force === "form" || (!force && isFormPayload(raw))) {
    return handleFormSubmission(supabase, raw);
  }
  if (force === "appointment" || (!force && isAppointmentPayload(raw))) {
    return handleAppointment(supabase, raw);
  }

  return {
    status: 400,
    body: {
      error: "unknown GHL webhook payload",
      hint: "Set event to contact.created, form.submitted, appointment.booked, or include stage + contact_id",
      received_event: normalizeGhlEvent(raw) || null,
    },
  };
}
