# Airtable → Supabase Sync Script — Design Spec

> Date: 2026-03-26
> Status: Approved

## Context

TMMT Rentals is migrating away from Airtable. Until Airtable is fully decommissioned, data lives in both systems. This script is a **transitional bridge** that pulls fresh data from all 3 Airtable bases into Supabase on demand. It is not a permanent feature — once Airtable is retired, this script is deleted.

## Goal

A standalone CLI script that refreshes all Supabase tables from Airtable, treating Airtable as the source of truth. Truncates existing Supabase data and re-inserts from Airtable on each run.

## Airtable Bases

All 3 bases are synced:
1. TMMT Rentals
2. TMMT OS
3. TMMT Rentals (Copy)

## Architecture

**File:** `scripts/sync-airtable.mjs`

- Plain Node.js ESM — no build step, run directly with `node scripts/sync-airtable.mjs`
- Uses built-in `fetch` (Node 18+) and `@supabase/supabase-js` (already installed)
- No new dependencies
- Reads env from `.env` at project root using Node's `--env-file` flag (Node 20+): `node --env-file=.env scripts/sync-airtable.mjs`

**Env vars required:**
| Variable | Purpose |
|---|---|
| `AIRTABLE_PAT` | Airtable Personal Access Token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |

Add `AIRTABLE_PAT` to `.env` — it is not currently present.

## Data Flow

Each sync run executes in this order:

1. **Discover** — call Airtable Metadata API (`GET /v0/meta/bases`, then `GET /v0/meta/bases/{baseId}/tables`) to get all bases, tables, and field names
2. **Match** — normalize Airtable table names to snake_case; match against a hardcoded Supabase allowlist (the 25 main tables) to avoid touching auth/system tables
3. **Fetch** — pull all records from each matched Airtable table, paginated at 100 records/page using Airtable's `offset` cursor
4. **Map fields** — normalize each Airtable field name to snake_case (e.g. `"Contact Name"` → `contact_name`); drop any fields that don't exist as Supabase columns
5. **Truncate** — `DELETE FROM table WHERE true` via Supabase service role client (avoids `TRUNCATE` lock issues). Junction tables are cleared first (using a hardcoded junction table list) to avoid FK constraint failures when deleting from main tables.
6. **Insert** — batch insert in chunks of 500 rows using Supabase `.insert()`
7. **Report** — print per-table summary and final totals to stdout

## Supabase Table Allowlist

Only these 18 confirmed main tables are touched (junction/system tables are never modified):

`fleet`, `incoming_leads`, `background_checks`, `waitlist`, `appointments`,
`active_customers`, `payments`, `tickets`, `expenses`, `insurance`,
`customer_inspection_photos`, `maintenance`, `contracts`, `vendors`,
`operation_costs`, `do_not_rent`, `former_customers`, `vehicle_handovers`

> If a table name exists in Airtable but not in this allowlist, it is skipped with a log message.

## Dry Run Mode

```bash
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

Prints what would be truncated and inserted without writing anything to Supabase. Fetches from Airtable and maps fields, but stops before the DELETE step.

## Error Handling

- **Per-table isolation** — if one table fails (fetch error, insert error, schema mismatch), log the error and continue to the next table
- **Field mismatches** — unknown Airtable fields are silently dropped before insert; Supabase column errors are caught and logged per-table
- **Airtable rate limits** — Airtable's API allows 5 req/sec; script adds a 250ms delay after every Airtable API call (including pagination requests within a single table) to stay well under the limit

## Output Format

```
[dry-run] or live sync starting...

✓ fleet                 41 records
✓ incoming_leads       662 records
✓ background_checks    237 records
✗ payments             FAILED: insert error — column "foo" does not exist
...

Sync complete: 22/25 tables synced | 1,453 records inserted | 1 failed
```

## Usage

```bash
# Add token to .env first:
# AIRTABLE_PAT=pat8mah6k...

# Live sync
node --env-file=.env scripts/sync-airtable.mjs

# Dry run (no writes)
node --env-file=.env scripts/sync-airtable.mjs --dry-run
```

## Out of Scope

- Junction table sync (relationships are not preserved from Airtable)
- Airtable attachment/file field migration (handled separately via Supabase Storage)
- Scheduling / cron — run manually as needed
- Conflict resolution — Airtable always wins; no merge logic
