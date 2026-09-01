"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";

/**
 * Refer someone to the credit partner.
 *
 * partner_referrals, request_handoff, capture_handoff_consent and
 * enforce_handoff_consent were all built for this and had never held a row.
 * The reason was in the schema, not the code: both org columns were constrained
 * to 'tmmt' and 'aixmos', so a referral to a third party could not be written.
 * That constraint now includes khan_strategies, in both directions — they run
 * their own business and customers move both ways.
 *
 * Consent is captured before anything is released, which is the whole point of
 * the gate: enforce_handoff_consent() blocks an acceptance whose referral has
 * no consent_captured_at. Passing the channel here sets that timestamp in the
 * same statement that creates the row, so a referral cannot exist in a state
 * where someone's details are shareable but nobody recorded them agreeing.
 *
 * Note what this deliberately does NOT do: send anything. It records that the
 * person said yes and that the referral is pending. Handing the details over
 * happens when the partner accepts it, through the existing handoff screen.
 */

export const REFERRAL_ORGS = ["tmmt", "aixmos", "khan_strategies"] as const;
export type ReferralOrg = (typeof REFERRAL_ORGS)[number];

/** Matches CONSENT_CHANNELS on the handoffs screen. */
export const CONSENT_CHANNELS = ["sms", "email", "call", "form", "in_person"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

export type ReferralResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function referToPartner(input: {
  contactRef: string;
  reason: string;
  consentChannel: ConsentChannel;
  destOrg?: ReferralOrg;
  sourceOrg?: ReferralOrg;
}): Promise<ReferralResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isStaffUser(user)) return { ok: false, error: "Not authorized." };

  const contactRef = input.contactRef?.trim();
  if (!contactRef) return { ok: false, error: "Who is being referred?" };

  if (!CONSENT_CHANNELS.includes(input.consentChannel)) {
    return { ok: false, error: "Record how they agreed before referring." };
  }

  const dest = input.destOrg ?? "khan_strategies";
  const source = input.sourceOrg ?? "tmmt";
  if (dest === source) return { ok: false, error: "A referral needs two different parties." };

  // commission is deliberately not passed. request_handoff ignores it for
  // non-staff anyway, and the rate is a commercial decision that belongs on
  // review rather than baked into every referral this screen creates.
  const { data, error } = await supabase.rpc("request_handoff", {
    p_source_org: source,
    p_dest_org: dest,
    p_contact_ref: contactRef,
    p_reason: input.reason?.trim() || "Referred for credit support",
    p_consent_channel: input.consentChannel,
    p_commission_cents: null,
  });

  if (error) {
    console.error("[referToPartner]", error.message);
    return { ok: false, error: "Could not record that referral." };
  }

  revalidatePath("/command/handoffs");
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, id: String((row as { id?: string })?.id ?? "") };
}
