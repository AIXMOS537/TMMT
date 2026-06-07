import { clientLoginUrl, clientUpdatesUrl, trackCaseUrl } from "@/lib/portal-links";
import { isGhlConfigured, updateContactCustomFields } from "./client";
import { resolveGhlContactId } from "./resolve-contact";

export type SyncPortalFieldsResult = {
  ok: boolean;
  contactId: string | null;
  error?: string;
  hint?: string;
  fields?: Record<string, string>;
};

function fieldKeys() {
  return {
    caseRef: process.env.GHL_CF_CASE_REF_KEY?.trim() || "tmmt_case_ref",
    trackUrl: process.env.GHL_CF_TRACK_URL_KEY?.trim() || "tmmt_track_url",
    portalUrl: process.env.GHL_CF_PORTAL_URL_KEY?.trim() || "tmmt_portal_url",
    loginUrl: process.env.GHL_CF_LOGIN_URL_KEY?.trim() || "tmmt_portal_login_url",
  };
}

/**
 * Writes TMMT portal merge fields on the GHL contact for workflow SMS/email.
 * Create matching custom fields in GHL (Settings → Custom Fields → Contact).
 */
export async function syncContactPortalFields(args: {
  refCode: string;
  caseId?: string;
  customerEmail?: string | null;
  ghlContactId?: string | null;
}): Promise<SyncPortalFieldsResult> {
  if (!isGhlConfigured()) {
    return {
      ok: false,
      contactId: null,
      hint: "GHL_API_KEY or GHL_LOCATION_ID is not set on the server (check Vercel env).",
    };
  }

  if (!args.refCode?.trim()) {
    return { ok: false, contactId: null, hint: "Case reference is missing." };
  }

  try {
    const contactId = await resolveGhlContactId({
      caseId: args.caseId,
      customerEmail: args.customerEmail,
      ghlContactId: args.ghlContactId,
    });

    if (!contactId) {
      return {
        ok: false,
        contactId: null,
        hint: "GHL contact not found. Paste the contact ID from the GHL URL (…/contacts/detail/ID).",
      };
    }

    const keys = fieldKeys();
    const ref = args.refCode.trim();
    const payload = {
      [keys.caseRef]: ref,
      [keys.trackUrl]: trackCaseUrl(ref),
      [keys.portalUrl]: clientUpdatesUrl(),
      [keys.loginUrl]: clientLoginUrl(),
    };

    await updateContactCustomFields(contactId, payload);

    return { ok: true, contactId, fields: payload };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ghl] syncContactPortalFields", args.refCode, err);
    return {
      ok: false,
      contactId: null,
      error: msg,
      hint: "Check GHL custom field keys exist (tmmt_case_ref, tmmt_track_url, tmmt_portal_url, tmmt_portal_login_url) and API token has contacts.write.",
    };
  }
}
