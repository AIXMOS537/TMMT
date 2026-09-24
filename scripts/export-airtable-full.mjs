// scripts/export-airtable-full.mjs
//
// Captures the ENTIRE Airtable base -- structure and data -- into the repo, so
// that nothing is lost when Airtable is eventually switched off.
//
// This is the companion to export-pii-archive.mjs:
//   export-airtable-full.mjs   ->  how it works + every record   (this file)
//   export-pii-archive.mjs     ->  the attached documents themselves
//
// ---------------------------------------------------------------------------
// READ-ONLY. GET requests only. There is no write verb in this file.
// ---------------------------------------------------------------------------
//
// WHAT IT CAPTURES
//   schema.json    every table, every field, field types, select options,
//                  formulas, linked-record relationships -- "how Airtable works"
//   <table>.json   every record, verbatim
//   <table>.csv    the same, openable in Excel
//   RELATIONSHIPS.md  a readable map of which table links to which
//   README.md      what this archive is and how to read it
//
// TWO MODES
//   Default is SAFE: schema only, plus row counts. No customer data leaves
//   Airtable. Run this first -- it tells you the shape of everything.
//
//     node scripts/export-airtable-full.mjs
//
//   Full export includes the records themselves, which means personal data:
//
//     node scripts/export-airtable-full.mjs --records --out "D:/tmmt-archive"
//
//   Attachment FIELDS are captured as metadata (filename, size, type) but the
//   files themselves are NOT downloaded here -- use export-pii-archive.mjs for
//   those, so the sensitive documents land in one deliberate place.
//
// ENV
//   AIRTABLE_PAT   a token with read access to base appcenWUju039rD7b

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appcenWUju039rD7b'
const PAT = process.env.AIRTABLE_PAT
const WITH_RECORDS = process.argv.includes('--records')

const outArg = process.argv.indexOf('--out')
const OUT = outArg > -1 && process.argv[outArg + 1]
  ? path.resolve(process.argv[outArg + 1])
  : path.resolve('./airtable-archive')

const SYNCED_HINTS = ['onedrive', 'dropbox', 'google drive', 'googledrive', '\\sync\\', 'icloud']

