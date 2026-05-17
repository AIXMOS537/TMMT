import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { CanonicalStageBadge } from "@/components/canonical-stage-badge";
import type { SyncRecordStatus } from "@/lib/crm-sync/labels";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import { formatDate } from "@/lib/utils";
import { approveSyncAction, rejectSyncAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SyncRecordPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: record, error } = await supabase
    .from("crm_sync_records")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !record) notFound();

  const pending = ["pending_airtable", "pending_verification"].includes(record.sync_status);
  const payload = JSON.stringify(record.payload ?? {}, null, 2);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/internal/sync" className="underline">
          Sync queue
        </Link>
        <span>/</span>
        <span>{record.customer_name ?? record.ghl_contact_id}</span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{record.customer_name ?? "Sync record"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {record.ghl_pipeline_name ?? record.business_line} · GHL contact{" "}
            <span className="font-mono text-xs">{record.ghl_contact_id}</span>
          </p>
        </div>
        <SyncStatusBadge status={record.sync_status as SyncRecordStatus} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Stage change</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted-foreground">Canonical:</span>
            <CanonicalStageBadge stage={record.canonical_stage as CanonicalRenterStage} />
          </div>
          <p>
            <span className="text-muted-foreground">GHL:</span>{" "}
            {record.ghl_previous_stage ? (
              <>
                {record.ghl_previous_stage} → <strong>{record.ghl_stage}</strong>
              </>
            ) : (
              <strong>{record.ghl_stage}</strong>
            )}
          </p>
          {record.customer_email && (
            <p>
              <span className="text-muted-foreground">Email:</span> {record.customer_email}
            </p>
          )}
          {record.customer_phone && (
            <p>
              <span className="text-muted-foreground">Phone:</span> {record.customer_phone}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Updated {formatDate(record.updated_at)}</p>
          {record.airtable_record_id && (
            <p className="text-xs">
              Airtable: {record.airtable_table ?? "Leads"} / {record.airtable_record_id}
            </p>
          )}
          {record.case_id && (
            <p>
              <Link href={`/internal/cases/${record.case_id}`} className="underline text-sm">
                Open linked case →
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {pending && (
        <Card>
          <CardHeader>
            <CardTitle>Team verification</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <form action={approveSyncAction}>
              <input type="hidden" name="sync_record_id" value={record.id} />
              <Button type="submit">Approve → update app</Button>
            </form>
            <form action={rejectSyncAction} className="flex flex-1 gap-2 items-end">
              <input type="hidden" name="sync_record_id" value={record.id} />
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Reject reason (optional)</label>
                <input
                  name="reason"
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  placeholder="Wrong stage / duplicate"
                />
              </div>
              <Button type="submit" variant="outline">
                Reject
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Raw payload</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto bg-muted p-3 rounded-md max-h-64">{payload}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
