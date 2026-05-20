import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CooBriefing, CooBriefingKind } from "./types";

export async function getCooBriefing(
  date: string,
  kind: CooBriefingKind
): Promise<CooBriefing | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("coo_briefings")
    .select("*")
    .eq("briefing_date", date)
    .eq("kind", kind)
    .maybeSingle();

  if (error?.message.includes("does not exist")) return null;
  if (error) throw error;
  return data as CooBriefing | null;
}

export async function listRecentCooBriefings(limit = 14): Promise<CooBriefing[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("coo_briefings")
    .select("*")
    .order("briefing_date", { ascending: false })
    .limit(limit);

  if (error?.message.includes("does not exist")) return [];
  if (error) throw error;
  return (data ?? []) as CooBriefing[];
}
