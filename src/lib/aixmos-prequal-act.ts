import "server-only";

import { createSSRClient } from "@/lib/supabase-server";
import { resolveGhlContactId } from "@/lib/ghl/resolve-contact";
import { addContactTag, isGhlConfigured } from "@/lib/ghl/client";
import {
  decidePrequalRoute,
  handoffArgs,
  type PrequalAction,
  type PrequalDecision,
} from "@/lib/aixmos-prequal";

/**
 * The ACT half of the prequal lane. `aixmos-prequal.ts` decides; this performs.
 *
 * Wired to the moment `background_checks.eligibility_status` is written — see
 * `src/app/(admin)/admin-actions.ts`. That is the real decision point, and it is
 * deliberately NOT lead intake: a brand-new lead has no eligibility outcome and
 * no credit file yet, so there is nothing to route on. Routing at intake would
 * hand over people who go on to be approved.
 *
 * Two side effects, in this order and never merged:
 *
 *  1. The GHL tag. Tagging a contact inside the owner's own CRM needs no
 *     consent — it is what starts the SMS that ASKS for consent.
 *  2. The cross-company handoff. This moves a person from TMMT to AIXMOS and
 *     therefore requires consent already captured. Without it the tag still
 *     goes out and the handoff waits.
 *
 * Nothing here throws. A staff member setting an eligibility outcome must never
 * see their save fail because GoHighLevel was unreachable; failures are reported
 * in the returned `errors` and the outcome fields say exactly what did happen.
 */

export type HandoffOutcome =
  /** request_handoff() created a pending referral. */
  | "created"
  /** A pending referral for this contact already exists — not duplicated. */
  | "already_open"
  /** Decision calls for a handoff but no consent has been logged yet. */
  | "awaiting_consent"
  /** This decision is not a handoff (waitlist, review, approved, unknown). */
  | "not_applicable"
  /** The RPC was attempted and rejected. See `errors`. */
  | "failed";

export interface PrequalRouteOutcome {
  action: PrequalAction;
  decision: PrequalDecision;
  /** The tag actually applied in GHL, or null if none was due or none landed. */
  tagApplied: string | null;
  handoff: HandoffOutcome;
  /** Non-fatal failures. Empty on a clean run. */
  errors: string[];
}

export type ConsentChannel = "sms" | "email" | "verbal";

/**
 * Route one applicant on the strength of their eligibility outcome.
 *
 * `contactRef` is what identifies the person on the referral row and in the
 * /command/handoffs table — an email or phone, whatever staff will recognise.
 */
export async function routeDeclinedApplicant(args: {
  eligibilityStatus: string | null | undefined;
  contactRef: string;
  /** Used to find the GHL contact to tag. Optional — tagging is best-effort. */
  email?: string | null;
  ghlContactId?: string | null;
  /** Consent already captured for the TMMT → AIXMOS move, if any. */
  consentCapturedVia?: ConsentChannel | null;
}): Promise<PrequalRouteOutcome> {
  const decision = decidePrequalRoute(args.eligibilityStatus);
  const errors: string[] = [];

  const outcome: PrequalRouteOutcome = {
    action: decision.action,
    decision,
    tagApplied: null,
    handoff: "not_applicable",
    errors,
  };

  // "none" and "await_review" both mean: do nothing yet. await_review is a
  // human still deciding; acting now would pre-empt them.
  if (decision.action === "none" || decision.action === "await_review") {
    return outcome;
  }

  // ── 1. Tag in GHL ────────────────────────────────────────────────
  if (decision.ghlTag && isGhlConfigured()) {
    try {
      const contactId = await resolveGhlContactId({
        customerEmail: args.email ?? null,
        ghlContactId: args.ghlContactId ?? null,
      });
      if (contactId) {
        await addContactTag(contactId, decision.ghlTag);
        outcome.tagApplied = decision.ghlTag;
      } else {
        errors.push(
          `No GHL contact matched ${args.email ?? args.contactRef} — tag "${decision.ghlTag}" not applied.`
        );
      }
    } catch (err) {
      errors.push(`GHL tag "${decision.ghlTag}" failed: ${message(err)}`);
    }
  }

  // ── 2. Cross-company handoff ─────────────────────────────────────
  if (decision.action !== "handoff_to_aixmos") return outcome;

  const rpcArgs = handoffArgs({
    decision,
    contactRef: args.contactRef,
    consentCapturedVia: args.consentCapturedVia ?? null,
  });

  // handoffArgs() returns null when consent is missing. That is the gate doing
  // its job, not an error: the tag above starts the SMS that asks for consent,
  // and /command/handoffs logs it when the person says yes.
  if (!rpcArgs) {
    outcome.handoff = "awaiting_consent";
    return outcome;
  }

  const supabase = await createSSRClient();

  // A staff member re-saving the same record must not stack up referrals for
  // the same person. Only a still-pending one blocks: a declined or completed
  // referral means the person came back around, which is a new handoff.
  const { data: open, error: lookupError } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("source_contact_ref", rpcArgs.p_contact_ref)
    .eq("dest_org", rpcArgs.p_dest_org)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    errors.push(`Could not check for an existing handoff: ${lookupError.message}`);
    outcome.handoff = "failed";
    return outcome;
  }
  if (open) {
    outcome.handoff = "already_open";
    return outcome;
  }

  const { error: rpcError } = await supabase.rpc("request_handoff", rpcArgs);
  if (rpcError) {
    errors.push(`request_handoff failed: ${rpcError.message}`);
    outcome.handoff = "failed";
    return outcome;
  }

  outcome.handoff = "created";
  return outcome;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
