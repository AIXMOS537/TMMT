"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser, homePathForTier } from "@/lib/auth-roles";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || password.length < 8) {
    return { error: "Use a real email and a password of at least 8 characters." };
  }

  const supabase = await createSSRClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || email } },
  });

  if (error) {
    console.error("[register] failed:", error.message);
    return { error: "Could not create that login. Try signing in, or use another email." };
  }

  if (!data.user) {
    return { error: "Check your email to confirm the account, then sign in." };
  }

  redirect(homePathForTier(getTierForUser(data.user)));
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createSSRClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[login] auth failed:", error.message);
    return { error: "Invalid email or password." };
  }

  redirect(homePathForTier(getTierForUser(data.user)));
}
