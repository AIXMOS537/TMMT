"use server";

import { headers } from "next/headers";
import { createSSRClient } from "@/lib/supabase-server";

/**
 * Send a password-reset email. Always reports success to the caller so the
 * endpoint can't be used to enumerate which emails have accounts.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return { error: "Please enter your email." };

  // Build an absolute redirect target from the incoming request so the email
  // link points back at whichever host the user is actually on.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const redirectTo = `${proto}://${host}/api/auth/callback?next=/login/reset`;

  const supabase = await createSSRClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    // Log server-side but never reveal account existence to the client.
    console.error("[forgot] resetPasswordForEmail failed:", error.message);
  }

  return { success: true };
}
