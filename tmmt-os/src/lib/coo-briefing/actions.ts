"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const dailySchema = z.object({
  briefing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pipeline_health: z.string().max(4000).optional(),
  escalations: z.string().max(4000).optional(),
  director_sync: z.string().max(4000).optional(),
  blockers: z.string().max(4000).optional(),
  loom_url: z.string().url().optional().or(z.literal("")),
});

const weeklySchema = z.object({
  briefing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekly_summary: z.string().min(10).max(8000),
  loom_url: z.string().url().optional().or(z.literal("")),
});

export async function saveDailyCooBriefingAction(formData: FormData) {
  await requireRole(["admin", "internal_team"]);
  const me = await getCurrentUser();
  const parsed = dailySchema.parse({
    briefing_date: formData.get("briefing_date"),
    pipeline_health: formData.get("pipeline_health") || undefined,
    escalations: formData.get("escalations") || undefined,
    director_sync: formData.get("director_sync") || undefined,
    blockers: formData.get("blockers") || undefined,
    loom_url: formData.get("loom_url") || "",
  });

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("coo_briefings").upsert(
    {
      briefing_date: parsed.briefing_date,
      kind: "daily",
      pipeline_health: parsed.pipeline_health ?? null,
      escalations: parsed.escalations ?? null,
      director_sync: parsed.director_sync ?? null,
      blockers: parsed.blockers ?? null,
      loom_url: parsed.loom_url || null,
      submitted_by: me?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "briefing_date,kind" }
  );
  if (error) throw error;
  revalidatePath("/internal/briefing");
}

export async function saveWeeklyCooBriefingAction(formData: FormData) {
  await requireRole(["admin", "internal_team"]);
  const me = await getCurrentUser();
  const parsed = weeklySchema.parse({
    briefing_date: formData.get("briefing_date"),
    weekly_summary: formData.get("weekly_summary"),
    loom_url: formData.get("loom_url") || "",
  });

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("coo_briefings").upsert(
    {
      briefing_date: parsed.briefing_date,
      kind: "weekly",
      weekly_summary: parsed.weekly_summary,
      loom_url: parsed.loom_url || null,
      submitted_by: me?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "briefing_date,kind" }
  );
  if (error) throw error;
  revalidatePath("/internal/briefing");
}
