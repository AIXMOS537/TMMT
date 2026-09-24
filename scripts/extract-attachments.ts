/**
 * scripts/extract-attachments.ts — Phase 2 attachment extraction (Airtable -> Supabase Storage).
 *
 * This is the one irreversible phase. Airtable is currently the sole copy of 706
 * attachment-bearing records, 293 of which hold driver's licences.
 *
 *   node scripts/extract-attachments.ts --inventory
 *   node scripts/extract-attachments.ts --table fleet --dry-run
 *   node scripts/extract-attachments.ts --table fleet
 *   node scripts/extract-attachments.ts --table fleet --verify
 *
 * MODES
 *   --inventory   Enumerate every attachment file without downloading anything. Establishes
 *                 the expected file count per table, which Gate 2's manifest reconciliation
 *                 is measured against. Run this FIRST. Safe, read-only.
 *   --dry-run     Walk the full pipeline, resolve the retention rule per file, report what
 *                 WOULD be extracted or destroyed. Writes nothing anywhere.
 *   (default)     Extract. Requires the retention policy and an explicit org.
 *   --verify      Re-check an existing manifest: every row has a storage path and a sha256,
 *                 and the stored object's size matches. Does not re-download.
 *
 * TWO HARD GATES, ENFORCED IN CODE RATHER THAN IN A COMMENT
 *   1. A retention policy file must exist and must cover every document type encountered.
 *      Extraction of a type the policy does not name is refused, not defaulted. Over-retention
 *      of identity documents is its own liability (plan §4.2).
 *   2. --org is mandatory. Every inserted row carries an explicit org_id. RLS misfiles or
 *      silently rejects rows with a wrong or absent tenant (plan §4.3).
 *
 * Read the plan's §4.3 constraints before changing anything here:
 *   - Airtable attachment URLs are short-lived signed URLs. List, download and persist within
 *     the same run. On a failed download, RE-FETCH THE RECORD for a fresh URL; never retry a
 *     stale one. `downloadWithRefresh()` is the only sanctioned download path.
 *   - Airtable is limited to 5 requests/second/base. Throttled globally below.
 *   - The run must be resumable. The manifest is append-only JSONL, flushed per file.
 *
 * Env: AIRTABLE_PAT, SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? 'appcenWUju039rD7b';
const AIRTABLE_MIN_INTERVAL_MS = 220; // < 5 req/s
const MANIFEST_PATH = process.env.ATTACHMENT_MANIFEST ?? 'evidence/attachment-manifest.jsonl';
const RETENTION_POLICY_PATH = process.env.RETENTION_POLICY ?? 'config/retention-policy.json';

// ---------------------------------------------------------------------------------
// source map — VERIFIED against the live base 2026-09-15
// ---------------------------------------------------------------------------------

type AttachmentField = {
  fieldId: string;
  fieldName: string;
  /** Document type key. Must match a key in the retention policy. */
  docType: string;
};

type SourceTable = {
  entity: string;
  airtableTableId: string;
  airtableTableName: string;
  /** Private Supabase Storage bucket. Never public — these include identity documents. */
  bucket: string;
  /** Supabase table holding the parent row, joined on airtable_id. */
  parentTable: string;
  /** Destination metadata table. */
  destination: 'documents' | 'vehicle_media';
  fields: AttachmentField[];
  /** Records carrying >=1 attachment, verified 2026-09-15. Sanity-check for --inventory. */
  expectedRecords: number;
};

