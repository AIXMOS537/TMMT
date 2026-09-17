"use server";

import { z } from "zod";
import { createSSRClient } from "@/lib/supabase-server";
import { partnerHandoffUrl, PARTNER_NAME } from "@/lib/partner-handoff";

/**
 * The only sanctioned hand-off to the partner.
 *
 * Nothing else in TMMT OS sends a visitor to their site. This action refuses
 * unless `consent` is literally true, records the referral as a TMMT lead
 * first (so the lead is ours even when we give the introduction away), and
 * only then returns the outbound URL for the person to click.
 */

const OPT_IN_FORM_ID = "partner-optin-all-in-one";

const schema = z.object({
  contact_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(254).or(z.literal("")),
  interest: z.enum(["credit", "funding", "both", "other"]),
  notes: z.string().max(2000).optional(),
  // Unchecked boxes are absent from FormData, so anything other than the
  // literal "yes" is a no. There is no default-true path here on purpose.
  consent: z.literal("yes"),
});

export type OptInResult =
  | { success: true; handoffUrl: string }
  | { success: false; error: string };

export async function submitPartnerOptIn(formData: FormData): Promise<OptInResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const missingConsent = parsed.error.issues.some((i) => i.path[0] === "consent");
    return {
      success: false,
      error: missingConsent
        ? `Tick the box to be introduced to ${PARTNER_NAME}. Nothing is sent otherwise.`
        : "Please check your entries and try again.",
    };
  }
  const d = parsed.data;

  // Record it on our side first. If this insert fails we do NOT hand the
  // person over — an untracked referral is exactly the leak this replaces.
  const supabase = await createSSRClient();
  const { error } = await supabase.from("incoming_leads").insert({
    contact_name: d.contact_name.trim(),
    phone: d.phone.replace(/\D/g, "") || null,
    email: d.email || null,
    opportunity_name: `Partner referral — ${PARTNER_NAME} (${d.interest})`,
    priority_level: "Requires Follow Up",
    notes: d.notes || null,
    status: "New Lead",
    source: "partner-optin",
    source_campaign: OPT_IN_FORM_ID,
    utm_source: "tmmt-os",
    utm_medium: "opt-in-referral",
    utm_campaign: d.interest,
  });
  if (error) {
    console.error("[partner-optin] insert failed:", error.message);
    return { success: false, error: "Submission failed. Please try again." };
  }

  const handoffUrl = partnerHandoffUrl({
    optedIn: true,
    formId: OPT_IN_FORM_ID,
    interest: d.interest,
  });
  if (!handoffUrl) {
    // Unreachable while consent is validated above; kept so a future edit to
    // partnerHandoffUrl fails closed instead of returning an empty link.
    return { success: false, error: "Referral is unavailable right now." };
  }
  return { success: true, handoffUrl };
}
