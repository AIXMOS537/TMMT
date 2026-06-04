/**
 * Flatten nested dispatch payload for GHL inbound webhook field mapping.
 * GHL mappers work best with top-level keys matching contact custom field keys.
 */
export function flattenGhlDispatchPayload(args: {
  caseId: string;
  refCode: string;
  vendorJobId?: string | null;
  workType: string;
  caseType: string;
  subject: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  const vendor = (args.payload.vendor as Record<string, unknown> | undefined) ?? {};
  const route = (args.payload.route as Record<string, unknown> | undefined) ?? {};
  const pricing = (args.payload.pricing as Record<string, unknown> | undefined) ?? {};

  return {
    event: "tmmt.job.dispatched",
    version: 1,
    dispatched_at: new Date().toISOString(),
    case_id: args.caseId,
    ref_code: args.refCode,
    vendor_job_id: args.vendorJobId ?? null,
    work_type: args.workType,
    case_type: args.caseType,
    subject: args.subject,
    details: args.payload.details ?? null,
    protocol_id: args.payload.protocol_id ?? null,
    // Nested (for custom apps / debugging)
    vendor,
    route,
    pricing,
    // Flat keys — map 1:1 to GHL contact custom fields (tmmt_*)
    tmmt_job_ref: args.refCode,
    tmmt_job_subject: args.subject,
    tmmt_work_type: args.workType,
    tmmt_vendor_company: vendor.company ?? null,
    tmmt_vendor_contact: vendor.contact_name ?? null,
    tmmt_vendor_email: vendor.contact_email ?? null,
    tmmt_vendor_phone: vendor.contact_phone ?? null,
    tmmt_pickup: route.pickup ?? null,
    tmmt_dropoff: route.dropoff ?? null,
    tmmt_window_start: route.window_start ?? null,
    tmmt_window_end: route.window_end ?? null,
    tmmt_offered_price: pricing.offered_price ?? null,
    tmmt_due_at: pricing.due_at ?? null,
    tmmt_job_details: args.payload.details ?? null,
    tmmt_case_id: args.caseId,
  };
}
