import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrgLicenseRow, type OrgLicense } from "./org-license";

export async function loadOrgLicenseForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<OrgLicense | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  const orgId = profile?.organization_id as string | undefined;
  if (!orgId) return null;

  const { data: lic } = await supabase
    .from("organization_licenses")
    .select("organization_id, license_tier, modules, max_ventures")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!lic) return null;
  return parseOrgLicenseRow(lic);
}