function assertSafeOutput(dir) {
  const lower = dir.toLowerCase().replace(/\//g, '\\')
  const hit = SYNCED_HINTS.find(h => lower.includes(h.replace(/\//g, '\\')))
  if (hit) {
    console.error(`
REFUSING TO WRITE THERE.

  ${dir}

  That looks like a synced folder (matched "${hit.trim()}"). A full record export
  contains customer names, phone numbers and addresses. Put it on a local or
  external drive:  --out "D:/tmmt-archive"
`)
    process.exit(1)
  }
}

async function airtable(pathname) {
  const res = await fetch(`https://api.airtable.com${pathname}`, {
    headers: { Authorization: `Bearer ${PAT}` },
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    if (res.status === 401) {
      throw new Error(`401 Unauthorized. The token is invalid or expired -- create a fresh personal access token with read scope on this base. (${body})`)
    }
    throw new Error(`Airtable ${res.status}: ${body}`)
  }
  return res.json()
}

async function getSchema() {
  const { tables } = await airtable(`/v0/meta/bases/${BASE_ID}/tables`)
  return tables
}

async function getRecords(tableId) {
  const all = []
  let offset
  do {
    const qs = new URLSearchParams({ pageSize: '100' })
    if (offset) qs.set('offset', offset)
    const data = await airtable(`/v0/${BASE_ID}/${tableId}?${qs}`)
    all.push(...data.records)
    offset = data.offset
    await new Promise(r => setTimeout(r, 250)) // rate limit: 5 req/sec
  } while (offset)
  return all
}

// Attachment values are replaced with metadata only -- filename, size, type.
// The URLs are short-lived and the files belong in the PII archive, not here.
function stripAttachmentUrls(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'url' in v[0] && 'filename' in v[0]) {
      out[k] = v.map(a => ({ filename: a.filename, size: a.size, type: a.type, id: a.id }))
      out[`${k} __note`] = 'attachment metadata only -- files are in the PII archive'
    } else {
      out[k] = v
    }
  }
  return out
}

function toCsv(records) {
  const cols = new Set(['__record_id'])
  for (const r of records) for (const k of Object.keys(r.fields)) cols.add(k)
  const headers = [...cols]
  const cell = v => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(cell).join(',')]
  for (const r of records) {
    lines.push(headers.map(h => cell(h === '__record_id' ? r.id : r.fields[h])).join(','))
  }
  return lines.join('\r\n')
}

function safeName(s) {
  return String(s).replace(/[^a-zA-Z0-9._ -]+/g, '_').trim().replace(/\s+/g, '-').slice(0, 80)
}

function relationshipMap(tables) {
  const byId = new Map(tables.map(t => [t.id, t.name]))
  const lines = [
    '# Airtable relationships',
    '',
    'Which table links to which. Generated from the live base schema.',
    '',
    '```mermaid',
    'erDiagram',
  ]
  const seen = new Set()
  for (const t of tables) {
    for (const f of t.fields) {
      if (f.type !== 'multipleRecordLinks') continue
      const other = byId.get(f.options?.linkedTableId)
      if (!other) continue
      const a = safeName(t.name).replace(/-/g, '_')
      const b = safeName(other).replace(/-/g, '_')
      const key = [a, b].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(`    ${a} }o--o{ ${b} : "${f.name}"`)
    }
  }
  lines.push('```', '')
  lines.push('## Link fields, in full', '')
  lines.push('| Table | Field | Links to |', '|---|---|---|')
  for (const t of tables) {
    for (const f of t.fields) {
      if (f.type !== 'multipleRecordLinks') continue
      lines.push(`| ${t.name} | ${f.name} | ${byId.get(f.options?.linkedTableId) ?? '(unknown)'} |`)
    }
  }
  return lines.join('\n')
}

async function main() {
  if (!PAT) {
    console.error('Missing AIRTABLE_PAT. Create a read-scoped personal access token and re-run.')
    process.exit(1)
  }
  if (WITH_RECORDS) assertSafeOutput(OUT)

  console.log(WITH_RECORDS
    ? `FULL EXPORT (structure + every record) -> ${OUT}\n`
    : 'STRUCTURE ONLY. No customer data will be written. Add --records for a full export.\n')

  const tables = await getSchema()
  console.log(`Base ${BASE_ID}: ${tables.length} tables\n`)

  await mkdir(OUT, { recursive: true })
  await writeFile(path.join(OUT, 'schema.json'), JSON.stringify({ base_id: BASE_ID, exported_at: new Date().toISOString(), tables }, null, 2))
  await writeFile(path.join(OUT, 'RELATIONSHIPS.md'), relationshipMap(tables))

  const summary = []
  for (const t of tables) {
    const attachmentFields = t.fields.filter(f => f.type === 'multipleAttachments').map(f => f.name)
    const aiFields = t.fields.filter(f => f.type === 'aiText').map(f => f.name)
    const linkFields = t.fields.filter(f => f.type === 'multipleRecordLinks').map(f => f.name)

    let count = null
    if (WITH_RECORDS) {
      process.stdout.write(`  ${t.name} ... `)
      try {
        const records = await getRecords(t.id)
        count = records.length
        const clean = records.map(r => ({ id: r.id, createdTime: r.createdTime, fields: stripAttachmentUrls(r.fields) }))
        const base = path.join(OUT, 'tables', safeName(t.name))
        await mkdir(path.dirname(base), { recursive: true })
        await writeFile(`${base}.json`, JSON.stringify(clean, null, 2))
        await writeFile(`${base}.csv`, toCsv(clean))
        console.log(`${count} records`)
      } catch (e) {
        console.log(`FAILED: ${e.message}`)
      }
    }

    summary.push({
      table: t.name, id: t.id, field_count: t.fields.length, record_count: count,
      attachment_fields: attachmentFields, ai_fields: aiFields, link_fields: linkFields,
    })
  }

  const readme = [
    '# Airtable archive',
    '',
    `Base \`${BASE_ID}\` · exported ${new Date().toISOString().slice(0, 10)} · ${tables.length} tables`,
    '',
    WITH_RECORDS
      ? '**Contains customer data.** Keep encrypted, keep one copy, do not put on a synced drive.'
      : '**Structure only.** No customer data in this export.',
    '',
    '| File | What |',
    '|---|---|',
    '| `schema.json` | Every table and field, with types and options. The definitive record of how the base worked |',
    '| `RELATIONSHIPS.md` | Which table links to which, as a diagram and a table |',
    '| `tables/*.json` | Every record, verbatim |',
    '| `tables/*.csv` | The same, for Excel |',
    '',
    'Attachment fields hold **metadata only** here (filename, size, type). The files',
    'themselves are exported separately by `export-pii-archive.mjs`, so that sensitive',
    'documents land in exactly one place.',
    '',
    '## Tables',
    '',
    '| Table | Fields | Records | Attachments | AI fields | Links |',
    '|---|---:|---:|---|---|---|',
    ...summary.map(s => `| ${s.table} | ${s.field_count} | ${s.record_count ?? '—'} | ${s.attachment_fields.join(', ') || '—'} | ${s.ai_fields.join(', ') || '—'} | ${s.link_fields.length || '—'} |`),
  ].join('\n')

  await writeFile(path.join(OUT, 'README.md'), readme)

  console.log(`\n--- ${tables.length} tables captured ---`)
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(34)} ${String(s.field_count).padStart(3)} fields${s.record_count !== null ? `  ${String(s.record_count).padStart(5)} records` : ''}`)
  }
  console.log(`\nWritten to: ${OUT}`)
  if (!WITH_RECORDS) {
    console.log('\nStructure only. For everything including records:')
    console.log('  node scripts/export-airtable-full.mjs --records --out "D:/tmmt-archive"')
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
