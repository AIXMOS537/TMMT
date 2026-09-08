// Rehearses the STAGED lease-reap and contract-date migrations in embedded PostgreSQL:
// skip path on an empty database, then up, down (docs/repairs/*.down.sql), up with prerequisites present.
// Usage: node scripts/tests/sql/automation-migrations.rehearsal.mjs <lease migration> <contracts migration>
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const [leaseMigration, contractsMigration] = process.argv.slice(2)
assert.ok(leaseMigration && contractsMigration, 'pass both migration paths')
const sqlFile = async (p) => readFile(resolve(repo, p), 'utf8')
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows

// 1. Empty database: both migrations must skip with a notice, creating nothing.
{
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(await sqlFile(leaseMigration))
  await db.exec(await sqlFile(contractsMigration))
  assert.equal((await rows(db, `select to_regprocedure('public.agent_wp_reap()') as f`))[0].f, null)
  assert.equal((await rows(db, `select to_regclass('public.contracts') as t`))[0].t, null)
  console.log('ok  1 fresh reset: both migrations skipped, nothing created')
}

// 2. Lease reap with prerequisites (same fixture as automation-repairs test).
{
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create function public.is_platform_admin() returns boolean language sql stable as 'select true';
    create table agent_definitions (slug text primary key, active boolean not null default true,
      max_attempts integer not null, model text, temperature numeric, source_table text, target_field text);
    create table agent_jobs (
      id bigint generated always as identity primary key, agent_slug text not null,
      source_table text, record_id text, status text not null default 'queued',
      prompt text, response text, error text, attempts integer not null default 0,
      claimed_by text, claimed_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(),
      lease_epoch bigint not null default 0, lease_expires_at timestamptz, worker_id text
    );
    create table audit_events (id bigint generated always as identity primary key, action text, payload jsonb);
    insert into agent_definitions (slug, active, max_attempts, model, temperature) values ('bounded-agent', true, 3, 'local-test', 0);
  `)
  await db.exec(await sqlFile('scripts/tests/sql/fixtures/agent-jobs-lease-old.sql'))

  const expireAtMax = async () => {
    await db.exec(`insert into agent_jobs (agent_slug, source_table, record_id, attempts) values ('bounded-agent', 'fixture', 'at-max', 2);`)
    const claim = (await rows(db, `select * from agent_wp_claim('worker-b', 1, interval '5 minutes')`))[0]
    await db.exec(`update agent_jobs set lease_expires_at = now() - interval '1 minute' where id = ${claim.job_id};`)
    await db.exec(`select agent_wp_reap();`)
    const j = (await rows(db, `select status, attempts, finished_at from agent_jobs where id = ${claim.job_id}`))[0]
    await db.exec(`update agent_jobs set status = 'done' where id = ${claim.job_id};`)
    return j
  }
  const acl = async () => (await rows(db, `select
    has_function_privilege('service_role','public.agent_wp_reap()','execute') as svc,
    has_function_privilege('anon','public.agent_wp_reap()','execute') as anon`))[0]

  assert.equal((await expireAtMax()).status, 'queued', 'baseline: old reaper requeues forever')
  console.log('ok  2 baseline: old reaper requeues an exhausted job (the defect)')

  await db.exec(await sqlFile(leaseMigration))
  const up = await expireAtMax()
  assert.equal(up.status, 'failed'); assert.equal(up.attempts, 3); assert.ok(up.finished_at)
  assert.deepEqual(await acl(), { svc: false, anon: false })
  console.log('ok  3 up: exhausted lease is terminal, no API role can execute the reaper')

  await db.exec(await sqlFile('docs/repairs/agent-jobs-terminal-lease-reap.down.sql'))
  assert.equal((await expireAtMax()).status, 'queued', 'down restores prior reaper')
  console.log('ok  4 down: prior reaper restored')

  await db.exec(await sqlFile(leaseMigration))
  assert.equal((await expireAtMax()).status, 'failed')
  console.log('ok  5 up again: idempotent re-application')
  await db.close()
}

// 3. Contract date order with prerequisites: up, idempotent re-run, down, up.
{
  const db = new PGlite()
  await db.exec(`create table public.contracts (id integer primary key, start_date date, end_date date);
    insert into public.contracts values (1, '2026-09-10', '2026-09-20'), (2, null, null);`)
  await db.exec(await sqlFile(contractsMigration))
  await assert.rejects(db.exec(`update public.contracts set end_date = '2026-09-09' where id = 1;`), /contracts_date_order/)
  await db.exec(`update public.contracts set end_date = '2026-09-10' where id = 1;`) // same-day allowed
  await db.exec(await sqlFile(contractsMigration)) // already present: skip, no error
  assert.equal((await rows(db, `select count(*)::int as n from pg_constraint where conname = 'contracts_date_order'`))[0].n, 1)
  console.log('ok  6 contracts up: inversion rejected, same-day allowed, nulls allowed, re-run is a no-op')

  await db.exec(await sqlFile('docs/repairs/contracts-date-order.down.sql'))
  await db.exec(`update public.contracts set end_date = '2026-09-09' where id = 1;`)
  console.log('ok  7 contracts down: constraint dropped')
  await db.exec(`update public.contracts set end_date = '2026-09-20' where id = 1;`)
  await db.exec(await sqlFile(contractsMigration))
  await assert.rejects(db.exec(`update public.contracts set start_date = '2026-09-21' where id = 1;`), /contracts_date_order/)
  console.log('ok  8 contracts up again: constraint enforced')

  // Inverted data present: the add must fail and change nothing.
  const bad = new PGlite()
  await bad.exec(`create table public.contracts (id integer primary key, start_date date, end_date date);
    insert into public.contracts values (1, '2026-09-20', '2026-09-10');`)
  await assert.rejects(bad.exec(await sqlFile(contractsMigration)), /contracts_date_order/)
  assert.equal((await rows(bad, `select count(*)::int as n from pg_constraint where conname = 'contracts_date_order'`))[0].n, 0)
  console.log('ok  9 contracts with inverted rows: migration fails loudly, nothing changed')
  await db.close(); await bad.close()
}
console.log('REHEARSAL PASSED', leaseMigration, contractsMigration)
