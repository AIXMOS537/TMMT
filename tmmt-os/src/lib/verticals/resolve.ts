import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { OrgVertical } from "./types";

/** Resolve operating vertical for the signed-in user's organization. */
export async function getOrganizationVertical(
  override?: OrgVertical | null
): Promise<OrgVertical> {
  const allowed: OrgVertical[] = ["rental", "dealer", "property", "service_arbitrage"];
  if (override && allowed.includes(override)) return override;

  const fromEnv = process.env.ORG_VERTICAL?.trim().toLowerCase();
  if (fromEnv && allowed.includes(fromEnv as OrgVertical)) return fromEnv as OrgVertical;

  const me = await getCurrentUser();
  if (!me?.organization_id) return "rental";

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("vertical, partner_app_slug")
    .eq("id", me.organization_id)
    .maybeSingle();

  if (error?.message?.includes("vertical")) return "rental";

  const slug = data?.partner_app_slug as string | undefined;
  if (slug === "tmmt_property") return "property";
  if (slug === "service_arbitrage") return "service_arbitrage";

  const v = data?.vertical as string | undefined;
  if (v === "dealer") return "dealer";
  if (v === "property") return "property";
  if (v === "service_arbitrage") return "service_arbitrage";
  return "rental";
}

export async function getOrganizationPartnerAppSlug(): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me?.organization_id) return null;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("partner_app_slug")
    .eq("id", me.organization_id)
    .maybeSingle();
  return (data?.partner_app_slug as string | null) ?? null;
}
