import Link from "next/link";
import { requirePortal } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { CLIENT_SECTIONS } from "@/lib/access/sections";
import { PortalSectionGrid } from "@/components/portal-section-grid";
import { getClientRentalHub, pipelineStageLabel } from "@/lib/client-rental/queries";
import { Button } from "@/components/ui/button";
import { CanonicalStageBadge } from "@/components/canonical-stage-badge";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const access = await requirePortal("client");
  const me = await getCurrentUser();
  const hub = me?.email ? await getClientRentalHub(me.email) : null;
  const stage = hub?.pipeline?.canonical_stage;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Client portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome{me?.full_name ? `, ${me.full_name}` : ""}. Track your rental, tickets, and billing in one place.
          </p>
        </div>

        {hub && (
          <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">My rental</p>
              <p className="mt-1 text-lg font-semibold">{pipelineStageLabel(stage)}</p>
              <p className="text-sm text-muted-foreground">
                {hub.tickets.open} open ticket{hub.tickets.open === 1 ? "" : "s"}
                {hub.alerts.length > 0 ? ` · ${hub.alerts.length} reminder${hub.alerts.length === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {stage && <CanonicalStageBadge stage={stage as CanonicalRenterStage} />}
              <Link href="/client/rental">
                <Button>Open my rental</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <PortalSectionGrid
        sections={CLIENT_SECTIONS}
        access={access}
        packageLabel={access.packageSlug}
      />
    </div>
  );
}
