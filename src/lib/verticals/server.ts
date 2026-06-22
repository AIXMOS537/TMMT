import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultVerticalBrand,
  getVerticalByOrgName,
  type VerticalConfig,
} from "./registry";

/**
 * Resolve the vertical brand for the signed-in user via org_roles → organizations.name.
 * Fails closed to TMMT Rentals branding when unauthenticated or unmapped.
 */
export async function getVerticalBrandForUser(
  supabase: SupabaseClient
): Promise<VerticalConfig> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return defaultVerticalBrand();

  const { data: roleRow } = await supabase
    .from("org_roles")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const orgName =
    (roleRow as { organizations?: { name?: string } } | null)?.organizations?.name ??
    null;

  if (orgName) {
    const vertical = getVerticalByOrgName(orgName);
    if (vertical) return vertical;
  }

  // Fallback: profile.organization_id join if org_roles empty
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, organizations(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profileOrgName =
    (profile as { organizations?: { name?: string } } | null)?.organizations?.name ?? null;
  if (profileOrgName) {
    const vertical = getVerticalByOrgName(profileOrgName);
    if (vertical) return vertical;
  }

  return defaultVerticalBrand();
}
