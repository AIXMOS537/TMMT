"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDealerDataBridgeReady } from "@/lib/dealer/command-center";

type Step = "not_started" | "org" | "inventory" | "first_deal" | "complete";

export async function getOnboardingState() {
  const me = await requireRole(["admin", "internal_team"]);
  if (!me.organization_id) {
    return { step: "org" as Step, orgName: null, bridgeReady: isDealerDataBridgeReady() };
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("name, onboarding_step, onboarding_completed_at, vertical")
    .eq("id", me.organization_id)
    .maybeSingle();

  return {
    step: (data?.onboarding_step as Step) ?? "not_started",
    orgName: data?.name ?? null,
    vertical: data?.vertical ?? "dealer",
    completed: Boolean(data?.onboarding_completed_at),
    bridgeReady: isDealerDataBridgeReady(),
  };
}

export async function saveOnboardingOrgName(formData: FormData) {
  const me = await requireRole(["admin", "internal_team"]);
  if (!me.organization_id) throw new Error("Link your profile to an organization first.");

  const name = formData.get("name")?.toString()?.trim();
  if (!name) throw new Error("Dealership name is required.");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name, vertical: "dealer", onboarding_step: "inventory" })
    .eq("id", me.organization_id);

  if (error) throw new Error(error.message);
  revalidatePath("/internal/dealer/onboarding");
}

export async function advanceOnboardingStep(step: Step) {
  const me = await requireRole(["admin", "internal_team"]);
  if (!me.organization_id) throw new Error("No organization on profile.");

  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = { onboarding_step: step };
  if (step === "complete") {
    patch.onboarding_completed_at = new Date().toISOString();
  }

  const { error } = await supabase.from("organizations").update(patch).eq("id", me.organization_id);
  if (error) throw new Error(error.message);
  revalidatePath("/internal/dealer/onboarding");
  revalidatePath("/internal/dealer");
}
