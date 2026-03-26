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

async function listBases() {
  const { bases } = await airtableFetch('/v0/meta/bases')
  return bases
}

async function listTables(baseId) {
  const { tables } = await airtableFetch(`/v0/meta/bases/${baseId}/tables`)
  return tables
}

async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')

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

  console.log(`Matched ${tableMap.size}/${MAIN_TABLES.length} tables from Airtable`)
  for (const [name] of tableMap) console.log(' -', name)
}

main().catch(e => { console.error(e.message); process.exit(1) })
