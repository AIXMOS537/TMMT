/**
 * scripts/parity-check.ts — Phase 1 parity verification (Airtable -> Supabase).
 *
 * Reconciles every Airtable table in the TMMT Rentals base against its mapped Supabase
 * table and emits MATCH / GAP / SB_RICHER / UNMAPPED per entity.
 *
 * Read-only. This script never writes to Airtable or Supabase.
 *
 *   node scripts/parity-check.ts
 *   node scripts/parity-check.ts --out evidence/parity-report.generated.md
 *   node scripts/parity-check.ts --table active_customers --explain-gap
 *   node scripts/parity-check.ts --table background_checks --sample 5 --fields --i-understand-pii
 *
 * Runs on plain `node` via native TypeScript type-stripping (Node >= 22.18). No build step,
 * no dependencies — deliberately, so a parity audit can be run on a clean machine.
 *
 * Env:
 *   AIRTABLE_PAT                 Airtable personal access token (read scope is sufficient)
 *   SUPABASE_URL                 or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    service_role (needed to read past RLS for an audit)
 *
 * PRIME DIRECTIVE 7: no secret is ever printed, logged, or written to the report.
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? 'appcenWUju039rD7b';

/** Airtable allows 5 requests/second/base. Stay under it deliberately (§4.3). */
const AIRTABLE_MIN_INTERVAL_MS = 220;

type Mapping = {
  /** Human label used in the report. */
  entity: string;
  airtableTableId: string;
  airtableTableName: string;
  /** Mapped Supabase table, or null when the entity has no destination yet. */
  supabaseTable: string | null;
  /**
   * A field requested purely to make counting cheap. Chosen to be NON-PII wherever the
   * table has a usable non-PII field (autoNumber, status, date). Counting must not drag
   * customer names through a session log.
   */
  countFieldId: string | null;
  note?: string;
};

/**
 * Verified against the live base on 2026-09-15. All 31 tables are listed; an entity with
 * `supabaseTable: null` is UNMAPPED and needs a disposition before Gate 4, not a silent skip.
 */
