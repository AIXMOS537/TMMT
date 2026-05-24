// scripts/sync-airtable.mjs
import { createClient } from '@supabase/supabase-js'

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!AIRTABLE_PAT || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars: AIRTABLE_PAT, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const MAIN_TABLES = [
  'fleet', 'incoming_leads', 'background_checks', 'waitlist', 'appointments',
  'active_customers', 'payments', 'tickets', 'expenses', 'insurance',
  'customer_inspection_photos', 'maintenance', 'contracts', 'vendors',
  'operation_costs', 'do_not_rent', 'former_customers', 'vehicle_handovers'
]

const JUNCTION_TABLES = [
  'fleet_active_customers', 'fleet_background_checks', 'fleet_contracts',
  'fleet_customer_inspection_photos', 'fleet_insurance', 'fleet_maintenance',
  'fleet_payments', 'fleet_tickets', 'fleet_vehicle_handovers',
  'active_customers_payments', 'active_customers_tickets', 'active_customers_contracts',
  'active_customers_inspection', 'background_checks_fleet', 'incoming_leads_appointments',
  'waitlist_appointments', 'insurance_fleet', 'maintenance_vendors', 'expenses_vendors'
]

const SKIP_COLS = new Set(['id', 'created_at', 'updated_at'])

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function airtableFetch(path) {
  await sleep(250)
  const res = await fetch(`https://api.airtable.com${path}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  })
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

function toSnake(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

async function fetchSupabaseSchema() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  })
  if (!res.ok) throw new Error(`Failed to fetch Supabase schema: ${res.status}`)
  const spec = await res.json()
  const schemaMap = new Map()
  for (const [name, def] of Object.entries(spec.definitions ?? {})) {
    if (def.properties) {
      const cols = new Set(Object.keys(def.properties))
      const arrayCols = new Set(
        Object.entries(def.properties)
          .filter(([, p]) => p.type === 'array')
          .map(([k]) => k)
      )
      schemaMap.set(name, { cols, arrayCols })
    }
  }
  return schemaMap
}

async function listBases() {
  const { bases } = await airtableFetch('/v0/meta/bases')
  return bases
}

async function listTables(baseId) {
  const { tables } = await airtableFetch(`/v0/meta/bases/${baseId}/tables`)
  return tables
}

async function fetchRecords(baseId, tableId) {
  const all = []
  let offset
  do {
    const qs = new URLSearchParams({ pageSize: '100' })
    if (offset) qs.set('offset', offset)
    const data = await airtableFetch(`/v0/${baseId}/${tableId}?${qs}`)
    all.push(...data.records)
    offset = data.offset
  } while (offset)
  return all
}

function mapFields(record, tableSchema) {
  const knownCols = tableSchema?.cols
  const arrayCols = tableSchema?.arrayCols
  const row = { airtable_id: record.id }
  for (const [key, val] of Object.entries(record.fields)) {
    const col = toSnake(key)
    if (SKIP_COLS.has(col)) continue
    if (knownCols && !knownCols.has(col)) continue
    if (arrayCols?.has(col)) {
      // Column is text[] — ensure value is always a native array
      row[col] = Array.isArray(val) ? val : [String(val)]
    } else {
      // Non-array column: join Airtable linked-record arrays as comma string
      row[col] = Array.isArray(val) ? val.join(', ') : val
    }
  }
  return row
}

async function clearTable(name) {
  const { error } = await supabase
    .from(name)
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(error.message)
}

async function insertRows(name, rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(name).insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
  }
}

async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')

  const schemaMap = await fetchSupabaseSchema()

  const bases = await listBases()
  const tableMap = new Map()
  for (const base of bases) {
    const tables = await listTables(base.id)
    for (const t of tables) {
      const name = toSnake(t.name)
      if (MAIN_TABLES.includes(name) && !tableMap.has(name)) {
        tableMap.set(name, { baseId: base.id, tableId: t.id })
      }
    }
  }

  if (!DRY_RUN) {
    for (const jt of JUNCTION_TABLES) {
      try { await clearTable(jt) } catch (e) { console.warn(`  ⚠ junction clear skipped: ${jt} — ${e.message}`) }
    }
  }

  let synced = 0, failed = 0, totalRecords = 0
  const lines = []

  for (const name of MAIN_TABLES) {
    const entry = tableMap.get(name)
    if (!entry) {
      lines.push(`  - ${name.padEnd(38)} SKIPPED (not found in Airtable)`)
      continue
    }
    try {
      const records = await fetchRecords(entry.baseId, entry.tableId)
      const tableSchema = schemaMap.get(name)
      const rows = records.map(r => mapFields(r, tableSchema))
      if (!DRY_RUN) {
        await clearTable(name)
        try {
          await insertRows(name, rows)
        } catch (insertErr) {
          lines.push(`  ✗ ${name.padEnd(38)} FAILED (TABLE IS NOW EMPTY): ${insertErr.message}`)
          failed++
          continue
        }
      }
      lines.push(`  ✓ ${name.padEnd(38)} ${rows.length} records`)
      synced++
      totalRecords += rows.length
    } catch (e) {
      lines.push(`  ✗ ${name.padEnd(38)} FAILED: ${e.message}`)
      failed++
    }
  }

  lines.forEach(l => console.log(l))
  console.log(`\nSync complete: ${synced}/${MAIN_TABLES.length} tables | ${totalRecords} records | ${failed} failed`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
