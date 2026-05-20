import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, moneyUSD } from "@/lib/utils";
import { formatPartnerSegmentLabel, formatSplitLabel } from "@/lib/revenue-split/resolve";
import type { PartnerClientSegment, PartnerRevenueSplitTier } from "@/lib/revenue-split/types";

export const dynamic = "force-dynamic";

export default async function InvestorDashboard() {
  const supabase = createSupabaseServerClient();
  const [{ data: account }, { data: updates }] = await Promise.all([
    supabase
      .from("investor_accounts")
      .select(
        "display_name, position_value, organization_id, organizations(name, partner_client_segment, partner_revenue_split_tier, partner_has_own_system, partner_qualified_vehicle_count)"
      )
      .maybeSingle(),
    supabase
      .from("investor_updates")
      .select("title, body, period_start, period_end, published_at, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const org = (account as { organizations?: Record<string, unknown> } | null)?.organizations;
  const splitTier = org?.partner_revenue_split_tier as PartnerRevenueSplitTier | undefined;
  const segment = org?.partner_client_segment as PartnerClientSegment | undefined;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Need a fresh answer from the team?{" "}
        <a href="/investor/contact" className="text-primary underline">
          Request an update in the portal
        </a>{" "}
        instead of calling.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>{(account as { display_name?: string })?.display_name ?? "Investor"}</CardTitle>
          <CardDescription>{(org?.name as string) ?? "—"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-semibold">
            {moneyUSD((account as { position_value?: number })?.position_value)}
          </div>
          <div className="text-xs text-muted-foreground">Current position</div>
          {splitTier && (
            <div className="text-sm">
              Revenue split: <strong>{formatSplitLabel(splitTier)}</strong>
              {segment && (
                <span className="text-muted-foreground">
                  {" "}
                  · {formatPartnerSegmentLabel(segment)}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(updates ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          )}
          {(updates ?? []).map((u, i) => (
            <div key={i} className="border-b last:border-0 py-3">
              <div className="font-medium">{u.title}</div>
              <div className="text-xs text-muted-foreground">
                {u.period_start ? `${u.period_start} – ${u.period_end}` : formatDate(u.created_at)}
              </div>
              {u.body && <p className="text-sm mt-1 whitespace-pre-wrap">{u.body}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