const MAPPINGS: Mapping[] = [
  // --- mapped operational entities -------------------------------------------------
  { entity: 'fleet', airtableTableId: 'tblubnSDZkvsc9L6I', airtableTableName: 'Fleet', supabaseTable: 'fleet', countFieldId: 'fldScUqs8HAfOIXPY' },
  { entity: 'customer_payments', airtableTableId: 'tblsG1LCDNSeehiLf', airtableTableName: 'Customer Payments', supabaseTable: 'customer_payments', countFieldId: 'fldiJOalNjacw1JFQ' },
  { entity: 'operation_costs', airtableTableId: 'tble5ImZMLkiBSBk5', airtableTableName: 'Operation Costs', supabaseTable: 'operation_costs', countFieldId: 'flduQy5UHSaOTHGnC' },
  { entity: 'tickets', airtableTableId: 'tblhfKVanQDgn9plv', airtableTableName: 'Tickets', supabaseTable: 'tickets', countFieldId: 'fldZejUWbi3lNtULO' },
  { entity: 'waitlist', airtableTableId: 'tblaYxS00uU1dBNGX', airtableTableName: 'Waitlist', supabaseTable: 'waitlist', countFieldId: 'fldwok8LSPfhUFCP1' },
  { entity: 'insurance', airtableTableId: 'tblU3rRVFuZFU4kPs', airtableTableName: 'Insurance', supabaseTable: 'insurance', countFieldId: 'fldulZwhmquKddtEh' },
  { entity: 'do_not_rent_list', airtableTableId: 'tblE6nOqVcSeGFQCi', airtableTableName: 'Do Not Rent List', supabaseTable: 'do_not_rent_list', countFieldId: 'fldbklMdnlISU9l0x' },
  { entity: 'fleet_car_inspections', airtableTableId: 'tbluH4YH2YBuu7FFg', airtableTableName: 'Fleet Car Inspections', supabaseTable: 'fleet_car_inspections', countFieldId: 'fldtGSTsMlfROFPtX' },
  { entity: 'appointments', airtableTableId: 'tblAIzg1np4l9fCL3', airtableTableName: 'Appointments', supabaseTable: 'appointments', countFieldId: 'fldm7e4baUNDLa08q' },
  { entity: 'vehicle_handover', airtableTableId: 'tblKmdjH0tmKY9Bcl', airtableTableName: 'Vehicle Handover', supabaseTable: 'vehicle_handover', countFieldId: 'fldJHvHgNsVq2kqfz' },
  { entity: 'customer_inspection_photos', airtableTableId: 'tblbaUFnNFFfalnRc', airtableTableName: 'Customer Inspection Photos', supabaseTable: 'customer_inspection_photos', countFieldId: 'fldJFTbtXPvEVCJj6' },
  { entity: 'vehicle_onboarding_inspections', airtableTableId: 'tblqJuzv6YkuAn1kL', airtableTableName: 'Vehicle Onboarding Inspections', supabaseTable: 'vehicle_onboarding_inspections', countFieldId: 'fldVvX41FXavRygjw' },
  { entity: 'incoming_leads', airtableTableId: 'tbl4gndUYeiOUWYRR', airtableTableName: 'Incoming Leads', supabaseTable: 'incoming_leads', countFieldId: 'fldF4Ukqncf6vdYU8', note: 'GHL-fed; Supabase is expected to run ahead' },
  { entity: 'contracts', airtableTableId: 'tblyDwuH3fBZmaCTF', airtableTableName: 'Contracts', supabaseTable: 'contracts', countFieldId: 'fldiKZT7R5qyiUw9b', note: 'Airtable never held signed agreements — see evidence/parity-report.md §2.2' },
  { entity: 'background_checks', airtableTableId: 'tbl1OFZh3cMXytNZM', airtableTableName: 'Background Checks', supabaseTable: 'background_checks', countFieldId: 'fldZz3BgKD8ISLyB7', note: 'Holds identity documents — resolve gaps BEFORE extraction' },
  { entity: 'active_customers', airtableTableId: 'tblFJIhonUvf631uM', airtableTableName: 'Active Customers', supabaseTable: 'active_customers', countFieldId: 'fldF75xdQbWxPDyeu' },
  { entity: 'employee_access_rights', airtableTableId: 'tblJQxp7vQowTHjVY', airtableTableName: 'Employee Access Rights', supabaseTable: 'employee_access_rights', countFieldId: 'fldkWSQjudj9S15pa', note: 'Access-control record, not operational data' },
  { entity: 'expenses', airtableTableId: 'tblu4DFhHglmQMEBj', airtableTableName: 'Expenses', supabaseTable: 'expenses', countFieldId: 'fldHdWD5bwlSwLwVr' },
  { entity: 'maintenance_appointments', airtableTableId: 'tblmmX3Af4cPtRa0O', airtableTableName: 'Maintenance Appointments', supabaseTable: 'maintenance_appointments', countFieldId: 'fldk61sX8yWtNx2MM' },
  { entity: 'former_customers', airtableTableId: 'tblnU7oicHjc6Vqlp', airtableTableName: 'Former Customers', supabaseTable: 'former_customers', countFieldId: 'fldBKbLvZFOZRwbWD' },

  // --- unmapped: need a disposition before Gate 4 ----------------------------------
  { entity: 'shops_mechanics_cleaning', airtableTableId: 'tblEBvhjUOgdNYFiJ', airtableTableName: 'Shops/ Mechanics/ Cleaning', supabaseTable: null, countFieldId: 'fld5v280UlMMtZZLL', note: 'vendors holds 1 row — not the same data' },
  { entity: 'bills_subscriptions', airtableTableId: 'tblSkU7C2BpGY9cGC', airtableTableName: 'Money Command — Bills & Subscriptions', supabaseTable: null, countFieldId: 'fldXwzBmOmfqzDugv', note: 'May already hold the Phase 0 §2.3 vendor figures' },
  { entity: 'change_update_log', airtableTableId: 'tblzRQFwEVFy1uQTL', airtableTableName: '🔄 Change & Update Log', supabaseTable: null, countFieldId: 'fldho7tstmZjRDou4' },
  { entity: 'client_accounts', airtableTableId: 'tbl2hMmXhhjiE1mDx', airtableTableName: 'Client Accounts', supabaseTable: null, countFieldId: 'fldtkaf5UQ3etOPEz' },
  { entity: 'content_pipeline', airtableTableId: 'tbl19zqT6BirKq8iJ', airtableTableName: 'Content Pipeline', supabaseTable: null, countFieldId: 'fldkiS8XkezIBT77S' },
  { entity: 'operator_signups', airtableTableId: 'tblEeXFOgdUiZPPSs', airtableTableName: 'TMMT Operator Signups', supabaseTable: null, countFieldId: 'fld3WntG8dz0m1DGR' },
  { entity: 'partner_acquisition', airtableTableId: 'tblDL6VOeRmjddRNX', airtableTableName: 'Partner Acquisition', supabaseTable: null, countFieldId: 'fldDJkf1SuwvxVZsD', note: 'Empty, but carries the richest encoded logic in the base — see docs/business-rules/' },
  { entity: 'oo_workstreams', airtableTableId: 'tbl9wINA1PIywXDDf', airtableTableName: 'OO – Workstreams', supabaseTable: null, countFieldId: 'fldWfDurholHmfOZv', note: 'Operation Overdrive — separate venture' },
  { entity: 'oo_drivers', airtableTableId: 'tblVpSxwHZiabw9qQ', airtableTableName: 'OO – Drivers', supabaseTable: null, countFieldId: 'fldAWd70tbDYiSUru', note: 'Operation Overdrive — separate venture' },
  { entity: 'oo_vehicle_build', airtableTableId: 'tblgIFJ1B8touW7ZR', airtableTableName: 'OO – Vehicle Build', supabaseTable: null, countFieldId: 'fldmHMN1uP4TA0FQK', note: 'Operation Overdrive — separate venture' },
  { entity: 'oo_grant_budget', airtableTableId: 'tblSCubc87I631sA7', airtableTableName: 'OO – Grant Budget', supabaseTable: null, countFieldId: 'fldKSewf3rnQbqEXk', note: 'Operation Overdrive — separate venture' },
];

