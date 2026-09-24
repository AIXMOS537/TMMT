// scripts/export-pii-archive.mjs
//
// Exports the personal documents held in the Airtable base to a local archive,
// so that the Airtable copies can later be deleted once counsel has answered the
// retention question in docs/COMPLIANCE-REMEDIATION-PLAN.md P1.
//
// ---------------------------------------------------------------------------
// THIS SCRIPT NEVER DELETES OR MODIFIES ANYTHING.
//
// It issues GET requests only. There is no code path in this file that performs
// a PATCH, POST, PUT or DELETE against Airtable. Deletion is a separate,
// owner-gated step that happens only after this archive is verified.
// ---------------------------------------------------------------------------
//
// WHAT IT COLLECTS
//   Background Checks : Driver's License, Paystub, Background Check Screenshot,
//                       Proof of Insurance   (~810 files across 304 records)
//   Insurance         : the LOGIN EMAIL / LOGIN PASSWORD / LOGIN PHONE fields,
//                       recorded so they can be confirmed empty before the
//                       columns are dropped. Values are hashed, never written
//                       in clear.
//
// USAGE
//   Step 1 - see what is there, download nothing:
//     node scripts/export-pii-archive.mjs
//
//   Step 2 - actually download (asks for an explicit flag):
//     node scripts/export-pii-archive.mjs --download --out "D:/tmmt-pii-archive"
//
// AFTERWARDS
//   The output folder contains personal data for ~304 people. Move it onto
//   encrypted storage, hold ONE copy, and do not leave it on a synced drive
//   (OneDrive, Syncthing, Dropbox). The script refuses to write into a folder
//   whose path looks synced.
//
// ENV
//   AIRTABLE_PAT   a token with read access to base appcenWUju039rD7b

import { createHash } from 'node:crypto'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const BASE_ID = 'appcenWUju039rD7b'
const PAT = process.env.AIRTABLE_PAT
const DOWNLOAD = process.argv.includes('--download')

const outArg = process.argv.indexOf('--out')
const OUT = outArg > -1 && process.argv[outArg + 1]
  ? path.resolve(process.argv[outArg + 1])
  : path.resolve('./pii-archive')

const TARGETS = [
  {
    table: 'Background Checks',
    attachmentFields: [
      "Driver's License",
      'Paystub',
      'Background Check Screenshot',
      'Proof of Insurance',
    ],
    // Used only to name folders. Never written into the manifest in clear.
    labelField: 'Name',
  },
  {
    table: 'Insurance',
    attachmentFields: [],
    // Recorded as present/absent + hash only. Never in clear.
    sensitiveTextFields: ['LOGIN EMAIL', 'LOGIN PASSWORD', 'LOGIN PHONE'],
    labelField: 'Name',
  },
]

// Refuse to write personal data into a folder that syncs to the cloud.
const SYNCED_HINTS = ['onedrive', 'dropbox', 'google drive', 'googledrive', '\\sync\\', '/sync/', 'icloud']

