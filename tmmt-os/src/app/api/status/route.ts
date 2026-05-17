import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * JSON health + sync queue depth for monitors and AIX snapshots.
 */
export async function GET() {
  let pendingSync = 0;
  try {
    const supabase = createSupabaseServiceClient();
    const { count } = await supabase
      .from("crm_sync_records")
      .select("id", { count: "exact", head: true })
      .in("sync_status", ["pending_airtable", "pending_verification"]);
    pendingSync = count ?? 0;
  } catch {
    /* migration may not be applied yet */
  }

  return NextResponse.json({
    ok: true,
    service: "tmmt-os",
    version: process.env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
    sync_queue_pending: pendingSync,
  });
}
