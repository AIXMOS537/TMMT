import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Health check for CRM migrations — DDL must run in Supabase SQL Editor.
 *
 * POST with header: X-Migration-Secret: <INTAKE_WEBHOOK_SECRET or MIGRATION_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret =
    process.env.MIGRATION_SECRET ??
    process.env.INTAKE_WEBHOOK_SECRET ??
    process.env.GHL_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-migration-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "missing supabase env" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await supabase.from("crm_sync_records").select("id").limit(1);
  if (!error) {
    return NextResponse.json({ ok: true, message: "crm_sync_records exists" });
  }

  return NextResponse.json(
    {
      error: "crm_sync_records not found",
      hint: "Run supabase/migrations/0002_crm_sync.sql in Supabase SQL Editor",
      supabase_error: error.message,
    },
    { status: 503 }
  );
}
