import "server-only";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { siteFromHost, type FormSite } from "@/lib/forms/site";

export type PersonLinkInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  formSlug: string;
  destinationTable?: string | null;
  destinationId?: string | null;
  payload?: Record<string, unknown>;
  site?: FormSite;
  tenantSlug?: string;
  landingUrl?: string | null;
};

function digits(phone: string | null | undefined): string | null {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 7) return null;
  return d;
}

function e164(phoneDigits: string | null): string | null {
  if (!phoneDigits) return null;
  if (phoneDigits.length === 10) return `+1${phoneDigits}`;
  if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) return `+${phoneDigits}`;
  if (phoneDigits.startsWith("1") && phoneDigits.length > 11) return `+${phoneDigits}`;
  return `+${phoneDigits}`;
}

function cleanEmail(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  return e;
}

async function requestContext(explicit?: { site?: FormSite; tenantSlug?: string; landingUrl?: string | null }) {
  const h = await headers();
  const site = explicit?.site ?? siteFromHost(h.get("host"), h.get("x-forwarded-host"));
  const tenantSlug =
    explicit?.tenantSlug ??
    h.get("x-aixmos-tenant") ??
    (site === "aixmos" ? "aixmos" : "tmmt_property");
  const landingUrl = explicit?.landingUrl ?? h.get("referer") ?? null;
  return { site, tenantSlug, landingUrl };
}

/**
 * One person, many forms. Match email first, then phone digits.
 * Never throws to the form — callers should catch.
 */
export async function linkFormToPerson(input: PersonLinkInput): Promise<{ personId: string | null; submissionId: string | null }> {
  const email = cleanEmail(input.email);
  const phoneDigits = digits(input.phone);
  const phoneE164 = e164(phoneDigits);
  const name = String(input.fullName ?? "").trim() || null;
  if (!email && !phoneDigits && !name) {
    return { personId: null, submissionId: null };
  }

  const ctx = await requestContext(input);
  const db = createServiceRoleClient();

  let personId: string | null = null;

  if (email) {
    const { data } = await db
      .from("people")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    personId = data?.id ?? null;
  }
  if (!personId && phoneDigits) {
    const { data } = await db
      .from("people")
      .select("id")
      .eq("phone_digits", phoneDigits)
      .maybeSingle();
    personId = data?.id ?? null;
  }

  if (!personId) {
    const { data, error } = await db
      .from("people")
      .insert({
        full_name: name,
        email,
        phone_digits: phoneDigits,
        phone_e164: phoneE164,
        source_first: input.formSlug,
        source_last: input.formSlug,
        tenant_slug: ctx.tenantSlug,
        metadata: { first_site: ctx.site },
      })
      .select("id")
      .single();
    if (error || !data) {
      console.warn("[people] insert failed:", error?.message);
      return { personId: null, submissionId: null };
    }
    personId = data.id;
  } else {
    await db
      .from("people")
      .update({
        full_name: name || undefined,
        email: email || undefined,
        phone_digits: phoneDigits || undefined,
        phone_e164: phoneE164 || undefined,
        source_last: input.formSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId);
  }

  const { data: sub, error: subErr } = await db
    .from("form_submissions")
    .insert({
      person_id: personId,
      form_slug: input.formSlug,
      tenant_slug: ctx.tenantSlug,
      site: ctx.site,
      destination_table: input.destinationTable ?? null,
      destination_id: input.destinationId ?? null,
      payload: input.payload ?? {},
      landing_url: ctx.landingUrl,
    })
    .select("id")
    .single();

  if (subErr) {
    console.warn("[form_submissions] insert failed:", subErr.message);
    return { personId, submissionId: null };
  }

  return { personId, submissionId: sub?.id ?? null };
}