function assertSafeOutput(dir) {
  const lower = dir.toLowerCase().replace(/\//g, '\\')
  const hit = SYNCED_HINTS.find(h => lower.includes(h.replace(/\//g, '\\')))
  if (hit) {
    console.error(`
REFUSING TO WRITE THERE.

  ${dir}

  That path looks like a synced folder (matched "${hit.trim()}"). Writing 304
  people's driver's licences and paystubs into a folder that replicates to the
  cloud is the opposite of what this archive is for.

  Choose a local or external drive:  --out "D:/tmmt-pii-archive"
`)
    process.exit(1)
  }
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function safeName(s, fallback) {
  const cleaned = String(s ?? '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned.slice(0, 60) || fallback
}

async function airtable(pathname) {
  const res = await fetch(`https://api.airtable.com${pathname}`, {
    headers: { Authorization: `Bearer ${PAT}` },
  })
  if (!res.ok) {
    throw new Error(`Airtable ${res.status} on ${pathname}: ${(await res.text()).slice(0, 300)}`)
  }
  return res.json()
}

async function listRecords(table) {
  const all = []
  let offset
  do {
    const qs = new URLSearchParams({ pageSize: '100' })
    if (offset) qs.set('offset', offset)
    const data = await airtable(`/v0/${BASE_ID}/${encodeURIComponent(table)}?${qs}`)
    all.push(...data.records)
    offset = data.offset
    if (offset) await new Promise(r => setTimeout(r, 250)) // stay under the rate limit
  } while (offset)
  return all
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  const { size } = await stat(dest)
  return size
}

async function main() {
  if (!PAT) {
    console.error('Missing AIRTABLE_PAT. Set a token with read access to the base and re-run.')
    process.exit(1)
  }
  if (DOWNLOAD) assertSafeOutput(OUT)

  console.log(DOWNLOAD
    ? `Downloading personal documents to:\n  ${OUT}\n`
    : 'INVENTORY ONLY — nothing will be downloaded. Add --download to fetch.\n')

  const manifest = {
    generated_at: new Date().toISOString(),
    base_id: BASE_ID,
    mode: DOWNLOAD ? 'download' : 'inventory',
    note: 'Read-only export. This script never deletes or modifies Airtable data.',
    tables: [],
  }

  let grandTotal = 0

  for (const target of TARGETS) {
    process.stdout.write(`Reading "${target.table}" ... `)
    let records
    try {
      records = await listRecords(target.table)
    } catch (e) {
      console.log(`FAILED: ${e.message}`)
      manifest.tables.push({ table: target.table, error: e.message })
      continue
    }
    console.log(`${records.length} records`)

    const tableEntry = { table: target.table, record_count: records.length, fields: {}, files: [] }
    for (const f of target.attachmentFields) tableEntry.fields[f] = 0

    if (target.sensitiveTextFields) {
      tableEntry.sensitive_text_fields = {}
      for (const f of target.sensitiveTextFields) {
        const populated = records.filter(r => String(r.fields?.[f] ?? '').trim() !== '')
        tableEntry.sensitive_text_fields[f] = {
          populated_count: populated.length,
          // Hash only. The point is to prove what is there without copying it.
          value_hashes: populated.map(r => ({
            record_id: r.id,
            sha256: sha256(Buffer.from(String(r.fields[f]))),
          })),
        }
      }
    }

    for (const rec of records) {
      const label = safeName(rec.fields?.[target.labelField], rec.id)
      for (const field of target.attachmentFields) {
        const atts = rec.fields?.[field]
        if (!Array.isArray(atts) || atts.length === 0) continue
        tableEntry.fields[field] += atts.length
        grandTotal += atts.length

        for (const [i, att] of atts.entries()) {
          const entry = {
            record_id: rec.id,
            field,
            airtable_filename: att.filename,
            type: att.type,
            size_reported: att.size,
          }

          if (DOWNLOAD) {
            const dir = path.join(OUT, safeName(target.table, 'table'), `${label}__${rec.id}`)
            await mkdir(dir, { recursive: true })
            const ext = path.extname(att.filename || '') || ''
            const file = path.join(dir, `${safeName(field, 'field')}_${i + 1}${ext}`)
            try {
              entry.bytes_written = await download(att.url, file)
              entry.saved_as = path.relative(OUT, file)
            } catch (e) {
              entry.error = e.message
              console.log(`  ! ${rec.id} ${field}[${i}] — ${e.message}`)
            }
            await new Promise(r => setTimeout(r, 60))
          }
          tableEntry.files.push(entry)
        }
      }
    }
    manifest.tables.push(tableEntry)
  }

  manifest.total_attachments = grandTotal

  console.log('\n--- summary ---')
  for (const t of manifest.tables) {
    if (t.error) { console.log(`${t.table}: ERROR ${t.error}`); continue }
    console.log(`${t.table}: ${t.record_count} records`)
    for (const [f, n] of Object.entries(t.fields)) console.log(`   ${f}: ${n} files`)
    if (t.sensitive_text_fields) {
      for (const [f, v] of Object.entries(t.sensitive_text_fields)) {
        console.log(`   ${f}: ${v.populated_count} populated (values hashed, not copied)`)
      }
    }
  }
  console.log(`\nTotal personal-document attachments: ${grandTotal}`)

  if (DOWNLOAD) {
    await mkdir(OUT, { recursive: true })
    const mp = path.join(OUT, 'manifest.json')
    await writeFile(mp, JSON.stringify(manifest, null, 2))
    console.log(`\nArchive written to: ${OUT}`)
    console.log(`Manifest:           ${mp}`)
    console.log(`
NEXT, AND IN THIS ORDER:
  1. Verify the file count above matches the manifest.
  2. Move this folder onto encrypted storage. One copy. Not a synced drive.
  3. ONLY THEN consider deleting the Airtable copies -- and only for the records
     counsel has confirmed do not need retaining. See
     docs/COMPLIANCE-REMEDIATION-PLAN.md P1.`)
  } else {
    console.log('\nNothing was downloaded. Re-run with:')
    console.log('  node scripts/export-pii-archive.mjs --download --out "D:/tmmt-pii-archive"')
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
