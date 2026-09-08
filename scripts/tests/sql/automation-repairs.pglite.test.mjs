import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const repaired = process.argv.includes('--repaired')

async function sqlFile(path) {
  return readFile(resolve(repo, path), 'utf8')
}

async function rows(db, sql, params = []) {
  return (await db.query(sql, params)).rows
}

async function classifierSuite() {
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

    insert into incoming_leads values
      ('lead-a', 'shared@example.test', 'New'), ('lead-b', 'shared@example.test', 'New'),
      ('same-source', 'duplicate@example.test', 'New'), ('legacy-source', 'legacy@example.test', 'New'),
      ('dnc-source', 'dnc@example.test', 'New');

    insert into exec_va_tasks
      (category, subject_name, subject_phone, subject_email, source_table, source_id, sweep_date, status, context)
    values
      ('lead_reengagement', 'shared-contact', '+15550000001', 'shared@example.test', 'incoming_leads', 'lead-a', current_date - 1, 'pending', '{"scenario":"distinct"}'),
      ('lead_reengagement', 'shared-contact', '+15550000001', 'shared@example.test', 'incoming_leads', 'lead-b', current_date, 'pending', '{"scenario":"distinct"}'),
      ('lead_reengagement', 'duplicate-source', '+15550000002', 'duplicate@example.test', 'incoming_leads', 'same-source', current_date - 1, 'pending', '{"scenario":"same-source"}'),
      ('lead_reengagement', 'duplicate-source', '+15550000002', 'duplicate@example.test', 'incoming_leads', 'same-source', current_date, 'pending', '{"scenario":"same-source"}'),
      ('lead_reengagement', 'legacy-contact', '+15550000003', 'legacy@example.test', null, null, current_date - 1, 'pending', '{"scenario":"legacy"}'),
      ('lead_reengagement', 'legacy-contact', '+15550000003', 'legacy@example.test', null, null, current_date, 'pending', '{"scenario":"legacy"}'),
      ('lead_reengagement', 'dnc', '+15550000004', 'dnc@example.test', 'incoming_leads', 'dnc-source', current_date, 'blocked_dnc', '{"scenario":"dnc"}');
  `)

  await db.exec(await sqlFile('scripts/tests/sql/fixtures/classify-va-tasks-old.sql'))
  if (repaired) await db.exec(await sqlFile('docs/repairs/classify-va-tasks-source-identity.sql'))

  const dry = await rows(db, `select public.classify_va_tasks(true) as result`)
  assert.equal(dry[0].result.written, 0, 'dry run reports zero writes')
  assert.equal((await rows(db, `select count(*)::int as n from exec_va_tasks where triage is not null`))[0].n, 0,
    'dry run does not mutate triage')

  await db.exec(`select public.classify_va_tasks(false);`)

  const distinct = await rows(db, `
    select triage, count(*)::int as n from exec_va_tasks
    where context->>'scenario' = 'distinct' group by triage order by triage`)
  assert.deepEqual(distinct, [{ triage: 'needs_approval', n: 2 }],
    'same contact with different source IDs remains two actionable items')

  const sameSource = await rows(db, `
    select triage, count(*)::int as n from exec_va_tasks
    where context->>'scenario' = 'same-source' group by triage order by triage`)
  assert.deepEqual(sameSource, [{ triage: 'ignore', n: 1 }, { triage: 'needs_approval', n: 1 }],
    'repeated rows for one source identity suppress only the older row')

  const legacy = await rows(db, `
    select triage, count(*)::int as n from exec_va_tasks
    where context->>'scenario' = 'legacy' group by triage order by triage`)
  assert.deepEqual(legacy, [{ triage: 'ignore', n: 1 }, { triage: 'needs_approval', n: 1 }],
    'legacy rows without provenance retain contact-key fallback behavior')

  const dnc = await rows(db, `select triage, triage_reason from exec_va_tasks where subject_name = 'dnc'`)
  assert.deepEqual(dnc, [{ triage: 'ignore', triage_reason: 'dnc_blocked' }],
    'DNC rows remain ignored before all other classifier rules')

  if (repaired) {
    await db.exec(await sqlFile('docs/repairs/classify-va-tasks-source-identity.down.sql'));
    await db.exec(await sqlFile('docs/repairs/classify-va-tasks-source-identity.sql'));
    const replay = (await rows(db, `select public.classify_va_tasks(true) as result`))[0].result;
    assert.equal(replay.written, 0);
  }
  await db.close()
}

async function leaseSuite() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create function public.is_platform_admin() returns boolean language sql stable as 'select true';
    create table agent_definitions (
      slug text primary key, active boolean not null default true, max_attempts integer not null,
      model text, temperature numeric, source_table text, target_field text
    );
    create table agent_jobs (
      id bigint generated always as identity primary key, agent_slug text not null,
      source_table text not null, record_id text not null, status text not null default 'queued',
      prompt text, response text, error text, attempts integer not null default 0,
      claimed_by text, claimed_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(),
      lease_epoch bigint not null default 0, lease_expires_at timestamptz, worker_id text
    );
    create table audit_events (id bigint generated always as identity primary key, action text, payload jsonb);
    insert into agent_definitions (slug, active, max_attempts, model, temperature)
    values ('bounded-agent', true, 3, 'local-test', 0);
  `)
  await db.exec(await sqlFile('scripts/tests/sql/fixtures/agent-jobs-lease-old.sql'))
  if (repaired) await db.exec(await sqlFile('docs/repairs/agent-jobs-terminal-lease-reap.sql'))

  await db.exec(`insert into agent_jobs (agent_slug, source_table, record_id) values ('bounded-agent', 'fixture', 'below-max');`)
  const belowClaim = (await rows(db, `select * from agent_wp_claim('worker-a', 1, interval '5 minutes')`))[0]
  await db.exec(`update agent_jobs set lease_expires_at = now() - interval '1 minute' where id = ${belowClaim.job_id};`)
  await db.exec(`select agent_wp_reap();`)
  const below = (await rows(db, `select status, attempts, lease_epoch, finished_at from agent_jobs where id = ${belowClaim.job_id}`))[0]
  assert.equal(below.status, 'queued', 'expiry below max attempts requeues the job')
  assert.equal(below.attempts, 1, 'reaping does not spend another attempt')
  assert.equal(Number(below.lease_epoch), Number(belowClaim.lease_epoch) + 1, 'reaping advances the lease epoch')
  assert.equal(below.finished_at, null, 'a retryable job is not marked finished')

  const stale = (await rows(db,
    `select agent_wp_complete($1, $2, $3, $4) as result`,
    [belowClaim.job_id, 'worker-a', belowClaim.lease_epoch, 'late result']))[0].result
  assert.equal(stale.accepted, false, 'completion from the expired lease is rejected')

  await db.exec(`update agent_jobs set status = 'done' where id = ${belowClaim.job_id};`);
  await db.exec(`insert into agent_jobs (agent_slug, source_table, record_id, attempts) values ('bounded-agent', 'fixture', 'at-max', 2);`)
  const maxClaim = (await rows(db, `select * from agent_wp_claim('worker-b', 1, interval '5 minutes')`))[0]
  await db.exec(`update agent_jobs set lease_expires_at = now() - interval '1 minute' where id = ${maxClaim.job_id};`)
  await db.exec(`select agent_wp_reap();`)
  const terminal = (await rows(db, `select status, attempts, lease_epoch, finished_at, error from agent_jobs where id = ${maxClaim.job_id}`))[0]
  assert.equal(terminal.status, 'failed', 'expiry at max attempts is terminal')
  assert.equal(terminal.attempts, 3, 'terminal reap preserves the final attempt count')
  assert.equal(Number(terminal.lease_epoch), Number(maxClaim.lease_epoch) + 1, 'terminal reap advances the lease epoch')
  assert.ok(terminal.finished_at, 'terminal reap records finished_at')

  if (repaired) {
    await db.exec(await sqlFile('docs/repairs/agent-jobs-terminal-lease-reap.down.sql'));
    await db.exec(await sqlFile('docs/repairs/agent-jobs-terminal-lease-reap.sql'));
    assert.equal((await rows(db, `select public.agent_wp_reap() as count`))[0].count, 0);
    assert.equal((await rows(db, `select has_function_privilege('service_role', 'public.agent_wp_reap()', 'execute') as allowed`))[0].allowed, false);
  }
  await db.close()
}

