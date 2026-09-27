# TMMT-BUILD-003

## TASK ID
TMMT-BUILD-003

## TITLE
Ledger-drift reconciliation report: a prod schema snapshot into the repo + a repo↔prod migration version map (outside GHL M2's tables)

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 4; SPEC §30 "Rule 0")

## OBJECTIVE
Make prod reproducible from the repo **before any schema work**. Produce a read-only snapshot of the prod schema (tables, columns, constraints, indexes, policies, grants, functions, triggers, cron jobs) for the tables no other track codifies, plus a single map of repo migration files ↔ prod `schema_migrations` versions.

## WHY (evidence refs)
- SPEC §9.6, §30 (Rule 0, items 1–3), §28 **KD-32**, §32 #7; ROADMAP PM-01 item 4 and exit criterion "a fresh DB built from the repo baseline matches prod's inventory"; E3 §1.6.
- Prod has 279 migrations and the repo has 89. There is no `CREATE TABLE` for the rental core. Same migration, different version (for example `bookings_no_double_booking` repo `20260916235900` vs prod `20260917200051`). About 190 prod-only migrations.

## CURRENT BEHAVIOR (file:line)
- `supabase/schema/live-ledger-2026-09-07.tsv` (the only record of the rental-core tables; stale since 09-07).
- `supabase/migrations/LEDGER-SNAPSHOT.txt` (hand-tracked). `src/lib/db/migration-drift.test.ts` compares repo files only, not the live DB.
- The prod-only `remote_schema_baseline` migration exists on prod with no repo file.

## EXPECTED BEHAVIOR
Deliverables, all **read-only** with respect to prod:
1. `supabase/schema/prod-snapshot-<date>/` containing:
   - `schema.sql`: a `pg_dump --schema-only`-equivalent for `public` (and the `ops`, `cron` job list), **excluding** the tables codified by GHL M2 (get the list from the GHL M2 owner first and record it in the README).
   - `policies.tsv`, `grants.tsv`, `functions.tsv` (name, args, security definer, search_path, md5 of the body), `triggers.tsv`, `cron_jobs.tsv` (name, schedule, command md5).
   - A README: how it was produced, the date, by whom, the excluded tables and why.
2. `supabase/migrations/VERSION_MAP.tsv`: one row per migration (`repo_file`, `repo_version`, `prod_version`, `name`, `status` = same / version-differs / repo-only / prod-only / staged / parked).
3. A reconciliation report `docs/product/LEDGER_DRIFT_REPORT.md`: counts per status, and the rental-core tables with no repo DDL (now covered by the snapshot). Explicit markers: the landmine `_staged/20260904010000_generate_va_tasks_idempotent_STAGED.sql` is **never apply**. The 6 unversioned edge functions are listed with an "owner decision per function" line.
4. A rehearsal `scripts/tests/sql/prod-snapshot-loads.rehearsal.mjs` that loads `schema.sql` into PGlite (with stub roles/extensions as needed) and asserts the table/policy/function counts match `*.tsv`.

## FILES (in scope)
- NEW `supabase/schema/prod-snapshot-<date>/**`, NEW `supabase/migrations/VERSION_MAP.tsv`, NEW `docs/product/LEDGER_DRIFT_REPORT.md`, NEW `scripts/tests/sql/prod-snapshot-loads.rehearsal.mjs`

## DATABASE ENTITIES
All `public` tables **except** GHL M2's list; `supabase_migrations.schema_migrations` (read); `cron.job` (read); `storage.buckets` (read).

## DEPENDENCIES
- **Owner decision:** grant read-only catalog access (a read-only role or a supervised session). Catalog reads need no baton, but credentials are owner-controlled. Without access, STOP.
- **Coordinate with the GHL M2 owner:** get the table list M2 codifies and do not duplicate it.
- Downstream: TMMT-SEC-006, TMMT-DATA-001, TMMT-DATA-002, PM-02 and PM-05 all consume this snapshot.

## CONSTRAINTS
- **No writes to prod.** No `pg_dump` of data. No row contents. Aggregate counts are allowed only if they are needed and contain no PII.
- Function bodies may embed literals (for example the house org id). That is acceptable. Scan the snapshot for anything credential-shaped and redact it (report path + type only).
- Do not change existing migration files or their names.

## SECURITY REQUIREMENTS
- The snapshot must not contain secrets (Vault references are fine; values are not). Run a secret scan over the new files before committing and report the result.
- Do not include `auth` schema internals beyond what policies reference.

## IMPLEMENTATION NOTES
- Prefer `supabase db dump --schema public --schema-only` against a read-only connection if available. Otherwise use catalog queries (`pg_get_tabledef`-style via `information_schema` + `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_functiondef`, `pg_get_triggerdef`, `pg_policies`).
- The PGlite load may need extension stubs (`btree_gist` for the `bookings_no_overlap` EXCLUDE). Document any stubs.

## ACCEPTANCE CRITERIA (testable)
1. `VERSION_MAP.tsv` accounts for all 279 prod versions and all repo files (counts shown in the report).
2. The snapshot loads into PGlite. The rehearsal asserts table, policy and function counts equal the `.tsv` inventories (the diff is empty, or every difference is explained in the README).
3. The rental-core tables (`bookings`, `payments`, `rental_ledger`, `vehicles`, `fleet`, `active_customers`, `customer_payments`, `contract_instances`, `lto_agreements`, `rental_pricing_rules`, `crm_sync_records`, `client_journey`, `documents`, `contracts`, `vehicle_handover`) all appear in the snapshot.
4. The secret scan of the new files is clean (path+type report).
5. The GHL M2 exclusion list is recorded, with the M2 owner's acknowledgement.

## TESTS (must fail on the pre-fix code)
- `prod-snapshot-loads.rehearsal.mjs`: `snapshot loads`, `inventory counts match`, `rental core present`. Pre-fix, no snapshot exists and the rental-core presence check fails.

## DO NOT CHANGE
- Existing migrations, `_staged/`, `_parked/`, `LEDGER-SNAPSHOT.txt` (append a pointer only), GHL M2's tables.

## OWNER GATE
Owner decision (read-only catalog access). No baton (read-only). Merge: owner.
