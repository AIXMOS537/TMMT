# Airtable → Supabase Sync Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone CLI script that pulls all records from 3 Airtable bases and upserts them into Supabase, treating Airtable as source of truth.

**Architecture:** Single ESM script (`scripts/sync-airtable.mjs`) with no new dependencies — uses built-in `fetch` and the already-installed `@supabase/supabase-js`. Discovers Airtable tables dynamically via the metadata API, maps field names to snake_case, clears junction tables then main tables, and batch-inserts fresh data. A `--dry-run` flag lets you preview without writing.

**Tech Stack:** Node.js 20+ ESM, Airtable REST + Metadata API, Supabase JS v2, `--env-file` for env loading

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/sync-airtable.mjs` | **Create** | Entire sync script — env validation, Airtable API helpers, discovery, fetch, field mapping, Supabase clear + insert, orchestrator, report |
| `.env` | **Modify** | Add `AIRTABLE_PAT` key |

---

## Task 1: Add AIRTABLE_PAT to .env

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add the env key**

Open `.env` and add this line (replace the token with your actual PAT):

```
AIRTABLE_PAT=pat8mah6kKOJVxLMX.f4d3384f36fca9d768f2cf3a75e3aae9f9a68b6c0042ce6327eb2cd5e9a059b1
```

> **Security note:** Rotate this token at airtable.com/account after the sync — it was shared in plain text. Generate a new PAT and update `.env`.

- [ ] **Step 2: Verify .env is gitignored**

```bash
cat .gitignore | grep env
```

Expected output includes `.env*` or `.env`.

- [ ] **Step 3: Commit nothing** — `.env` is gitignored, no commit needed.

---

## Task 2: Scaffold the script with env validation

**Files:**
- Create: `scripts/sync-airtable.mjs`

- [ ] **Step 1: Create the scripts directory and file**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Create `scripts/sync-airtable.mjs` with env validation and constants**

```js
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

async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')
}

main().catch(e => { console.error(e.message); process.exit(1) })
```

- [ ] **Step 3: Verify it runs without crashing**

```bash
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

Expected output:
```
[dry-run] sync starting...
```

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: scaffold sync-airtable.mjs with env validation and constants"
```

---

## Task 3: Add Airtable API helper + snake_case utility

**Files:**
- Modify: `scripts/sync-airtable.mjs`

- [ ] **Step 1: Add `sleep`, `airtableFetch`, and `toSnake` after the constants block (before the `main` function)**

```js
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
```

- [ ] **Step 2: Smoke-test the helper inside `main` temporarily**

Replace `main()` body with:

```js
async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')
  const data = await airtableFetch('/v0/meta/bases')
  console.log('Bases found:', data.bases.map(b => b.name))
}
```

- [ ] **Step 3: Run and verify Airtable connectivity**

```bash
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

Expected output (your 3 base names):
```
[dry-run] sync starting...

Bases found: [ 'TMMT Rentals', 'TMMT OS', 'TMMT Rentals (Copy)' ]
```

If you see an auth error, verify `AIRTABLE_PAT` is set correctly in `.env`.

- [ ] **Step 4: Revert `main` back to just the console.log line** (smoke test is done)

```js
async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: add airtableFetch helper with 250ms rate limit and toSnake utility"
```

---

## Task 4: Add base + table discovery

**Files:**
- Modify: `scripts/sync-airtable.mjs`

- [ ] **Step 1: Add `listBases` and `listTables` after `toSnake`**

```js
async function listBases() {
  const { bases } = await airtableFetch('/v0/meta/bases')
  return bases // [{ id, name, permissionLevel }]
}

async function listTables(baseId) {
  const { tables } = await airtableFetch(`/v0/meta/bases/${baseId}/tables`)
  return tables // [{ id, name, fields: [{ id, name, type }] }]
}
```

- [ ] **Step 2: Add discovery + table matching inside `main`**

```js
async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')

  const bases = await listBases()

  // Build map: snake_case table name → { baseId, tableId }
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
```

- [ ] **Step 3: Run and verify table discovery**

```bash
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

Expected (example — actual count depends on what's in Airtable):
```
[dry-run] sync starting...

Matched 18/18 tables from Airtable
 - fleet
 - incoming_leads
 - background_checks
 ...
```

If a table shows 0 matches, the Airtable table name doesn't normalize to the expected snake_case name — check with `console.log(toSnake(t.name))` inside the loop.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: add Airtable base and table discovery with snake_case matching"
```

---

## Task 5: Add paginated record fetching + field mapping

**Files:**
- Modify: `scripts/sync-airtable.mjs`

- [ ] **Step 1: Add `fetchRecords` after `listTables`**

```js
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
```

- [ ] **Step 2: Add `mapFields` after `fetchRecords`**

```js
function mapFields(record) {
  const row = { airtable_id: record.id }
  for (const [key, val] of Object.entries(record.fields)) {
    const col = toSnake(key)
    if (SKIP_COLS.has(col)) continue
    // Airtable linked record fields are arrays of record IDs — join as string
    row[col] = Array.isArray(val) ? val.join(', ') : val
  }
  return row
}
```

- [ ] **Step 3: Test fetch + map in `main` against one table**

Add a quick test after the `console.log('Matched...')` line:

```js
  // Quick fetch test — remove after verifying
  const firstEntry = [...tableMap.entries()][0]
  if (firstEntry) {
    const [name, { baseId, tableId }] = firstEntry
    const records = await fetchRecords(baseId, tableId)
    const rows = records.map(mapFields)
    console.log(`\nSample: ${name} — ${rows.length} records`)
    console.log('First row keys:', Object.keys(rows[0] ?? {}))
  }
```

- [ ] **Step 4: Run and verify**

```bash
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

Expected (example for `fleet`):
```
Sample: fleet — 41 records
First row keys: [ 'airtable_id', 'vehicle_name', 'vehicle_make', 'vin', 'status', ... ]
```

Confirm `airtable_id` appears and field names look like snake_case column names.

- [ ] **Step 5: Remove the quick fetch test lines**

Delete the 8 lines added in Step 3.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: add paginated record fetching and field name mapping"
```

---

## Task 6: Add Supabase clear + batch insert

**Files:**
- Modify: `scripts/sync-airtable.mjs`

- [ ] **Step 1: Add `clearTable` after `mapFields`**

```js
async function clearTable(name) {
  // gte on zero UUID matches every row (all UUIDs are >= 00000000...)
  const { error } = await supabase
    .from(name)
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Add `insertRows` after `clearTable`**

```js
async function insertRows(name, rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(name).insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
  }
}
```

- [ ] **Step 3: Commit (no run needed — these are helpers with no wiring yet)**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: add Supabase clearTable and insertRows helpers"
```

---

## Task 7: Wire up the orchestrator, dry-run, and report

**Files:**
- Modify: `scripts/sync-airtable.mjs`

- [ ] **Step 1: Replace the `main` body with the full orchestrator**

```js
async function main() {
  console.log(DRY_RUN ? '[dry-run] sync starting...\n' : 'Live sync starting...\n')

  // 1. Discover all tables across all bases
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

  // 2. Clear junction tables first (best-effort — they may not have id column)
  if (!DRY_RUN) {
    for (const jt of JUNCTION_TABLES) {
      try { await clearTable(jt) } catch { /* skip silently */ }
    }
  }

  // 3. Sync each main table
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
      const rows = records.map(mapFields)
      if (!DRY_RUN) {
        await clearTable(name)
        await insertRows(name, rows)
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
```

- [ ] **Step 2: Run dry-run to verify full output format**

```bash
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

Expected output (record counts will vary):
```
[dry-run] sync starting...

  ✓ fleet                                41 records
  ✓ incoming_leads                      662 records
  ✓ background_checks                   237 records
  ✓ waitlist                             78 records
  ...
  - payments                             SKIPPED (not found in Airtable)
  ...

Sync complete: 16/18 tables | 1,453 records | 0 failed
```

Fix any FAILED lines before proceeding to live sync. Common causes:
- Auth error → check `AIRTABLE_PAT` in `.env`
- Table name mismatch → `console.log(toSnake(t.name))` inside discovery to see actual names

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: wire up full sync orchestrator with dry-run and summary report"
```

---

## Task 8: Run live sync and verify

**Files:** none — verification only

- [ ] **Step 1: Run the live sync**

```bash
node --env-file=.env scripts/sync-airtable.mjs
```

Expected output (same format as dry-run but writes to Supabase):
```
Live sync starting...

  ✓ fleet                                41 records
  ✓ incoming_leads                      662 records
  ...

Sync complete: 16/18 tables | 1,453 records | 0 failed
```

- [ ] **Step 2: Spot-check record counts in Supabase dashboard**

Open the Supabase Table Editor and verify at least 3 tables:
- `fleet` → should show ~41 rows
- `incoming_leads` → should show ~662 rows
- `tickets` → should show ~257 rows

Compare to STATUS.md for expected counts.

- [ ] **Step 3: Spot-check field values**

Open one row in `incoming_leads`. Confirm:
- `airtable_id` is populated (e.g. `recXXXXXXXXXXXXXX`)
- `contact_name`, `phone`, `email`, `status` all have values
- `id` is a fresh UUID (not the Airtable rec ID)

- [ ] **Step 4: Rotate the Airtable PAT**

The token was shared in plain text in chat. Go to [airtable.com/account](https://airtable.com/account) → Personal access tokens → delete the used token → create a new one with the same scopes → update `.env`.

- [ ] **Step 5: Final commit**

```bash
git add scripts/sync-airtable.mjs
git commit -m "feat: complete Airtable → Supabase sync script"
```

---

## Notes

**If a main table DELETE fails with FK violation:**
Junction tables in this project may not have an `id` column, so `clearTable` silently fails on them. If a main table then fails to delete due to an FK constraint, run this in the Supabase SQL Editor first:

```sql
-- Clear all junction tables manually
TRUNCATE fleet_active_customers, fleet_background_checks, fleet_contracts,
  fleet_customer_inspection_photos, fleet_insurance, fleet_maintenance,
  fleet_payments, fleet_tickets, fleet_vehicle_handovers,
  active_customers_payments, active_customers_tickets, active_customers_contracts,
  active_customers_inspection, background_checks_fleet, incoming_leads_appointments,
  waitlist_appointments, insurance_fleet, maintenance_vendors, expenses_vendors
  CASCADE;
```

Then re-run the sync script.

**Linked record fields:**
Airtable linked record fields are arrays of `recXXXX` IDs. The script joins them as comma-separated strings. These values are not useful in Supabase — they'll be populated but meaningless until Airtable is decommissioned and this script is deleted.

**Running again after Airtable updates:**
Just re-run the script. It always truncates and re-inserts, so it's idempotent.
