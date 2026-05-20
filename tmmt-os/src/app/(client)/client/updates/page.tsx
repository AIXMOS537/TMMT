import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getClientUpdatesFeed, clientStatusMessage } from "@/lib/client-updates/queries";
import { pipelineStageLabel } from "@/lib/client-rental/queries";
import { ContactFirstBanner } from "@/components/contact-first-banner";
import { CasesLiveSync } from "@/components/cases-live-sync";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { formatDate } from "@/lib/utils";
import type { CaseStatus } from "@/lib/workflow/statuses";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";

export const dynamic = "force-dynamic";

export default async function ClientUpdatesPage() {
  await requireEntitlement("updates_hub", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Add an email to your profile to see updates.</p>;
  }

  const feed = await getClientUpdatesFeed(me.email, me.id);
  const stage = feed.rental?.pipeline?.canonical_stage;

  return (
    <div className="space-y-8">
      <CasesLiveSync />
      <PageHeader
        title="Updates"
        description="Your live status — rental, tickets, and messages from our team. Check here before calling."
      />
      <ContactFirstBanner variant="client" />

      {feed.rental && (
        <section className="surface-card p-5 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rental pipeline
          </p>
          <p className="text-lg font-semibold">{pipelineStageLabel(stage)}</p>
          {stage && (
            <p className="text-sm text-muted-foreground">
              {feed.rental.pipeline?.ghl_stage
                ? `${feed.rental.pipeline.ghl_pipeline_name} · ${feed.rental.pipeline.ghl_stage}`
                : "Synced from your booking pipeline"}
            </p>
          )}
          <Link href="/client/rental">
            <Button variant="outline" size="sm" className="mt-2">
              Rental details
            </Button>
          </Link>
        </section>
      )}

      {feed.notifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Recent notifications</h2>
          <div className="space-y-2">
            {feed.notifications.map((n) => (
              <div
                key={n.id}
                className={`surface-card p-4 ${n.read_at ? "opacity-75" : "ring-1 ring-primary/20"}`}
              >
                <p className="font-medium text-sm">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-2">{formatDate(n.created_at)}</p>
                {n.case_id && (
                  <Link
                    href={`/client/support/${n.case_id}`}
                    className="text-xs text-primary underline mt-2 inline-block"
                  >
                    View ticket
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {feed.recentTeamMessages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Messages from your team</h2>
          {feed.recentTeamMessages.map((m) => (
            <div key={m.id} className="surface-card p-4 border-l-4 border-l-primary">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {m.ref_code ? `${m.ref_code} · ` : ""}
                {formatDate(m.created_at)}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Open tickets</h2>
          <Link href="/client/support">
            <Button size="sm">New ticket</Button>
          </Link>
        </div>
        {feed.openTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground surface-muted px-4 py-6 text-center rounded-xl">
            No open tickets. Need help? Message the team — we respond here.
          </p>
        ) : (
          feed.openTickets.map((t) => (
            <Link
              key={t.id}
              href={`/client/support/${t.id}`}
              className="surface-card flex items-center justify-between gap-4 p-4 hover:shadow-md transition-shadow"
            >
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground font-mono">{t.ref_code}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {clientStatusMessage(t.status)}
                </p>
              </div>
              <CaseStatusBadge status={t.status} />
            </Link>
          ))
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/client/vehicle">
          <Button variant="outline">My vehicle</Button>
        </Link>
        <Link href="/client/billing">
          <Button variant="outline">Billing</Button>
        </Link>
      </div>
    </div>
  );
}