// ---------------------------------------------------------------------------------
// env / args
// ---------------------------------------------------------------------------------

function requireEnv(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const v = process.env[key];
    if (v && v.trim()) return v.trim();
  }
  console.error(
    `Missing required env var: ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const ONLY_TABLE = argValue('--table');
const EXPLAIN_GAP = hasFlag('--explain-gap');
const SAMPLE_N = Number(argValue('--sample') ?? 0);
const FIELD_DIFF = hasFlag('--fields');
const PII_ACK = hasFlag('--i-understand-pii');
const OUT_PATH = argValue('--out');

// ---------------------------------------------------------------------------------
// throttled Airtable client
// ---------------------------------------------------------------------------------

let lastAirtableCall = 0;

async function airtable(path: string, token: string): Promise<any> {
  const wait = AIRTABLE_MIN_INTERVAL_MS - (Date.now() - lastAirtableCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAirtableCall = Date.now();

  const res = await fetch(`https://api.airtable.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    // Back off and retry once. A 429 mid-run corrupts progress accounting (§4.3).
    await new Promise((r) => setTimeout(r, 2000));
    return airtable(path, token);
  }
  if (!res.ok) {
    // Never echo the response body blindly — it can quote request headers.
    throw new Error(`Airtable ${res.status} on ${path.split('?')[0]}`);
  }
  return res.json();
}

/**
 * Count rows by paginating. Airtable's REST API returns no total, so the only honest count
 * is a full walk. We request a single non-PII field to keep the payload small.
 */
async function countAirtable(m: Mapping, token: string): Promise<number> {
  let total = 0;
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    if (m.countFieldId) params.append('fields[]', m.countFieldId);
    if (offset) params.set('offset', offset);

    const json = await airtable(`/v0/${BASE_ID}/${m.airtableTableId}?${params}`, token);
    total += json.records?.length ?? 0;
    offset = json.offset;
  } while (offset);

  return total;
}

