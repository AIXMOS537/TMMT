"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isGhlConfigured } from "@/lib/ghl/client";
import { syncContactPortalFields } from "@/lib/ghl/sync-contact-portal-fields";

export type LinkGhlContactResult = {
  ok: boolean;
  message: string;
  contactId?: string;
};

/** Attach a real GHL contact to a case so portal sync + workflows can run. */
export async function linkGhlContactAction(formData: FormData): Promise<LinkGhlContactResult> {
  await requireRole(["admin", "internal_team"]);

  const caseId = String(formData.get("case_id"));
  const customerEmail = String(formData.get("customer_email")).trim().toLowerCase();
  const ghlContactId = String(formData.get("ghl_contact_id")).trim();

  if (!caseId || !customerEmail) {
    return { ok: false, message: "Customer email is required." };
  }

  if (!isGhlConfigured()) {
    return {
      ok: false,
      message: "GHL is not configured on production — add GHL_API_KEY and GHL_LOCATION_ID in Vercel, then redeploy.",
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("cases")
    .select("metadata, ref_code")
    .eq("id", caseId)
    .maybeSingle();

  if (!existing?.ref_code) {
    return { ok: false, message: "Case not found." };
  }

  const metadata = {
    ...((existing.metadata as Record<string, unknown>) ?? {}),
    ghl: {
      ...(((existing.metadata as { ghl?: Record<string, unknown> })?.ghl) ?? {}),
      ...(ghlContactId ? { contact_id: ghlContactId } : {}),
    },
  };

  const { error } = await supabase
    .from("cases")
    .update({
      customer_email: customerEmail,
      metadata,
    })
    .eq("id", caseId);

  if (error) {
    return { ok: false, message: error.message };
  }

  const sync = await syncContactPortalFields({
    refCode: existing.ref_code,
    caseId,
    customerEmail,
    ghlContactId: ghlContactId || null,
  });

  revalidatePath(`/internal/cases/${caseId}`);

  if (!sync.ok) {
    return {
      ok: false,
      message: [sync.hint, sync.error].filter(Boolean).join(" — "),
    };
  }

  return {
    ok: true,
    contactId: sync.contactId ?? undefined,
    message: `GHL updated for ${existing.ref_code}. Open the contact in GHL and confirm custom fields, then post an update to test the workflow tag.`,
  };
}