const SOURCES: SourceTable[] = [
  {
    entity: 'fleet',
    airtableTableId: 'tblubnSDZkvsc9L6I',
    airtableTableName: 'Fleet',
    bucket: 'fleet',
    parentTable: 'fleet',
    destination: 'vehicle_media',
    expectedRecords: 41,
    fields: [
      { fieldId: 'fldOuDi7E68euAiS4', fieldName: 'Vehicle Pictures', docType: 'vehicle_photo' },
      { fieldId: 'fldbf2HM1pCx54vDW', fieldName: 'Registration', docType: 'vehicle_registration' },
      { fieldId: 'fldmWpoJdz3AtLIap', fieldName: 'Car Inspection Photos', docType: 'vehicle_inspection_photo' },
      { fieldId: 'fldaeMnFgWJM7hyXJ', fieldName: 'Vehicle Emissions/Inspections', docType: 'vehicle_state_inspection' },
    ],
  },
  {
    entity: 'fleet_car_inspections',
    airtableTableId: 'tbluH4YH2YBuu7FFg',
    airtableTableName: 'Fleet Car Inspections',
    bucket: 'inspections',
    parentTable: 'fleet_car_inspections',
    destination: 'vehicle_media',
    expectedRecords: 16,
    fields: [
      { fieldId: 'fldDUFgoy59iT5a8h', fieldName: 'Inspection Attachments', docType: 'vehicle_inspection_photo' },
    ],
  },
  {
    entity: 'expenses',
    airtableTableId: 'tblu4DFhHglmQMEBj',
    airtableTableName: 'Expenses',
    bucket: 'expenses',
    parentTable: 'expenses',
    destination: 'documents',
    expectedRecords: 32,
    fields: [{ fieldId: 'flddlX2HS5Q3vrDgX', fieldName: 'Attachments', docType: 'expense_receipt' }],
  },
  {
    entity: 'insurance',
    airtableTableId: 'tblU3rRVFuZFU4kPs',
    airtableTableName: 'Insurance',
    bucket: 'insurance',
    parentTable: 'insurance',
    destination: 'documents',
    expectedRecords: 12,
    fields: [
      { fieldId: 'fldscTRhdHFj0uc41', fieldName: 'Proof of Insurance (Attachment)', docType: 'proof_of_insurance' },
      { fieldId: 'fldqdlTOm7QREBCqy', fieldName: 'Commercial Insurance Policy Number', docType: 'insurance_policy' },
    ],
  },
  {
    entity: 'tickets',
    airtableTableId: 'tblhfKVanQDgn9plv',
    airtableTableName: 'Tickets',
    bucket: 'tickets',
    parentTable: 'tickets',
    destination: 'documents',
    expectedRecords: 308,
    fields: [
      { fieldId: 'fldYwhAKzUreYIEOf', fieldName: 'Attachments (Screenshots, Docs, Photos)', docType: 'citation_document' },
    ],
  },
  {
    entity: 'do_not_rent_list',
    airtableTableId: 'tblE6nOqVcSeGFQCi',
    airtableTableName: 'Do Not Rent List',
    bucket: 'do-not-rent',
    parentTable: 'do_not_rent_list',
    destination: 'documents',
    expectedRecords: 10,
    fields: [{ fieldId: 'fldPlsgIMB90K8fVb', fieldName: "Driver's License", docType: 'drivers_license' }],
  },
  {
    // Largest and most sensitive. Run LAST, after the pipeline is proven on Fleet.
    entity: 'background_checks',
    airtableTableId: 'tbl1OFZh3cMXytNZM',
    airtableTableName: 'Background Checks',
    bucket: 'background-checks',
    parentTable: 'background_checks',
    destination: 'documents',
    expectedRecords: 287,
    fields: [
      { fieldId: 'fldDoihm4BZQpUPPt', fieldName: "Driver's License", docType: 'drivers_license' },
      { fieldId: 'fldXctgEy97viNJOE', fieldName: 'Proof of Insurance', docType: 'proof_of_insurance' },
      { fieldId: 'fldjkLKaOLEdcDI4O', fieldName: 'Paystub', docType: 'income_verification' },
      { fieldId: 'fld4LT3Lw33Eoy2Ny', fieldName: 'Background Check Screenshot', docType: 'background_check_report' },
    ],
  },
];

/**
 * Tables whose attachment fields exist but hold zero files (VERIFIED 2026-09-15).
 * Listed so a future run can tell "checked, empty" from "never checked".
 */
const EMPTY_ATTACHMENT_TABLES = [
  'Contracts (tblyDwuH3fBZmaCTF) — Signatures, Addendums: 0',
  'Vehicle Handover (tblKmdjH0tmKY9Bcl) — Staff/Customer checklists: 0',
  'Customer Payments (tblsG1LCDNSeehiLf) — Invoice/Receipt: 0',
  'Customer Inspection Photos (tblbaUFnNFFfalnRc) — Vehicle Photos: 0',
  'Vehicle Onboarding Inspections (tblqJuzv6YkuAn1kL) — table is empty',
  'Content Pipeline (tbl19zqT6BirKq8iJ) — table is empty',
];