/** Collect Airtable record IDs only. No field values leave the function. */
async function listAirtableRecordIds(m: Mapping, token: string): Promise<string[]> {
  const ids: string[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    if (m.countFieldId) params.append('fields[]', m.countFieldId);
    if (offset) params.set('offset', offset);

    const json = await airtable(`/v0/${BASE_ID}/${m.airtableTableId}?${params}`, token);
    for (const r of json.records ?? []) ids.push(r.id);
    offset = json.offset;
  } while (offset);

  return ids;
}

// ---------------------------------------------------------------------------------
// Supabase (PostgREST) client
// ---------------------------------------------------------------------------------

function supabaseHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Exact count via PostgREST's Content-Range header. Never reltuples estimates. */
async function countSupabase(table: string, url: string, key: string): Promise<number | null> {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...supabaseHeaders(key), Prefer: 'count=exact' },
  });
  if (res.status === 404) return null; // table does not exist
  if (!res.ok) throw new Error(`Supabase ${res.status} counting ${table}`);

  const range = res.headers.get('content-range'); // e.g. "0-0/43"
  const total = range?.split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

/** Fetch the airtable_id values present on the Supabase side, paginated. */
async function listSupabaseAirtableIds(
  table: string,
  url: string,
  key: string,
): Promise<Set<string> | null> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const res = await fetch(`${url}/rest/v1/${table}?select=airtable_id`, {
      headers: { ...supabaseHeaders(key), Range: `${from}-${from + pageSize - 1}` },
    });
    if (res.status === 404 || res.status === 400) return null; // no such table / no such column
    if (!res.ok) throw new Error(`Supabase ${res.status} reading ${table}.airtable_id`);

    const rows = (await res.json()) as Array<{ airtable_id: string | null }>;
    for (const row of rows) if (row.airtable_id) ids.add(row.airtable_id);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

// ---------------------------------------------------------------------------------
// reconciliation
// ---------------------------------------------------------------------------------

type State = 'MATCH' | 'GAP' | 'SB_RICHER' | 'UNMAPPED' | 'SB_TABLE_MISSING';

type Row = {
  entity: string;
  airtableTableName: string;
  airtableRows: number;
  supabaseTable: string | null;
  supabaseRows: number | null;
  state: State;
  delta: number | null;
  note?: string;
};

function classify(airtableRows: number, supabaseRows: number | null, mapped: boolean): State {
  if (!mapped) return 'UNMAPPED';
  if (supabaseRows === null) return 'SB_TABLE_MISSING';
  if (supabaseRows === airtableRows) return 'MATCH';
  return supabaseRows > airtableRows ? 'SB_RICHER' : 'GAP';
}

async function reconcile(token: string, sbUrl: string, sbKey: string): Promise<Row[]> {
  const targets = ONLY_TABLE
    ? MAPPINGS.filter((m) => m.entity === ONLY_TABLE || m.airtableTableId === ONLY_TABLE)
    : MAPPINGS;

  if (targets.length === 0) {
    console.error(`No mapping matches --table ${ONLY_TABLE}`);
    process.exit(1);
  }

  const rows: Row[] = [];

  for (const m of targets) {
    process.stderr.write(`counting ${m.entity} ... `);
    const airtableRows = await countAirtable(m, token);
    const supabaseRows = m.supabaseTable ? await countSupabase(m.supabaseTable, sbUrl, sbKey) : null;
    const state = classify(airtableRows, supabaseRows, m.supabaseTable !== null);

    rows.push({
      entity: m.entity,
      airtableTableName: m.airtableTableName,
      airtableRows,
      supabaseTable: m.supabaseTable,
      supabaseRows,
      state,
      delta: supabaseRows === null ? null : supabaseRows - airtableRows,
      note: m.note,
    });

    process.stderr.write(`AT=${airtableRows} SB=${supabaseRows ?? '-'} ${state}\n`);
  }

  return rows;
}

