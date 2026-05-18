import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getClientRentalHub, pipelineStageLabel } from "@/lib/client-rental/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ClientAlertCard } from "@/components/client-alert-card";
import { CanonicalStageBadge } from "@/components/canonical-stage-badge";
import { ColoredRow } from "@/components/colored-row";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, Wrench, Wallet, Bell } from "lucide-react";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import type { CaseStatus } from "@/lib/workflow/statuses";
import { getCaseStatusTone } from "@/lib/ui/status-colors";
import { moneyUSD } from "@/lib/utils";
import { LedgerLiveSync } from "@/components/ledger/ledger-live-sync";

export const dynamic = "force-dynamic";

export default async function ClientRentalPage() {
  await requireEntitlement("rental_hub", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Add an email to your profile to view your rental.</p>;
  }

  const hub = await getClientRentalHub(me.email);
  const stage = hub.pipeline?.canonical_stage;

  return (
    <div className="space-y-8">
      <LedgerLiveSync />
      <PageHeader
        title="My rental"
        description="Your active rental period — tickets, reminders from the booking pipeline, and money owed or returning to you."
      />

      <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rental status</p>
          <p className="mt-1 text-lg font-semibold">{pipelineStageLabel(stage)}</p>
          {hub.pipeline?.ghl_stage && (
            <p className="text-sm text-muted-foreground">{hub.pipeline.ghl_pipeline_name} · {hub.pipeline.ghl_stage}</p>
          )}
        </div>
        {stage && <CanonicalStageBadge stage={stage as CanonicalRenterStage} />}
        {!stage && (
          <p className="text-sm text-muted-foreground max-w-xs">
            When your booking is in GoHighLevel, verified stages appear here with reminders.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tickets" value={hub.tickets.open} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="Maintenance open" value={hub.maintenance.open} icon={<Wrench className="h-5 w-5" />} />
        <StatCard
          label="Deposit / refund pending"
          value={moneyUSD((hub.ledger.pendingDepositCents + hub.ledger.pendingRefundCents) / 100)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard label="Reminders" value={hub.alerts.length} icon={<Bell className="h-5 w-5" />} />
      </div>

      {hub.alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Reminders</h2>
          <p className="text-sm text-muted-foreground">
            These update when your rental moves through the booking pipeline in GoHighLevel.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {hub.alerts.map((a) => (
              <ClientAlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Open tickets</h2>
          <Link href="/client/support">
            <Button variant="outline" size="sm">
              All tickets
            </Button>
          </Link>
        </div>
        {hub.tickets.recent.length === 0 ? (
          <p className="surface-muted px-4 py-6 text-center text-sm text-muted-foreground">No open tickets.</p>
        ) : (
          hub.tickets.recent.map((t) => (
            <ColoredRow key={t.id} href={`/client/support/${t.id}`} tone={getCaseStatusTone(t.status)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.ref_code}</p>
                </div>
                <CaseStatusBadge status={t.status} />
              </div>
            </ColoredRow>
          ))
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/client/maintenance">
          <Button>Request maintenance</Button>
        </Link>
        <Link href="/client/billing">
          <Button variant="outline">
            Billing & deposits
          </Button>
        </Link>
        <Link href="/client/support">
          <Button variant="outline">
            New support ticket
          </Button>
        </Link>
      </div>
    </div>
  );
}
