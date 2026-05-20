"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { syncMarketingKpiWeekFromGhl } from "./ghl-sync";

const kpiSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  followers: z.coerce.number().int().min(0),
  reel_views: z.coerce.number().int().min(0),
  story_views: z.coerce.number().int().min(0),
  dm_started: z.coerce.number().int().min(0),
  calls_booked: z.coerce.number().int().min(0),
  new_subscribers: z.coerce.number().int().min(0),
  email_list_growth: z.coerce.number().int().min(0),
  notes: z.string().max(2000).optional(),
});

export async function saveMarketingKpiWeekAction(formData: FormData) {
  await requireRole(["admin", "internal_team"]);
  const me = await getCurrentUser();
  const parsed = kpiSchema.parse({
    week_start: formData.get("week_start"),
    followers: formData.get("followers"),
    reel_views: formData.get("reel_views"),
    story_views: formData.get("story_views"),
    dm_started: formData.get("dm_started"),
    calls_booked: formData.get("calls_booked"),
    new_subscribers: formData.get("new_subscribers"),
    email_list_growth: formData.get("email_list_growth"),
    notes: formData.get("notes") || undefined,
  });

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("marketing_kpi_weeks").upsert(
    {
      ...parsed,
      notes: parsed.notes ?? null,
      submitted_by: me?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "week_start" }
  );
  if (error) throw error;

  revalidatePath("/team/performance");
}

export async function syncMarketingKpiFromGhlAction(weekStart: string) {
  await requireRole(["admin", "internal_team"]);
  await syncMarketingKpiWeekFromGhl(weekStart);
  revalidatePath("/team/performance");
}