/**
 * Print the Airtable record IDs that have no Supabase counterpart.
 *
 * Deliberately prints record IDs and nothing else: the owner opens them in Airtable. This
 * answers "which rows are missing" without exporting a single customer name.
 */
async function explainGap(token: string, sbUrl: string, sbKey: string): Promise<void> {
  const m = MAPPINGS.find((x) => x.entity === ONLY_TABLE || x.airtableTableId === ONLY_TABLE);
  if (!m?.supabaseTable) {
    console.error(`--explain-gap needs a mapped --table. Got: ${ONLY_TABLE ?? '(none)'}`);
    process.exit(1);
  }

  const [airtableIds, supabaseIds] = await Promise.all([
    listAirtableRecordIds(m, token),
    listSupabaseAirtableIds(m.supabaseTable, sbUrl, sbKey),
  ]);

  if (supabaseIds === null) {
    console.error(
      `${m.supabaseTable} has no airtable_id column (or does not exist) — cannot diff by provenance.`,
    );
    process.exit(1);
  }

  const missing = airtableIds.filter((id) => !supabaseIds.has(id));

  console.log(`\n# Gap explanation — ${m.entity}\n`);
  console.log(`Airtable records:            ${airtableIds.length}`);
  console.log(`Supabase rows w/ airtable_id: ${supabaseIds.size}`);
  console.log(`In Airtable, not in Supabase: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log('No provenance gap. A row-count difference here means Supabase holds rows that');
    console.log('did not come from Airtable (native inserts), not that Airtable rows were lost.');
    return;
  }

  console.log('Open each of these in Airtable and record: failed to migrate, or deliberately');
  console.log('excluded? Both answers are acceptable. An unanswered question is not.\n');
  for (const id of missing) {
    console.log(`  https://airtable.com/${BASE_ID}/${m.airtableTableId}/${id}`);
  }
}

/**
 * Field-level fidelity sample (§3.3). Reads full records — that means PII — so it refuses
 * to run without an explicit acknowledgement flag.
 */
async function fieldDiff(token: string, sbUrl: string, sbKey: string): Promise<void> {
  if (!PII_ACK) {
    console.error(
      '--fields reads full records including customer names, phones, emails and licence data.\n' +
        'Re-run with --i-understand-pii, ideally on a machine where the output stays local.',
    );
    process.exit(1);
  }

  const m = MAPPINGS.find((x) => x.entity === ONLY_TABLE || x.airtableTableId === ONLY_TABLE);
  if (!m?.supabaseTable) {
    console.error(`--fields needs a mapped --table. Got: ${ONLY_TABLE ?? '(none)'}`);
    process.exit(1);
  }

  const n = SAMPLE_N > 0 ? SAMPLE_N : 5;
  const params = new URLSearchParams({ pageSize: String(Math.min(n, 100)) });
  const json = await airtable(`/v0/${BASE_ID}/${m.airtableTableId}?${params}`, token);
  const sample = (json.records ?? []).slice(0, n);

  console.log(`\n# Field-level sample diff — ${m.entity} (n=${sample.length})\n`);

  for (const rec of sample) {
    const res = await fetch(
      `${sbUrl}/rest/v1/${m.supabaseTable}?airtable_id=eq.${rec.id}&select=*`,
      { headers: supabaseHeaders(sbKey) },
    );
    const sbRows = res.ok ? await res.json() : [];
    const sb = sbRows[0];

    console.log(`## ${rec.id}`);
    if (!sb) {
      console.log('  MISSING in Supabase\n');
      continue;
    }

    for (const [field, atValue] of Object.entries(rec.fields ?? {})) {
      const col = field
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const sbValue = (sb as Record<string, unknown>)[col];

      // The four traps §3.3 names, each reported rather than normalised away.
      if (sbValue === undefined) {
        console.log(`  [NO COLUMN]     ${field} -> ${col}`);
      } else if (Array.isArray(atValue) && atValue.every((v) => typeof v === 'string' && v.startsWith('rec'))) {
        const ok = Array.isArray(sbValue) || typeof sbValue === 'string';
        console.log(`  [LINK ${ok ? 'OK ' : 'LOST'}]     ${field}: ${atValue.length} link(s)`);
      } else if (sbValue === null && atValue != null) {
        console.log(`  [NULLED]        ${field} (select option may not have mapped)`);
      } else if (typeof atValue === 'number' && typeof sbValue === 'number' && atValue !== sbValue) {
        console.log(`  [PRECISION]     ${field}: AT=${atValue} SB=${sbValue}`);
      }
    }
    console.log('');
  }

  console.log('Formula and rollup fields must be RECOMPUTED in Supabase, never copied as stale');
  console.log('values. A populated jsonb attachment column is evidence of a MISSING file, not');
  console.log('a present one — its Airtable signed URL expired hours after the copy.');
}

