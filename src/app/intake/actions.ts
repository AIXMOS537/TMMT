"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { REQUEST_TYPES } from "@/lib/workflow/statuses";
import { processUnifiedIntake } from "@/lib/intake/unified";
import { getIntakeBusiness, isAllowedRequestType } from "@/lib/intake/businesses";
import { isRateLimitedDurable, type RateLimitBackend } from "@/lib/rate-limit-durable";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Ported from TMMT OS with three corrections.
 *
 * 1. zod 4. That tree is on zod 3, where `z.string().email()` is the idiom;
 *    here it is deprecated in favour of the top-level `z.email()`.
 *
 * 2. Rate limiting. TMMT OS never had any on this path, and it did not need
 *    it - the app was never deployed. Here /intake is public and
 *    processUnifiedIntake writes with the service-role client, which bypasses
 *    RLS, so without a limit anyone could script cases into production. Same
 *    guard, same key shape and same backend as the public /api/forms/submit
 *    route already uses.
 *
 * 3. The success redirect was inside the try block. `redirect()` works by
 *    throwing NEXT_REDIRECT, so the catch below swallowed it and re-redirected
 *    to the error page — every successful submission would have landed on
 *    "?error=NEXT_REDIRECT" with the case already written. The redirect now
 *    happens after the try/catch, which is what Next's own docs require.
 */
const IntakeSchema = z.object({
  business_slug: z.string().min(1),
  customer_name: z.string().min(1).max(200),
  customer_email: z.email().optional().or(z.literal("")),
  customer_phone: z.string().max(40).optional().or(z.literal("")),
  request_type: z.enum(REQUEST_TYPES).default("other"),
  subject: z.string().min(1).max(200),
  details: z.string().max(5000).optional().or(z.literal("")),
});

export async function submitIntakeAction(formData: FormData) {
  const businessSlug = String(formData.get("business_slug") ?? "");
  const business = getIntakeBusiness(businessSlug);
  const intakePath = business ? `/intake/${business.slug}` : "/intake";

  const ip =
    ((await headers()).get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  let limiter: RateLimitBackend | null = null;
  try {
    limiter = createServiceRoleClient();
  } catch {
    limiter = null;
  }
  if (await isRateLimitedDurable(`intake:${ip}`, {}, limiter)) {
    redirect(
      `${intakePath}?error=` +
        encodeURIComponent("Too many submissions. Please try again later.")
    );
  }

  const parsed = IntakeSchema.safeParse({
    business_slug: businessSlug,
    customer_name: formData.get("customer_name"),
    customer_email: formData.get("customer_email") || undefined,
    customer_phone: formData.get("customer_phone") || undefined,
    request_type: (formData.get("request_type") as string) || "other",
    subject: formData.get("subject"),
    details: formData.get("details") || undefined,
  });

  if (!parsed.success) {
    redirect(`${intakePath}?error=` + encodeURIComponent(parsed.error.issues[0].message));
  }

  const data = parsed.data;
  const biz = getIntakeBusiness(data.business_slug);
  if (!biz) {
    redirect("/intake?error=" + encodeURIComponent("Unknown business."));
  }
  if (!isAllowedRequestType(biz, data.request_type)) {
    redirect(
      `${intakePath}?error=` +
        encodeURIComponent("That request type is not available for this business.")
    );
  }

  let refCode: string;
  try {
    const result = await processUnifiedIntake({
      customer_name: data.customer_name,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      request_type: data.request_type,
      subject: data.subject,
      details: data.details || null,
      source: "web",
      business_line: biz.business_line,
      tags: [data.request_type, biz.slug],
      payload: { from: "intake-form", business_slug: biz.slug, business_line: biz.business_line },
    });
    refCode = result.refCode;
  } catch (e) {
    const message = e instanceof Error ? e.message : "insert failed";
    redirect(`${intakePath}?error=` + encodeURIComponent(message));
  }

  redirect(
    `/intake/thanks?ref=${encodeURIComponent(refCode)}&business=${encodeURIComponent(biz.slug)}`
  );
}