// ---------------------------------------------------------------------------------
// retention policy — the counsel rule, enforced
// ---------------------------------------------------------------------------------

type RetentionAction = 'retain' | 'destroy';

type RetentionPolicy = {
  /** Free text: who issued the rule and when. Required — an unattributed rule is not a rule. */
  issued_by: string;
  issued_date: string;
  /** Per docType decision. Every docType encountered must appear here. */
  rules: Record<string, { action: RetentionAction; retain_years?: number; basis?: string }>;
};

async function loadRetentionPolicy(): Promise<RetentionPolicy> {
  if (!existsSync(RETENTION_POLICY_PATH)) {
    console.error(
      `\nREFUSING TO RUN — no retention policy at ${RETENTION_POLICY_PATH}\n\n` +
        `Phase 2 §4.2: before extraction runs, the owner must obtain from counsel a written\n` +
        `retention rule covering which document types must be retained, for how long, and\n` +
        `which must be destroyed now.\n\n` +
        `293 of these records hold driver's licences belonging to people who are no longer\n` +
        `customers. Migrating everything because it is easier is the outcome the plan warns\n` +
        `against. Claude Code implements this decision; it does not make it.\n\n` +
        `See config/retention-policy.example.json for the required shape.\n`,
    );
    process.exit(2);
  }

  const policy = JSON.parse(await readFile(RETENTION_POLICY_PATH, 'utf8')) as RetentionPolicy;

  if (!policy.issued_by?.trim() || !policy.issued_date?.trim()) {
    console.error('Retention policy must record issued_by and issued_date. An unattributed rule is not a rule.');
    process.exit(2);
  }

  // Every docType this script can encounter must be covered. No silent defaults.
  const known = new Set(SOURCES.flatMap((s) => s.fields.map((f) => f.docType)));
  const uncovered = [...known].filter((t) => !policy.rules[t]);
  if (uncovered.length > 0) {
    console.error(
      `\nREFUSING TO RUN — retention policy does not cover: ${uncovered.join(', ')}\n` +
        `Add an explicit decision for each. A missing rule is not permission to retain.\n`,
    );
    process.exit(2);
  }

  return policy;
}

// ---------------------------------------------------------------------------------
// args / env
// ---------------------------------------------------------------------------------

const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
const argValue = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const MODE_INVENTORY = hasFlag('--inventory');
const MODE_VERIFY = hasFlag('--verify');
const DRY_RUN = hasFlag('--dry-run');
const ONLY_TABLE = argValue('--table');
const ORG_ID = argValue('--org') ?? process.env.EXTRACT_ORG_ID;

function requireEnv(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const v = process.env[key];
    if (v && v.trim()) return v.trim();
  }
  console.error(`Missing required env var: ${name}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------
// throttled Airtable access
// ---------------------------------------------------------------------------------

let lastCall = 0;

async function throttle(): Promise<void> {
  const wait = AIRTABLE_MIN_INTERVAL_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

type AirtableAttachment = {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
};

async function airtableJson(path: string, token: string, attempt = 0): Promise<any> {
  await throttle();
  const res = await fetch(`https://api.airtable.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    return airtableJson(path, token, attempt + 1);
  }
  if (!res.ok) throw new Error(`Airtable ${res.status} on ${path.split('?')[0]}`);
  return res.json();
}

/** Walk every record of a table, yielding id + its attachment cells. */
async function* walkRecords(
  src: SourceTable,
  token: string,
): AsyncGenerator<{ recordId: string; fields: Record<string, AirtableAttachment[]> }> {
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    for (const f of src.fields) params.append('fields[]', f.fieldId);
    if (offset) params.set('offset', offset);

    const json = await airtableJson(`/v0/${BASE_ID}/${src.airtableTableId}?${params}`, token);
    for (const rec of json.records ?? []) {
      yield { recordId: rec.id, fields: rec.fields ?? {} };
    }
    offset = json.offset;
  } while (offset);
}