// ---------------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------------

function toMarkdown(rows: Row[]): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const mapped = rows.filter((r) => r.state !== 'UNMAPPED');
  const unmapped = rows.filter((r) => r.state === 'UNMAPPED');
  const totalAirtable = rows.reduce((a, r) => a + r.airtableRows, 0);

  const lines: string[] = [
    '# Evidence — Phase 1 (Parity Verification) — generated',
    '',
    `Run date: ${stamp} · Airtable base \`${BASE_ID}\` · read-only.`,
    `Airtable counts are full paginated walks. Supabase counts are exact \`count=exact\`.`,
    '',
    `**Tables counted: ${rows.length}. Total Airtable records: ${totalAirtable}.**`,
    '',
    '## Mapped entities',
    '',
    '| Entity | Airtable | Supabase table | Supabase | Δ | State |',
    '|---|---:|---|---:|---:|---|',
  ];

  for (const r of mapped) {
    const delta = r.delta === null ? '—' : r.delta > 0 ? `+${r.delta}` : String(r.delta);
    lines.push(
      `| ${r.entity} | ${r.airtableRows} | \`${r.supabaseTable}\` | ${r.supabaseRows ?? '—'} | ${delta} | **${r.state}** |`,
    );
  }

  lines.push('', '## Unmapped entities', '', '| Entity | Airtable table | Rows | Note |', '|---|---|---:|---|');
  for (const r of unmapped) {
    lines.push(`| ${r.entity} | ${r.airtableTableName} | ${r.airtableRows} | ${r.note ?? ''} |`);
  }

  const gaps = mapped.filter((r) => r.state === 'GAP' || r.state === 'SB_TABLE_MISSING');
  lines.push('', '## Open items', '');
  if (gaps.length === 0) {
    lines.push('No GAP entities. Every mapped entity is MATCH or SB_RICHER.');
  } else {
    for (const r of gaps) {
      lines.push(
        `- **${r.entity}** — ${r.state}${r.delta !== null ? ` (${r.delta})` : ''}. ` +
          `Resolve with: \`node scripts/parity-check.ts --table ${r.entity} --explain-gap\``,
      );
    }
  }

  lines.push(
    '',
    '> Row parity is not migration. This report says nothing about attachments —',
    '> see `evidence/attachment-inventory.md`.',
    '',
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------------

async function main(): Promise<void> {
  const token = requireEnv('AIRTABLE_PAT');
  const sbUrl = requireEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const sbKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (EXPLAIN_GAP) return explainGap(token, sbUrl, sbKey);
  if (FIELD_DIFF) return fieldDiff(token, sbUrl, sbKey);

  const rows = await reconcile(token, sbUrl, sbKey);
  const md = toMarkdown(rows);

  if (OUT_PATH) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(OUT_PATH, md, 'utf8');
    process.stderr.write(`\nwrote ${OUT_PATH}\n`);
  } else {
    console.log(md);
  }

  // Non-zero exit when a mapped entity is short, so CI can gate on it.
  const short = rows.filter((r) => r.state === 'GAP' || r.state === 'SB_TABLE_MISSING');
  if (short.length > 0) {
    process.stderr.write(`\n${short.length} entity/entities short of parity.\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
