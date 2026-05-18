import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { CanonicalStageBadge } from "@/components/canonical-stage-badge";
import type { SyncRecordStatus } from "@/lib/crm-sync/labels";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import { formatDate, cn } from "@/lib/utils";
import { SYNC_STATUS_TONE, toneStyles } from "@/lib/ui/status-colors";

export const dynamic = "force-dynamic";

export default async function SyncQueuePage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const supabase = createSupabaseServerClient();

  let q = supabase
    .from("crm_sync_records")
    .select(
      "id, customer_name, ghl_pipeline_name, ghl_stage, ghl_previous_stage, canonical_stage, sync_status, business_line, case_id, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (searchParams.filter === "verified") {
    q = q.eq("sync_status", "verified");
  } else if (searchParams.filter === "rejected") {
    q = q.eq("sync_status", "rejected");
  } else {
    q = q.in("sync_status", ["pending_airtable", "pending_verification"]);
  }

  const { data: rows, error } = await q;

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM sync queue"
        description="Pipeline moves from GHL — verify here before they update cases (like your Airtable Leads review)."
      />

      {error && (
        <p className="text-sm text-red-600">
          Could not load sync records. Run migration{" "}
          <code className="text-xs">0002_crm_sync.sql</code> in Supabase.
        </p>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>
            {searchParams.filter === "verified"
              ? "Verified"
              : searchParams.filter === "rejected"
                ? "Rejected"
                : "Pending review"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { href: "/internal/sync", label: "Pending", tone: SYNC_STATUS_TONE.pending_verification, active: !searchParams.filter },
                { href: "/internal/sync?filter=verified", label: "Verified", tone: SYNC_STATUS_TONE.verified, active: searchParams.filter === "verified" },
                { href: "/internal/sync?filter=rejected", label: "Rejected", tone: SYNC_STATUS_TONE.rejected, active: searchParams.filter === "rejected" },
              ] as const
            ).map((tab) => {
              const s = toneStyles(tab.tone);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    tab.active ? s.pillActive : s.pill
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Customer</Th>
                <Th>Pipeline</Th>
                <Th>GHL stage</Th>
                <Th>Canonical</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(rows ?? []).length === 0 && (
                <Tr>
                  <Td colSpan={6} className="text-muted-foreground text-sm py-8 text-center">
                    No records in this queue.
                  </Td>
                </Tr>
              )}
              {(rows ?? []).map((r) => {
                const status = r.sync_status as SyncRecordStatus;
                const row = toneStyles(SYNC_STATUS_TONE[status] ?? "slate");
                return (
                <Tr key={r.id} className={cn("border-l-4", row.border, row.row)}>
                  <Td>
                    <Link href={`/internal/sync/${r.id}`} className="font-medium underline">
                      {r.customer_name ?? "—"}
                    </Link>
                  </Td>
                  <Td className="text-sm">{r.ghl_pipeline_name ?? r.business_line}</Td>
                  <Td className="text-sm">
                    {r.ghl_previous_stage ? (
                      <span>
                        {r.ghl_previous_stage} → <strong>{r.ghl_stage}</strong>
                      </span>
                    ) : (
                      r.ghl_stage
                    )}
                  </Td>
                  <Td>
                    <CanonicalStageBadge stage={r.canonical_stage as CanonicalRenterStage} />
                  </Td>
                  <Td>
                    <SyncStatusBadge status={status} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">{formatDate(r.updated_at)}</Td>
                </Tr>
              );
              })}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
