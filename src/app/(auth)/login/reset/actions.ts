"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser, homePathForTier } from "@/lib/auth-roles";

/**
 * Set a new password using the recovery session established by the email link
 * (exchanged for cookies in /api/auth/callback). Requires an authenticated
 * session — if it's missing or expired, the user is sent back to /login/forgot.
 */
export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[reset] updateUser failed:", error.message);
    return { error: "Could not update password. Please try again." };
  }

  redirect(homePathForTier(getTierForUser(user)));
}
