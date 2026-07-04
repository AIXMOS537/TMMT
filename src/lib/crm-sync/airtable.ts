/**
 * Best-effort Airtable upsert for the verification queue.
 * Requires AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_LEADS_TABLE in env.
 */

type AirtableFields = Record<string, string | number | boolean | null>;

export async function upsertLeadForVerification(args: {
  ghlContactId: string;
  ghlOpportunityId?: string;
  pipelineName?: string;
  ghlStage: string;
  canonicalStage: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customFields?: Record<string, unknown>;
}): Promise<{ recordId?: string; skipped: boolean; reason?: string }> {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_LEADS_TABLE ?? "Leads";

  // Never die silently again. The Airtable leg froze at 871 leads on 2026-01-15
  // because this returned skipped:true with NO log when env was unset — no error,
  // no alert, ~4 months of leads lost. Every skip/fail now shouts with a unique tag
  // so Sentry / a log drain can catch it and raise it to 02-Needs-You.
  const skip = (reason: string): { skipped: true; reason: string } => {
    console.error(
      `[INTAKE-SILENT-SKIP] Airtable lead upsert skipped — ${reason} | ghlContactId=${args.ghlContactId} table=${table}`
    );
    return { skipped: true, reason };
  };

  if (!apiKey || !baseId) {
    return skip("AIRTABLE_API_KEY or AIRTABLE_BASE_ID not set");
  }

  const fields: AirtableFields = {
    "GHL Contact ID": args.ghlContactId,
    "GHL Opportunity ID": args.ghlOpportunityId ?? null,
    "GHL Pipeline": args.pipelineName ?? null,
    "GHL Stage": args.ghlStage,
    "Canonical Stage": args.canonicalStage,
    "Sync Status": "Pending Review",
    Verified: false,
    "Last Synced At": new Date().toISOString(),
  };

  if (args.customerName) fields["Name"] = args.customerName;
  if (args.customerEmail) fields["Email"] = args.customerEmail;
  if (args.customerPhone) fields["Phone"] = args.customerPhone;

  const filter = encodeURIComponent(`{GHL Contact ID}='${args.ghlContactId.replace(/'/g, "\\'")}'`);
  const listUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${filter}&maxRecords=1`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const listRes = await fetch(listUrl, { headers, cache: "no-store" });
  if (!listRes.ok) {
    return skip(`Airtable list failed: ${listRes.status}`);
  }

  const listJson = (await listRes.json()) as { records?: { id: string }[] };
  const existingId = listJson.records?.[0]?.id;

  if (existingId) {
    const patchRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${existingId}`,
      { method: "PATCH", headers, body: JSON.stringify({ fields }) }
    );
    if (!patchRes.ok) {
      return skip(`Airtable patch failed: ${patchRes.status}`);
    }
    return { recordId: existingId, skipped: false };
  }

  const createRes = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
    { method: "POST", headers, body: JSON.stringify({ fields }) }
  );
  if (!createRes.ok) {
    return skip(`Airtable create failed: ${createRes.status}`);
  }
  const created = (await createRes.json()) as { id: string };
  return { recordId: created.id, skipped: false };
}

export async function patchAirtableSyncFields(args: {
  recordId: string;
  table?: string;
  fields: Record<string, string | number | boolean | null>;
}): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = args.table ?? process.env.AIRTABLE_LEADS_TABLE ?? "Leads";
  if (!apiKey || !baseId) return { ok: false, reason: "Airtable not configured" };

  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${args.recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: args.fields }),
      cache: "no-store",
    }
  );
  if (!res.ok) return { ok: false, reason: `patch ${res.status}` };
  return { ok: true };
}

/** Mark row verified in Airtable when approving from TMMT OS (keeps systems aligned). */
export async function markAirtableVerified(args: {
  recordId: string;
  table?: string;
  verifiedBy?: string;
}) {
  return patchAirtableSyncFields({
    recordId: args.recordId,
    table: args.table,
    fields: {
      Verified: true,
      "Sync Status": "Verified",
      "Last Synced At": new Date().toISOString(),
    },
  });
}

export async function fetchAirtableRecord(
  table: string,
  recordId: string
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;

  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${recordId}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { fields: Record<string, unknown> };
  return json.fields ?? null;
}
