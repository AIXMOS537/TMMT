"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { REQUEST_TYPES } from "@/lib/workflow/statuses";
import { processUnifiedIntake } from "@/lib/intake/unified";

const IntakeSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_phone: z.string().max(40).optional().or(z.literal("")),
  request_type: z.enum(REQUEST_TYPES).default("other"),
  subject: z.string().min(1).max(200),
  details: z.string().max(5000).optional().or(z.literal("")),
});

export async function submitIntakeAction(formData: FormData) {
  const parsed = IntakeSchema.safeParse({
    customer_name: formData.get("customer_name"),
    customer_email: formData.get("customer_email") || undefined,
    customer_phone: formData.get("customer_phone") || undefined,
    request_type: (formData.get("request_type") as string) || "other",
    subject: formData.get("subject"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) {
    redirect("/intake?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }
  const data = parsed.data;

  try {
    const result = await processUnifiedIntake({
      customer_name: data.customer_name,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      request_type: data.request_type,
      subject: data.subject,
      details: data.details || null,
      source: "web",
      tags: [data.request_type],
      payload: { from: "intake-form" },
    });
    redirect(`/intake/thanks?ref=${encodeURIComponent(result.refCode)}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "insert failed";
    redirect("/intake?error=" + encodeURIComponent(message));
  }
}
