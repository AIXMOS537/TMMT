// Rehearses the G-01 migration in embedded PostgreSQL: it must build a fresh
// environment, no-op when there is nothing to normalize, and abort (changing
// nothing) on any matching set that is not the verified production 71.
// Usage: node scripts/tests/sql/g01-migration.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = await readFile(
  resolve(repo, 'supabase/migrations/20260916191039_g01_exec_va_tasks_dnc_normalize_20260916.sql'),
  'utf8'
)
const rows = async (db, sql) => (await db.query(sql)).rows
const ledger = async (db) => (await rows(db, `select to_regclass('public.exec_va_tasks_dnc_remediation_20260916') as t`))[0].t

const ROLES = 'create role anon; create role authenticated; create role service_role;'
const SCHEMA = `
  create table public.do_not_contact_numbers (phone10 text, reason text, added_at timestamptz default now());
  create table public.exec_va_tasks (
    id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
    category text, subject_phone text, status text default 'pending',
    handled_at timestamptz, triage text, triage_reason text);`

// 1. Fresh environment without the queue tables: skip, create nothing.
{
  const db = new PGlite()
  await db.exec(ROLES)
  await db.exec(migration)
  assert.equal(await ledger(db), null)
  console.log('ok  1 fresh reset without prerequisites: skipped, nothing created')
}

// 2. Tables present but empty (fresh build of the queue): ledger created and locked, no data change.
{
  const db = new PGlite()
  await db.exec(ROLES + SCHEMA)
  await db.exec(migration)
  assert.notEqual(await ledger(db), null)
  const [p] = await rows(db, `select has_table_privilege('anon','public.exec_va_tasks_dnc_remediation_20260916','SELECT') a,
    has_table_privilege('authenticated','public.exec_va_tasks_dnc_remediation_20260916','SELECT') u,
    (select relrowsecurity from pg_class where oid='public.exec_va_tasks_dnc_remediation_20260916'::regclass) rls`)
  assert.deepEqual([p.a, p.u, p.rls], [false, false, true])
  assert.equal((await rows(db, 'select count(*)::int n from public.exec_va_tasks_dnc_remediation_20260916'))[0].n, 0)
  console.log('ok  2 empty queue tables: ledger created, RLS on, anon/authenticated no SELECT, 0 rows')
}

// 3. 71 matching pending rows that are NOT the verified production set: abort, change nothing.
{
  const db = new PGlite()
  await db.exec(ROLES + SCHEMA)
  await db.exec(`
    insert into public.exec_va_tasks (category, subject_phone)
      select 'lead_reengagement', '+1555000' || lpad(g::text, 4, '0') from generate_series(1, 71) g;
    insert into public.do_not_contact_numbers (phone10)
      select '555000' || lpad(g::text, 4, '0') from generate_series(1, 71) g;`)
  await assert.rejects(() => db.exec(migration), /G-01 abort/)
  assert.equal((await rows(db, `select count(*)::int n from public.exec_va_tasks where status='pending'`))[0].n, 71)
  assert.equal(await ledger(db), null, 'abort must roll back the ledger too')
  console.log('ok  3 unverified 71-row set: aborted, statuses unchanged, no ledger')
}

// 4. Already normalized (post-apply state): re-run is a clean no-op.
{
  const db = new PGlite()
  await db.exec(ROLES + SCHEMA)
  await db.exec(`
    insert into public.exec_va_tasks (category, subject_phone, status) values ('lead_reengagement', '+15550001111', 'blocked_dnc');
    insert into public.do_not_contact_numbers (phone10) values ('5550001111');`)
  await db.exec(migration)
  await db.exec(migration)
  assert.equal((await rows(db, `select status from public.exec_va_tasks`))[0].status, 'blocked_dnc')
  console.log('ok  4 already normalized: re-runs twice as a no-op')
}

console.log('G-01 migration rehearsal passed')
