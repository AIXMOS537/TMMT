import { NextRequest } from "next/server";
import { handleGhlWebhookPost } from "@/lib/ghl/http";

/**
 * GHL webhooks (auto-routed by payload):
 * - opportunity.stage_changed → crm_sync_records + Airtable + auto-ops
 * - contact.created / contact.updated → ghl_contacts
 * - form.submitted → ghl_form_submissions (+ optional case via GHL_FORM_AUTO_CASE)
 * - appointment.booked → ghl_appointments
 *
 * Header: X-GHL-Secret: {GHL_WEBHOOK_SECRET}
 */
export async function POST(req: NextRequest) {
  return handleGhlWebhookPost(req);
}
