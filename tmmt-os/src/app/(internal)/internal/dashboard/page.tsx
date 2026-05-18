import Link from "next/link";
import { FolderKanban, RefreshCw, AlertCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { JobStatusBadge } from "@/components/job-status-badge";
import { ColoredRow } from "@/components/colored-row";
import { MobileOpsTriage } from "@/components/mobile-ops-triage";
import { formatDate } from "@/lib/utils";
import type { CaseStatus, VendorJobStatus } from "@/lib/workflow/statuses";
import { getCaseStatusTone, VENDOR_JOB_TONE } from "@/lib/ui/status-colors";

export const dynamic = "force-dynamic";

export default async function InternalDashboard() {
  const supabase = createSupabaseServerClient();

  const [
    { count: openCount },
    { count: blockedCount },
    { count: pendingSync },
    { data: openCases },
    { data: vendorJobs },
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(completed,closed)"),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("status", "blocked"),
    supabase
      .from("crm_sync_records")
      .select("id", { count: "exact", head: true })
      .in("sync_status", ["pending_airtable", "pending_verification"]),
    supabase
      .from("cases")
      .select("id, ref_code, customer_name, subject, status, created_at")
      .not("status", "in", "(completed,closed)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("vendor_jobs")
      .select("id, title, status, case_id, due_at")
      .in("status", ["offered", "accepted", "scheduled", "in_progress", "pending_review"])
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations"
        description="At-a-glance metrics and live queues across TMMT OS operations."
      />

      <MobileOpsTriage
        pendingSync={pendingSync ?? 0}
        blockedCases={blockedCount ?? 0}
        openCases={openCount ?? 0}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open cases"
          value={openCount ?? 0}
          hint="Not completed or closed"
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <StatCard
          label="Blocked"
          value={blockedCount ?? 0}
          hint="Needs attention"
          icon={<AlertCircle className="h-5 w-5" />}
          accent="ring-1 ring-red-200/80"
        />
        <StatCard
          label="CRM pending"
          value={pendingSync ?? 0}
          hint="Awaiting verification"
          icon={<RefreshCw className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open cases</h2>
            <Link href="/internal/cases" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {(openCases ?? []).length === 0 && (
              <p className="surface-muted px-4 py-8 text-center text-sm text-muted-foreground">No open cases.</p>
            )}
            {(openCases ?? []).map((c) => (
              <ColoredRow
                key={c.id}
                href={`/internal/cases/${c.id}`}
                tone={getCaseStatusTone(c.status as CaseStatus)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.ref_code} · {c.customer_name} · {formatDate(c.created_at)}
                    </p>
                  </div>
                  <CaseStatusBadge status={c.status as CaseStatus} />
                </div>
              </ColoredRow>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Vendor work in flight</h2>
            <Link href="/internal/vendors" className="text-xs font-medium text-primary hover:underline">
              Vendors
            </Link>
          </div>
          <div className="space-y-2">
            {(vendorJobs ?? []).length === 0 && (
              <p className="surface-muted px-4 py-8 text-center text-sm text-muted-foreground">No active jobs.</p>
            )}
            {(vendorJobs ?? []).map((j) => (
              <ColoredRow
                key={j.id}
                href={`/internal/cases/${j.case_id}`}
                tone={VENDOR_JOB_TONE[j.status as VendorJobStatus] ?? "slate"}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{j.title}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(j.due_at)}</p>
                  </div>
                  <JobStatusBadge status={j.status as VendorJobStatus} />
                </div>
              </ColoredRow>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