async function contractSuite() {
  const db = new PGlite();
  await db.exec(`create table contracts (id integer primary key, start_date date, end_date date);
    insert into contracts values (1, '2026-09-10', '2026-09-20');`);
  if (repaired) await db.exec(await sqlFile('docs/repairs/contracts-date-order.sql'));
  await assert.rejects(db.exec(`update contracts set end_date = '2026-09-09' where id = 1;`),
    /contracts_date_order/, 'partial date writes cannot invert a contract');
  await db.exec(`update contracts set end_date = '2026-09-10' where id = 1;
    insert into contracts values (2, null, null);`);
  if (repaired) {
    await db.exec(await sqlFile('docs/repairs/contracts-date-order.down.sql'));
    await db.exec(`update contracts set end_date = '2026-09-09' where id = 1;`);
    await db.exec(`update contracts set end_date = '2026-09-20' where id = 1;`);
    await db.exec(await sqlFile('docs/repairs/contracts-date-order.sql'));
    await assert.rejects(db.exec(`update contracts set start_date = '2026-09-21' where id = 1;`), /contracts_date_order/);
  }
  await db.close();
}

const suites = [
  ['contract date invariant', contractSuite],
  ['classifier source identity', classifierSuite],
  ['agent lease terminal reap', leaseSuite],
]

let failed = 0
for (const [name, suite] of suites) {
  try {
    await suite()
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

if (failed) process.exitCode = 1