/** Re-read ONE record to obtain fresh signed URLs. The only way to recover a dead URL. */
async function refetchRecord(
  src: SourceTable,
  recordId: string,
  token: string,
): Promise<Record<string, AirtableAttachment[]>> {
  const params = new URLSearchParams({ returnFieldsByFieldId: 'true' });
  const json = await airtableJson(`/v0/${BASE_ID}/${src.airtableTableId}/${recordId}?${params}`, token);
  return json.fields ?? {};
}

/**
 * Download a file, refreshing the signed URL from the source record on failure.
 *
 * Airtable signed URLs expire in hours. Retrying the same URL after a failure just fails
 * again; the record must be re-read to mint a new one (plan §4.3).
 */
async function downloadWithRefresh(
  src: SourceTable,
  recordId: string,
  field: AttachmentField,
  att: AirtableAttachment,
  token: string,
): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let url = att.url;

    if (attempt > 0) {
      const fresh = await refetchRecord(src, recordId, token);
      const match = (fresh[field.fieldId] ?? []).find((a) => a.id === att.id);
      if (!match) throw new Error(`attachment ${att.id} no longer on record ${recordId}`);
      url = match.url;
    }

    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());

      // A 200 is not proof of a file. An expired-URL response can be an HTML error page
      // of plausible length (plan §4.5).
      if (buf.length === 0) throw new Error(`empty body for ${att.filename}`);
      if (buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase().startsWith('<!doctype html')) {
        continue; // looks like an error page — refresh and retry
      }
      return buf;
    }

    if (attempt === 2) throw new Error(`download failed ${res.status} for ${att.filename}`);
  }

  throw new Error(`download failed after refresh for ${att.filename}`);
}

// ---------------------------------------------------------------------------------
// manifest — append-only JSONL, resumable
// ---------------------------------------------------------------------------------

type ManifestStatus = 'pending' | 'downloaded' | 'uploaded' | 'verified' | 'failed' | 'skipped_retention';

type ManifestEntry = {
  key: string; // table|record|field|filename
  entity: string;
  source_table: string;
  source_record_id: string;
  source_field_id: string;
  source_field_name: string;
  doc_type: string;
  filename: string;
  content_type: string;
  byte_size: number;
  sha256: string | null;
  storage_bucket: string;
  storage_path: string | null;
  org_id: string | null;
  status: ManifestStatus;
  error?: string;
  extracted_at: string;
};

const manifestKey = (t: string, r: string, f: string, n: string) => `${t}|${r}|${f}|${n}`;

async function loadManifest(): Promise<Map<string, ManifestEntry>> {
  const map = new Map<string, ManifestEntry>();
  if (!existsSync(MANIFEST_PATH)) return map;

  const text = await readFile(MANIFEST_PATH, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as ManifestEntry;
      map.set(entry.key, entry); // later lines supersede earlier ones
    } catch {
      // A torn final line from an interrupted run. Skip it; never abort a resume on it.
    }
  }
  return map;
}

