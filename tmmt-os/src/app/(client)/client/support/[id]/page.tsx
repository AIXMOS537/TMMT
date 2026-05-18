import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEntitlement } from "@/lib/auth-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { RequestTypeBadge } from "@/components/request-type-badge";
import { formatDate } from "@/lib/utils";
import type { CaseStatus, RequestType } from "@/lib/workflow/statuses";

export const dynamic = "force-dynamic";

export default async function ClientTicketDetailPage({ params }: { params: { id: string } }) {
  await requireEntitlement("support_tickets", "/client/dashboard");
  const supabase = createSupabaseServerClient();

  const { data: c } = await supabase
    .from("cases")
    .select("id, ref_code, subject, description, status, request_type, created_at, updated_at, closed_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!c) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/client/support" className="text-sm text-muted-foreground hover:underline">
        ← Tickets
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-xs text-muted-foreground">{c.ref_code}</p>
        <h1 className="text-2xl font-semibold">{c.subject}</h1>
        <div className="flex flex-wrap gap-2">
          <CaseStatusBadge status={c.status as CaseStatus} />
          <RequestTypeBadge type={c.request_type as RequestType} />
        </div>
      </header>

      {c.description && (
        <div className="surface-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Details</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.description}</p>
        </div>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-border/50 py-2">
          <dt className="text-muted-foreground">Opened</dt>
          <dd>{formatDate(c.created_at)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border/50 py-2">
          <dt className="text-muted-foreground">Updated</dt>
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
        <Link href="/client/maintenance" className="text-primary underline">
          Maintenance
        </Link>{" "}
        or{" "}
        <Link href="/client/support" className="text-primary underline">
          open another ticket
        </Link>
        .
      </p>
    </div>
  );
}
