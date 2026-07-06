"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// Record an operator's progress on a training module.
// In this schema `profile_id` == the Supabase auth uid (profiles.id = auth.uid()),
// and RLS on operator_training_progress allows a user to write their own rows.
export async function setModuleProgress(
  moduleId: string,
  percentComplete: number
): Promise<{ success: true } | { error: string }> {
  const pct = Math.max(0, Math.min(100, Math.round(percentComplete)));
  const supabase = await createSSRClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const profileId = user.id;
  const now = new Date().toISOString();

  // No assumed unique constraint — check then update/insert.
  const { data: existing } = await supabase
    .from("operator_training_progress")
    .select("id")
    .eq("profile_id", profileId)
    .eq("module_id", moduleId)
    .maybeSingle();

  const row = {
    profile_id: profileId,
    module_id: moduleId,
    percent_complete: pct,
    completed_at: pct >= 100 ? now : null,
    updated_at: now,
  };

  const { error } = existing?.id
    ? await supabase
        .from("operator_training_progress")
        .update(row)
        .eq("id", existing.id as string)
    : await supabase.from("operator_training_progress").insert(row);

  if (error) return { error: error.message };

  // v3: auto-certify at 100% modules — no human lead required.
  if (process.env.V3_AUTO_CERTIFY_OPERATORS === "true" && pct >= 100) {
    const { count } = await supabase
      .from("operator_training_modules")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    const { count: doneCount } = await supabase
      .from("operator_training_progress")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("percent_complete", 100);
    if (count && doneCount && doneCount >= count) {
      await supabase
        .from("profiles")
        .update({
          is_certified: true,
          unlock_status: "CERTIFIED",
          updated_at: now,
        })
        .eq("id", profileId);
    }
  }

  revalidatePath("/operator/training");
  revalidatePath(`/operator/training/${moduleId}`);
  return { success: true };
}

export async function markModuleComplete(moduleId: string) {
  return setModuleProgress(moduleId, 100);
}