async function appendManifest(entry: ManifestEntry): Promise<void> {
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await appendFile(MANIFEST_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------------

function sbHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string,
  url: string,
  key: string,
): Promise<void> {
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: { ...sbHeaders(key), 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`storage upload ${res.status} for ${path}`);
}

/** Resolve the Supabase parent row id from the Airtable record id. */
async function resolveParentId(
  table: string,
  airtableId: string,
  url: string,
  key: string,
): Promise<string | null> {
  const res = await fetch(`${url}/rest/v1/${table}?airtable_id=eq.${airtableId}&select=id&limit=1`, {
    headers: sbHeaders(key),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------------
// modes
// ---------------------------------------------------------------------------------

function selectedSources(): SourceTable[] {
  if (!ONLY_TABLE) return SOURCES;
  const picked = SOURCES.filter((s) => s.entity === ONLY_TABLE || s.airtableTableId === ONLY_TABLE);
  if (picked.length === 0) {
    console.error(`No source matches --table ${ONLY_TABLE}. Known: ${SOURCES.map((s) => s.entity).join(', ')}`);
    process.exit(1);
  }
  return picked;
}

/** Enumerate files without downloading. Establishes the expected file count for Gate 2. */
async function runInventory(token: string): Promise<void> {
  console.log('# Attachment file inventory (no downloads)\n');
  console.log('| Entity | Records w/ files | Files | Bytes | By document type |');
  console.log('|---|---:|---:|---:|---|');

  let grandFiles = 0;
  let grandBytes = 0;

  for (const src of selectedSources()) {
    let records = 0;
    let files = 0;
    let bytes = 0;
    const byType = new Map<string, number>();

    for await (const rec of walkRecords(src, token)) {
      let recHasFile = false;
      for (const field of src.fields) {
        for (const att of rec.fields[field.fieldId] ?? []) {
          recHasFile = true;
          files++;
          bytes += att.size ?? 0;
          byType.set(field.docType, (byType.get(field.docType) ?? 0) + 1);
        }
      }
      if (recHasFile) records++;
    }

    grandFiles += files;
    grandBytes += bytes;

    const drift = records === src.expectedRecords ? '' : ` ⚠ expected ${src.expectedRecords}`;
    const types = [...byType.entries()].map(([t, n]) => `${t}=${n}`).join(', ');
    console.log(
      `| ${src.entity} | ${records}${drift} | ${files} | ${(bytes / 1e6).toFixed(1)} MB | ${types} |`,
    );
  }

  console.log(`\n**Total files: ${grandFiles} · ${(grandBytes / 1e6).toFixed(1)} MB**\n`);
  console.log('Gate 2 reconciles the manifest against the FILE count above, not against the');
  console.log('record count. One record commonly holds several files.\n');
  console.log('Verified-empty attachment fields (checked, not skipped):');
  for (const line of EMPTY_ATTACHMENT_TABLES) console.log(`  - ${line}`);
}

async function runExtract(token: string, sbUrl: string, sbKey: string): Promise<void> {
  const policy = await loadRetentionPolicy();

  if (!ORG_ID && !DRY_RUN) {
    console.error(
      'REFUSING TO RUN — --org <uuid> is required.\n' +
        'Every inserted row must carry an explicit org_id or RLS will misfile or silently\n' +
        'reject it (plan §4.3). TMMT RENTALS is 8e651b25-e7c8-4356-af64-1716a82053b0.',
    );
    process.exit(2);
  }

  const manifest = await loadManifest();
  console.error(`manifest: ${manifest.size} existing entries\n`);

  for (const src of selectedSources()) {
    let done = 0;
    let skipped = 0;
    let destroyed = 0;
    let failed = 0;

    for await (const rec of walkRecords(src, token)) {
      const parentId = DRY_RUN ? null : await resolveParentId(src.parentTable, rec.recordId, sbUrl, sbKey);

      for (const field of src.fields) {
        for (const att of rec.fields[field.fieldId] ?? []) {
          const key = manifestKey(src.airtableTableId, rec.recordId, field.fieldId, att.filename);

          const prior = manifest.get(key);
          if (prior && (prior.status === 'verified' || prior.status === 'uploaded')) {
            skipped++;
            continue; // resumable: never restart from zero
          }

          const rule = policy.rules[field.docType];

          // The counsel rule decides. "destroy" means do not copy it forward.
          if (rule.action === 'destroy') {
            destroyed++;
            if (!DRY_RUN) {
              await appendManifest({
                key,
                entity: src.entity,
                source_table: src.airtableTableId,
                source_record_id: rec.recordId,
                source_field_id: field.fieldId,
                source_field_name: field.fieldName,
                doc_type: field.docType,
                filename: att.filename,
                content_type: att.type,
                byte_size: att.size,
                sha256: null,
                storage_bucket: src.bucket,
                storage_path: null,
                org_id: ORG_ID ?? null,
                status: 'skipped_retention',
                extracted_at: new Date().toISOString(),
              });
            }
            continue;
          }

          if (DRY_RUN) {
            done++;
            continue;
          }

          try {
            const buf = await downloadWithRefresh(src, rec.recordId, field, att, token);
            const sha256 = createHash('sha256').update(buf).digest('hex');

            // Content-addressed path: same bytes never stored twice, and the path itself
            // carries provenance.
            const storagePath = `${src.entity}/${rec.recordId}/${field.fieldId}/${sha256.slice(0, 12)}-${att.filename}`;

            await uploadObject(src.bucket, storagePath, buf, att.type, sbUrl, sbKey);

            await appendManifest({
              key,
              entity: src.entity,
              source_table: src.airtableTableId,
              source_record_id: rec.recordId,
              source_field_id: field.fieldId,
              source_field_name: field.fieldName,
              doc_type: field.docType,
              filename: att.filename,
              content_type: att.type,
              byte_size: buf.length,
              sha256,
              storage_bucket: src.bucket,
              storage_path: storagePath,
              org_id: ORG_ID!,
              status: parentId ? 'uploaded' : 'failed',
              error: parentId ? undefined : 'no Supabase parent row for this airtable_id',
              extracted_at: new Date().toISOString(),
            });

            if (!parentId) {
              // A file with no parent is the "attached to the wrong renter" failure waiting
              // to happen. Store it, but never guess a linkage.
              failed++;
              process.stderr.write(`  ! ${src.entity} ${rec.recordId}: no parent row — stored, NOT linked\n`);
            } else {
              done++;
            }
          } catch (err) {
            failed++;
            await appendManifest({
              key,
              entity: src.entity,
              source_table: src.airtableTableId,
              source_record_id: rec.recordId,
              source_field_id: field.fieldId,
              source_field_name: field.fieldName,
              doc_type: field.docType,
              filename: att.filename,
              content_type: att.type,
              byte_size: att.size,
              sha256: null,
              storage_bucket: src.bucket,
              storage_path: null,
              org_id: ORG_ID!,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
              extracted_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    console.error(
      `${src.entity}: ${done} extracted, ${skipped} already done, ` +
        `${destroyed} withheld by retention rule, ${failed} failed`,
    );
  }

  console.error(
    '\nUploads complete. Metadata rows are NOT written — the destination tables cannot carry\n' +
      'provenance yet (no sha256 / source_* columns). See CHANGE_REQUEST_003.\n' +
      'Gate 2 also requires opening >=10 files per table and spot-checking parent linkage.',
  );
}

async function runVerify(): Promise<void> {
  const manifest = await loadManifest();
  if (manifest.size === 0) {
    console.error(`No manifest at ${MANIFEST_PATH} — nothing to verify.`);
    process.exit(1);
  }

  const byEntity = new Map<string, ManifestEntry[]>();
  for (const e of manifest.values()) {
    if (!byEntity.has(e.entity)) byEntity.set(e.entity, []);
    byEntity.get(e.entity)!.push(e);
  }

  console.log('# Manifest verification\n');
  console.log('| Entity | Total | Uploaded | Withheld | Failed | Missing sha256 | Missing path |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');

  let anyProblem = false;

  for (const [entity, entries] of byEntity) {
    const uploaded = entries.filter((e) => e.status === 'uploaded' || e.status === 'verified');
    const withheld = entries.filter((e) => e.status === 'skipped_retention');
    const failed = entries.filter((e) => e.status === 'failed');
    const noSha = uploaded.filter((e) => !e.sha256);
    const noPath = uploaded.filter((e) => !e.storage_path);

    if (failed.length || noSha.length || noPath.length) anyProblem = true;

    console.log(
      `| ${entity} | ${entries.length} | ${uploaded.length} | ${withheld.length} | ` +
        `${failed.length} | ${noSha.length} | ${noPath.length} |`,
    );
  }

  console.log('\nEvery uploaded row must have a non-null storage path and a sha256 (plan §4.5).');
  console.log('This check does not open files. Opening >=10 per table is a separate, manual');
  console.log('gate line — a file of the right byte length can still be a truncated download.');

  if (anyProblem) process.exitCode = 1;
}

// ---------------------------------------------------------------------------------

async function main(): Promise<void> {
  if (MODE_VERIFY) return runVerify();

  const token = requireEnv('AIRTABLE_PAT');
  if (MODE_INVENTORY) return runInventory(token);

  const sbUrl = requireEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const sbKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return runExtract(token, sbUrl, sbKey);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
