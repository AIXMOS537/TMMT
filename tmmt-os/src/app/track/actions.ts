"use server";

import { lookupCaseByRefAndEmail } from "@/lib/client-updates/track";

export async function lookupCaseAction(formData: FormData) {
  const refCode = String(formData.get("ref_code") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!refCode || !email) {
    return { found: false as const, message: "Enter both reference number and email." };
  }

  const row = await lookupCaseByRefAndEmail(refCode, email);
  if (!row) {
    return {
      found: false as const,
      message:
        "No match found. Check the reference number and email, or sign in if you already have an account.",
    };
  }

  return {
    found: true as const,
    ref_code: row.ref_code,
    subject: row.subject,
    status_label: row.status_label,
    status_message: row.status_message,
    updated_at: row.updated_at,
  };
}
