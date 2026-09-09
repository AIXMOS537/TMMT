import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { applyVerifiedSync } from "@/lib/crm-sync/apply-verified";
import { fetchAirtableRecord } from "@/lib/crm-sync/airtable";
import { upsertOpsLocationFromAirtable } from "@/lib/routing/ops-locations";
import { secretMatches } from "@/lib/secure-compare";
import { seenSyncEvent } from "@/lib/agent/webhook-replay";

const Body = z.object({
  airtable_record_id: z.string().min(1),
  table: z.string().optional(),
  event: z.enum(["lead.verified", "ops_location.upsert"]).optional(),
  verified_by: z.string().optional(),
  ghl_contact_id: z.string().optional(),
});

/**
 * Airtable automations:
 * - Leads: Verified checkbox → promote sync record + case
 * - Ops Locations: roster row changed → upsert ops_locations
 *
 * Replay (T-02c). The automation payload carries no event id or timestamp.
 * - lead.verified: keyed on (airtable_record_id, crm_sync_records.id) via the
 *   `record.verified` sync_events row this route writes, AND the sync record
 *   currently being `verified`. Both are required because the sync record is
 *   upserted in place and reset to `pending_verification` on every GHL stage
 *   change (opportunity-stage handler), after which the VA re-verifies the
 *   SAME Airtable row — that is a new cycle, not a replay, and must apply.
 *   A retry after a successful apply is a 200 no-op: no sync_events row, no
 *   applyVerifiedSync (which re-pushes the stage to GHL and re-syncs portal
 *   fields). Fails open on lookup error. No unique index backs this key on
 *   purpose: it legitimately recurs across cycles.
 * - ops_location.upsert: no guard. The only effect is an upsert on slug that
 *   converges; a retry re-writes identical state and logs one more processed
 *   event, which is the cheaper side of a guard that would need a content
 *   hash and would then drop a legitimate re-sync of an unchanged row.
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-sync-secret"), process.env.SYNC_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { airtable_record_id, table, event, verified_by, ghl_contact_id } = parsed.data;
  const opsTable = process.env.AIRTABLE_OPS_LOCATIONS_TABLE ?? "Ops Locations";
  const tableName = table ?? process.env.AIRTABLE_LEADS_TABLE ?? "Leads";
  const supabase = createServiceRoleClient();

  const fields = (await fetchAirtableRecord(tableName, airtable_record_id)) ?? {};

  const isOpsSync =
    event === "ops_location.upsert" ||
    tableName === opsTable ||
    table === opsTable;

  if (isOpsSync) {
    const location = await upsertOpsLocationFromAirtable(fields);
    await supabase.from("sync_events").insert({
      source: "airtable",
      event_type: "ops_location.upsert",
      external_id: airtable_record_id,
      payload: { fields, location },
      processed: true,
    });
    return NextResponse.json({ ok: true, ops_location: location });
  }

  const contactId =
    ghl_contact_id ?? (fields?.["GHL Contact ID"] as string | undefined);

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
    .select("id, sync_status")
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

  // ── REPLAY GATE ────────────────────────────────────────────────────────
  // See the module comment: already-verified sync record + an existing
  // record.verified event for this Airtable row = a retried delivery.
  if (
    syncRecord.sync_status === "verified" &&
    (await seenSyncEvent(supabase, {
      source: "airtable",
      eventType: "record.verified",
      externalId: airtable_record_id,
      syncRecordId: syncRecord.id,
    }))
  ) {
    console.warn("[webhooks/airtable] duplicate lead.verified delivery, dropping replay", {
      airtable_record_id,
      sync_record_id: syncRecord.id,
    });
    return NextResponse.json({ ok: true, duplicate: true, sync_record_id: syncRecord.id });
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
    airtableFields: fields,
  });

  return NextResponse.json({
    ok: true,
    sync_record_id: syncRecord.id,
    case_id: result.caseId,
    canonical_stage: result.canonical,
  });
}
