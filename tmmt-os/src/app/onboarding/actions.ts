"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function saveOnboardingProfile(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      phone: phone || null,
    })
    .eq("id", me.id);

  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: me.id,
    entity: "profile",
    entity_id: me.id,
    action: "onboarding_completed",
    data: {},
  });

  revalidatePath("/onboarding");
}
