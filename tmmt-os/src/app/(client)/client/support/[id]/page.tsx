import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEntitlement } from "@/lib/auth-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getCaseTimelineForClient, clientStatusMessage } from "@/lib/client-updates/queries";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { RequestTypeBadge } from "@/components/request-type-badge";
import { CasesLiveSync } from "@/components/cases-live-sync";
import { formatDate } from "@/lib/utils";
import type { CaseStatus, RequestType } from "@/lib/workflow/statuses";

export const dynamic = "force-dynamic";

export default async function ClientTicketDetailPage({ params }: { params: { id: string } }) {
  await requireEntitlement("support_tickets", "/client/dashboard");
  const me = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: c } = await supabase
    .from("cases")
    .select("id, ref_code, subject, description, status, request_type, created_at, updated_at, closed_at, customer_email")
    .eq("id", params.id)
    .maybeSingle();

  if (!c) notFound();
  if (me?.email && c.customer_email?.toLowerCase() !== me.email.toLowerCase()) notFound();

  const timeline = me?.email ? await getCaseTimelineForClient(c.id, me.email) : [];
  const status = c.status as CaseStatus;

  return (
    <div className="space-y-6 max-w-2xl">
      <CasesLiveSync />
      <Link href="/client/support" className="text-sm text-muted-foreground hover:underline">
        ← Tickets
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-xs text-muted-foreground">{c.ref_code}</p>
        <h1 className="text-2xl font-semibold">{c.subject}</h1>
        <div className="flex flex-wrap gap-2">
          <CaseStatusBadge status={status} />
          <RequestTypeBadge type={c.request_type as RequestType} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{clientStatusMessage(status)}</p>
      </header>

      {timeline.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Timeline</h2>
          <ol className="space-y-0 border-l-2 border-primary/30 ml-2 pl-6">
            {timeline.map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <p className="text-sm font-medium">{ev.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{ev.detail}</p>
                {ev.note && <p className="text-xs text-muted-foreground mt-1 italic">{ev.note}</p>}
                <p className="text-xs text-muted-foreground mt-1">{formatDate(ev.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.description && (
        <div className="surface-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Your original message</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.description}</p>
        </div>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-border/50 py-2">
          <dt className="text-muted-foreground">Opened</dt>
          <dd>{formatDate(c.created_at)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border/50 py-2">
          <dt className="text-muted-foreground">Last updated</dt>
          <dd>{formatDate(c.updated_at)}</dd>
        </div>
        {c.closed_at && (
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Closed</dt>
            <dd>{formatDate(c.closed_at)}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs text-muted-foreground">
        Need something else?{" "}
        <Link href="/client/updates" className="text-primary underline">
          All updates
        </Link>
        {" · "}
        <Link href="/client/support" className="text-primary underline">
          open another ticket
        </Link>
        . Prefer messaging here over calling — your team sees it immediately.
      </p>
    </div>
  );
}
