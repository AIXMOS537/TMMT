"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser, homePathForTier } from "@/lib/auth-roles";

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
