import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function getOrganizationAccessBlock(): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me?.organization_id) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("suspended_at, name")
    .eq("id", me.organization_id)
    .maybeSingle();

  if (error?.message?.includes("suspended_at")) return null;
  if (data?.suspended_at) {
    return `Access paused for ${data.name ?? "your organization"}. Contact All In One Management Solutions.`;
  }
  return null;
}
