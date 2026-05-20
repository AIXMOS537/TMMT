import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAgencyConnectAccountIdForClient(
  clientOrgId: string
): Promise<{ accountId: string | null; sharePct: number }> {
  const supabase = createSupabaseServerClient();
  const { data: client } = await supabase
    .from("organizations")
    .select("parent_agency_id")
    .eq("id", clientOrgId)
    .maybeSingle();

  if (!client?.parent_agency_id) return { accountId: null, sharePct: 0 };

  const { data: agency } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id, connect_charges_enabled, agency_revenue_share_pct")
    .eq("id", client.parent_agency_id)
    .maybeSingle();

  if (!agency?.connect_charges_enabled || !agency.stripe_connect_account_id) {
    return { accountId: null, sharePct: 0 };
  }

  return {
    accountId: agency.stripe_connect_account_id as string,
    sharePct: Number(agency.agency_revenue_share_pct) || 80,
  };
}
