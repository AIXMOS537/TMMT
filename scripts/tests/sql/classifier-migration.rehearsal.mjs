// Rehearses the STAGED classifier migration in embedded PostgreSQL: skip path, up, down, up.
// Usage: node scripts/tests/sql/classifier-migration.rehearsal.mjs supabase/migrations/<file>.sql
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = process.argv[2]
assert.ok(migration, 'pass the migration path')
const sqlFile = async (p) => readFile(resolve(repo, p), 'utf8')
const rows = async (db, sql) => (await db.query(sql)).rows

// 1. Fresh database without prerequisites: the migration must skip, not fail.
{
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(await sqlFile(migration))
  const fn = await rows(db, `select to_regprocedure('public.classify_va_tasks(boolean,text)') as f`)
  assert.equal(fn[0].f, null, 'skip path creates nothing')
  console.log('ok  1 fresh reset: skipped with notice, nothing created')
}

// 2. Prerequisites present (same fixture as automation-repairs test): up, down, up.
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create table exec_va_tasks (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(), sweep_date date not null default current_date,
    category text not null, priority text not null default 'medium', agent text not null default 'CHUMMO',
    subject_name text, subject_phone text, subject_email text, context jsonb not null default '{}',
    status text not null default 'pending', result jsonb, handled_at timestamptz,
    triage text, triage_reason text, triage_confidence numeric(3,2), triaged_at timestamptz,
    triaged_by text, source_table text, source_id text
  );
  create table customer_payments (customer_phone_number text, payment_status text, next_payment_due_date date);
  create table waitlist (customer_phone text, status text);
  create table incoming_leads (id text primary key, email text, status text);
  create table background_checks (customer_id text, eligibility_status text);
  create table tickets (requested_by_customer text, amount numeric, status text);
  insert into incoming_leads values ('lead-a','shared@example.test','New'), ('lead-b','shared@example.test','New');
  insert into exec_va_tasks (category, subject_name, subject_phone, subject_email, source_table, source_id, sweep_date) values
    ('lead_reengagement','shared-contact','[phone removed]','shared@example.test','incoming_leads','lead-a', current_date - 1),
    ('lead_reengagement','shared-contact','[phone removed]','shared@example.test','incoming_leads','lead-b', current_date);
`)
await db.exec(await sqlFile('scripts/tests/sql/fixtures/classify-va-tasks-old.sql'))

const distribution = async () => {
  await db.exec(`update exec_va_tasks set triage = null, triage_reason = null; select public.classify_va_tasks(false);`)
  return rows(db, `select triage, count(*)::int as n from exec_va_tasks group by 1 order by 1`)
}
const acl = async () => rows(db, `select
  has_function_privilege('service_role','public.classify_va_tasks(boolean,text)','execute') as svc,
  has_function_privilege('anon','public.classify_va_tasks(boolean,text)','execute') as anon,
  has_function_privilege('authenticated','public.classify_va_tasks(boolean,text)','execute') as auth`)

assert.deepEqual(await distribution(), [{ triage: 'ignore', n: 1 }, { triage: 'needs_approval', n: 1 }],
  'old classifier collapses two sources sharing one contact')
console.log('ok  2 baseline: old contact key collapses distinct sources (the defect)')

await db.exec(await sqlFile(migration))
assert.deepEqual(await distribution(), [{ triage: 'needs_approval', n: 2 }], 'up: both sources actionable')
assert.deepEqual(await acl(), [{ svc: true, anon: false, auth: false }], 'up: service_role only')
console.log('ok  3 up: source identity preserved, ACL service_role only')

await db.exec(await sqlFile('docs/repairs/classify-va-tasks-source-identity.down.sql'))
assert.deepEqual(await distribution(), [{ triage: 'ignore', n: 1 }, { triage: 'needs_approval', n: 1 }], 'down restores old behaviour')
console.log('ok  4 down: prior classifier restored')

await db.exec(await sqlFile(migration))
assert.deepEqual(await distribution(), [{ triage: 'needs_approval', n: 2 }], 'up again')
assert.deepEqual(await acl(), [{ svc: true, anon: false, auth: false }])
console.log('ok  5 up again: idempotent re-application')
console.log('REHEARSAL PASSED', migration)
