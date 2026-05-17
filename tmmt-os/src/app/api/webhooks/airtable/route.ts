import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { applyVerifiedSync } from "@/lib/crm-sync/apply-verified";
import { fetchAirtableRecord } from "@/lib/crm-sync/airtable";

const Body = z.object({
  airtable_record_id: z.string().min(1),
  table: z.string().optional(),
  verified_by: z.string().optional(),
  ghl_contact_id: z.string().optional(),
});

/**
 * Airtable automation: when Verified checkbox is checked → POST here.
 * Promotes row to Supabase cases + marks crm_sync_records verified.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { airtable_record_id, table, verified_by, ghl_contact_id } = parsed.data;
  const tableName = table ?? process.env.AIRTABLE_LEADS_TABLE ?? "Leads";
  const supabase = createSupabaseServiceClient();

  const fields = await fetchAirtableRecord(tableName, airtable_record_id);
  const contactId =
    ghl_contact_id ??
    (fields?.["GHL Contact ID"] as string | undefined);

  if (!contactId) {
    return NextResponse.json(
      { error: "missing GHL Contact ID on Airtable row" },
      { status: 400 }
    );
  }

  const verified = fields?.Verified === true || fields?.["Sync Status"] === "Verified";
  if (!verified) {
    return NextResponse.json(
      { error: "row not verified — check Verified in Airtable first" },
      { status: 400 }
    );
  }

  const { data: syncRecord, error: findErr } = await supabase
    .from("crm_sync_records")
    .select("id")
    .eq("ghl_contact_id", contactId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr || !syncRecord) {
    return NextResponse.json(
      { error: "no crm_sync_record for contact — run GHL webhook first" },
      { status: 404 }
    );
  }

  await supabase.from("sync_events").insert({
    source: "airtable",
    event_type: "record.verified",
    external_id: airtable_record_id,
    sync_record_id: syncRecord.id,
    payload: { fields, verified_by },
    processed: true,
  });

  const result = await applyVerifiedSync({
    syncRecordId: syncRecord.id,
    verifiedBy: verified_by,
    airtableFields: fields ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    sync_record_id: syncRecord.id,
    case_id: result.caseId,
    canonical_stage: result.canonical,
  });
}
