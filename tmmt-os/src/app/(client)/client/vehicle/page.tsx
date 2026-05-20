import Link from "next/link";
import Image from "next/image";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getClientVehicleHub } from "@/lib/client-rental/vehicle-hub";
import { pipelineStageLabel } from "@/lib/client-rental/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CanonicalStageBadge } from "@/components/canonical-stage-badge";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { ColoredRow } from "@/components/colored-row";
import { Button } from "@/components/ui/button";
import { Car, Camera, AlertTriangle, Receipt, FolderKanban } from "lucide-react";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import type { CaseStatus } from "@/lib/workflow/statuses";
import { getCaseStatusTone } from "@/lib/ui/status-colors";
import { formatDate, moneyUSD } from "@/lib/utils";
import { LedgerLiveSync } from "@/components/ledger/ledger-live-sync";

export const dynamic = "force-dynamic";

export default async function ClientVehiclePage() {
  await requireEntitlement("vehicle_hub", "/client/rental");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Add an email to your profile to view your vehicle hub.</p>;
  }

  const hub = await getClientVehicleHub(me.email);
  const stage = hub.pipeline?.canonical_stage;
  const activeBooking = hub.bookings.find((b) => ["confirmed", "active", "quoted"].includes(b.status));

  return (
    <div className="space-y-8">
      <LedgerLiveSync />
      <PageHeader
        title="My vehicle"
        description="Everything about your rental — vehicle details, photos, damages, expenses, and tickets in one place."
      />

      <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rental status</p>
          <p className="mt-1 text-lg font-semibold">{pipelineStageLabel(stage)}</p>
          {hub.pipeline?.ghl_stage && (
            <p className="text-sm text-muted-foreground">
              {hub.pipeline.ghl_pipeline_name} · {hub.pipeline.ghl_stage}
            </p>
          )}
        </div>
        {stage && <CanonicalStageBadge stage={stage as CanonicalRenterStage} />}
      </div>

      {activeBooking?.vehicle && (
        <section className="surface-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Car className="h-5 w-5" />
            <h2 className="text-lg font-medium">Assigned vehicle</h2>
          </div>
          <p className="text-xl font-semibold">{activeBooking.vehicle.label}</p>
          <p className="text-sm text-muted-foreground">
            {[activeBooking.vehicle.year, activeBooking.vehicle.make, activeBooking.vehicle.model]
              .filter(Boolean)
              .join(" ")}
            {activeBooking.vehicle.plate ? ` · Plate ${activeBooking.vehicle.plate}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Booking {activeBooking.ref_code} · {activeBooking.status}
            {activeBooking.starts_at ? ` · from ${formatDate(activeBooking.starts_at)}` : ""}
          </p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tickets" value={hub.tickets.open} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="Damage reports" value={hub.damages.length} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Photos" value={hub.media.length} icon={<Camera className="h-5 w-5" />} />
        <StatCard
          label="Expenses (pending)"
          value={moneyUSD(hub.ledger.deductionCents / 100)}
          icon={<Receipt className="h-5 w-5" />}
        />
      </div>

      {hub.media.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Photos & documents</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {hub.media.map((m) => (
              <div key={m.id} className="surface-card overflow-hidden">
                {m.signed_url && m.media_type === "photo" ? (
                  <div className="relative aspect-[4/3] bg-muted">
                    <Image
                      src={m.signed_url}
                      alt={m.caption ?? m.file_name ?? "Vehicle photo"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center bg-muted text-xs text-muted-foreground p-2 text-center">
                    {m.file_name ?? "Document"}
                  </div>
                )}
                <p className="p-2 text-xs text-muted-foreground truncate">{m.caption ?? m.file_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {hub.damages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Damage reports</h2>
          <div className="space-y-2">
            {hub.damages.map((d) => (
              <div key={d.id} className="surface-card px-4 py-3">
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {d.severity} · {d.status.replace(/_/g, " ")}
                  {d.vehicle_label ? ` · ${d.vehicle_label}` : ""} · {formatDate(d.created_at)}
                </p>
                {d.description && <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Expenses & billing</h2>
        {hub.ledger.entries.length === 0 ? (
          <p className="surface-muted px-4 py-6 text-center text-sm text-muted-foreground">No billing lines yet.</p>
        ) : (
          <div className="space-y-2">
            {hub.ledger.entries.slice(0, 8).map((e) => (
              <div key={e.id} className="surface-card flex justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {e.entry_type.replace(/_/g, " ")} · {e.status}
                  </p>
                </div>
                <p className="font-medium tabular-nums">{moneyUSD(e.amount_cents / 100)}</p>
              </div>
            ))}
          </div>
        )}
        <Link href="/client/billing">
          <Button variant="outline" size="sm">
            Full billing
          </Button>
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Tickets</h2>
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
                <CaseStatusBadge status={t.status as CaseStatus} />
              </div>
            </ColoredRow>
          ))
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/client/rental">
          <Button variant="outline">Rental overview</Button>
        </Link>
        <Link href="/client/maintenance">
          <Button>Request maintenance</Button>
        </Link>
      </div>
    </div>
  );
}
