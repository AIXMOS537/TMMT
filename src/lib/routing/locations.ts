import type { SupabaseClient } from "@supabase/supabase-js";

export type OpsLocation = {
  id: string;
  slug: string;
  name: string;
  ghl_pipeline_id: string | null;
  ghl_pipeline_name: string | null;
  clickup_list_id: string | null;
  overseas_assignee_email: string | null;
  courier_prefs: Record<string, unknown>;
};

export async function resolveOpsLocation(
  supabase: SupabaseClient,
  args: { pipeline_id?: string; pipeline_name?: string }
): Promise<OpsLocation | null> {
  if (args.pipeline_id) {
    const { data } = await supabase
      .from("ops_locations")
      .select("*")
      .eq("active", true)
      .eq("ghl_pipeline_id", args.pipeline_id)
      .maybeSingle();
    if (data) return data as OpsLocation;
  }
  if (args.pipeline_name) {
    const { data } = await supabase
      .from("ops_locations")
      .select("*")
      .eq("active", true)
      .ilike("ghl_pipeline_name", args.pipeline_name.trim())
      .maybeSingle();
    if (data) return data as OpsLocation;
  }
  return null;
}
