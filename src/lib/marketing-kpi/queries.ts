import { createServiceRoleClient } from "@/lib/supabase-service";
import type { MarketingKpiWeek } from "./types";

export async function listMarketingKpiWeeks(limit = 12): Promise<MarketingKpiWeek[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_kpi_weeks")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error?.message.includes("does not exist")) return [];
  if (error) throw error;
  return (data ?? []) as MarketingKpiWeek[];
}

export function weekStartMonday(d = new Date()): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}
