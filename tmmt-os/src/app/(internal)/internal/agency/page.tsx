import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { moneyUSD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ClientOrgActions } from "@/components/agency/client-org-actions";
import { ProvisionClientForm } from "@/components/agency/provision-client-form";
import { ConnectStripeButton } from "@/components/agency/connect-stripe-button";
import { PartnerSplitEditor } from "@/components/agency/partner-split-editor";
import { formatSplitLabel } from "@/lib/revenue-split/resolve";
import type { PartnerClientSegment, PartnerRevenueSplitTier } from "@/lib/revenue-split/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const TIER_MRR: Record<string, number> = {
  starter: 299,
  growth: 499,
  pro: 799,
};

export default async function AgencyDashboardPage({
  searchParams,
}: {
  searchParams: { connect?: string };
}) {
  await requireRole(["admin"]);

  const supabase = createSupabaseServerClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select(
      "id, name, vertical, plan_tier, billing_status, parent_agency_id, stripe_subscription_id, suspended_at, stripe_connect_account_id, connect_charges_enabled, onboarding_step, created_at, partner_client_segment, partner_revenue_split_tier, partner_has_own_system, partner_qualified_vehicle_count"
    )
    .order("name");

  const rows = orgs ?? [];
  const agencyRoot = rows.find((o) => !o.parent_agency_id) ?? rows[0];
  const clients = rows.filter((o) => o.parent_agency_id);

  const mrr = clients.reduce((sum, o) => {
    if (o.suspended_at) return sum;
    if (o.billing_status !== "active" && o.billing_status !== "trialing") return sum;
    return sum + (TIER_MRR[(o.plan_tier as string) ?? "starter"] ?? 0);
  }, 0);

  const connectBanner =
    searchParams.connect === "return"
      ? "Stripe Connect onboarding submitted — status updates when Stripe verifies the account."
      : searchParams.connect === "refresh"
        ? "Resume Connect onboarding in Stripe."
        : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="All In One — Agency"
        description="Provision clients, set partner splits (relationship/retail 90–70% with own system; passive/managed 60–50% hands-off), and connect Stripe."
      />

      {connectBanner && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          {connectBanner}
        </p>
      )}

      {agencyRoot && (
        <section className="surface-card space-y-4 p-6">
          <h2 className="font-semibold">Agency payouts (Stripe Connect)</h2>
          <p className="text-sm text-muted-foreground">
            Connect the platform account for <strong>{agencyRoot.name}</strong>. Client
            subscriptions can split revenue to this Connect account when enabled.
          </p>
          <ConnectStripeButton
            agencyOrgId={agencyRoot.id}
            connected={Boolean(agencyRoot.connect_charges_enabled)}
          />
          {agencyRoot.stripe_connect_account_id && (
            <p className="text-xs text-muted-foreground">
              Account: {agencyRoot.stripe_connect_account_id}
              {agencyRoot.connect_charges_enabled ? " · charges enabled" : " · pending verification"}
            </p>
          )}
        </section>
      )}

      <section className="surface-card space-y-4 p-6">
        <h2 className="font-semibold">Add pilot client</h2>
        <ProvisionClientForm parentAgencyId={agencyRoot?.id} />
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Client orgs</p>
          <p className="text-2xl font-semibold">{clients.length}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Est. MRR</p>
          <p className="text-2xl font-semibold">{moneyUSD(mrr)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Suspended</p>
          <p className="text-2xl font-semibold">{clients.filter((c) => c.suspended_at).length}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Vertical</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Onboarding</TableHead>
            <TableHead>Revenue split</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No organizations — add one in Supabase or use Add pilot client.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((o) => (
              <TableRow key={o.id} className={o.suspended_at ? "opacity-60" : undefined}>
                <TableCell className="font-medium">
                  {o.name}
                  {o.parent_agency_id ? "" : " (agency)"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{o.vertical ?? "rental"}</Badge>
                </TableCell>
                <TableCell>{o.plan_tier ?? "starter"}</TableCell>
                <TableCell>
                  {o.suspended_at ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : (
                    <Badge variant={o.billing_status === "active" ? "default" : "secondary"}>
                      {o.billing_status ?? "trialing"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {o.onboarding_step ?? "—"}
                </TableCell>
                <TableCell>
                  {o.parent_agency_id ? (
                    <PartnerSplitEditor
                      orgId={o.id}
                      orgName={o.name}
                      segment={(o.partner_client_segment as PartnerClientSegment) ?? null}
                      tier={(o.partner_revenue_split_tier as PartnerRevenueSplitTier) ?? null}
                      hasOwnSystem={Boolean(o.partner_has_own_system)}
                      vehicleCount={Number(o.partner_qualified_vehicle_count) || 0}
                    />
                  ) : o.partner_revenue_split_tier ? (
                    <span className="text-muted-foreground">
                      {formatSplitLabel(o.partner_revenue_split_tier as PartnerRevenueSplitTier)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {o.parent_agency_id ? (
                    <ClientOrgActions orgId={o.id} suspended={Boolean(o.suspended_at)} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
