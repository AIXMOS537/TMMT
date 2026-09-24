// Rehearses the seven backfilled agent-queue migrations in embedded PostgreSQL.
// Usage: node scripts/tests/sql/agent-queue-migrations.rehearsal.mjs
//
// Proves, without touching production:
//   1. docs/repairs/*.applied.sql bodies are byte-identical to the prod ledger (md5)
//   2. why the verbatim bodies are not fresh-safe
//   3. fresh empty database: every repo form applies, skips its missing prerequisites
//      with a notice, creates nothing dangerous, and re-runs cleanly
//   4. with prerequisites present: function bodies/security/volatility equal production,
//      ACLs match production, the full queue lifecycle works (enqueue -> lease claim ->
//      fenced complete -> write-back -> auto-route; lease expiry -> reap -> stale result
//      rejected -> reclaim), and re-running every file cannot regress later migrations
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const read = async (p) => (await readFile(resolve(repo, p), 'utf8')).replace(/\r\n/g, '\n')
const md5 = (s) => createHash('md5').update(Buffer.from(s, 'utf8')).digest('hex')
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows
const one = async (db, sql, params = []) => Object.values((await rows(db, sql, params))[0])[0]

// ---- ledger facts read from production 2026-09-16 (read-only) ----------------------
const LEDGER = [
  ['20260826003221', 'agent_spine_definitions_jobs_and_dispatch', 'agent-spine-definitions-jobs-and-dispatch', 'fb2c20d1e1894f6081fa82f665cf6ca6'],
  ['20260826003248', 'agent_expense_categorizer', 'agent-expense-categorizer', 'ca5e38405787378d9daad42781b5dbe6'],
  ['20260826045839', 'routing_engine_capture_triggers_and_tail_agent', 'routing-engine-capture-triggers-and-tail-agent', '273bab1e05a2f8a272a1a05ff1556f7a'],
  ['20260826050151', 'routing_engine_drop_name_from_haystack', 'routing-engine-drop-name-from-haystack', 'fcb7670486928794580aed7ab4cde26d'],
  ['20260831190848', 'agent_jobs_worker_rpc', 'agent-jobs-worker-rpc', '39535289fc4dd7dd5a7c99fdbb9c7970'],
  ['20260906022156', 'agent_jobs_lease_fencing', 'agent-jobs-lease-fencing', '930de8e5ea650ad43346239d3436f09f'],
  ['20260906022251', 'agent_wp_revoke_anon_authenticated', 'agent-wp-revoke-anon-authenticated', '942c28b4efc2c0c64c419c7f2f3a2ec2'],
]
const LATER_ON_MASTER = 'supabase/migrations/20260908195354_agent_wp_reap_terminal_lease.sql'
// md5(prosrc), prosecdef, provolatile in production (2026-09-16)
const PROD_FN = {
  'agent_claim_jobs(text,integer)': ['5eaaa6b762691f59659b5952d5b0c043', true, 'v'],
  'agent_complete_job(bigint,text,text)': ['7cb1618a445562d18a3cbf7dc8f63154', true, 'v'],
  'agent_enqueue()': ['6f38e539be4419c2d968f9b2d7361a11', true, 'v'],
  'agent_render_prompt(text,jsonb)': ['afc0a2a89bf29fbfdb8098361b2c4493', false, 'i'],
  'agent_wp_claim(text,integer,interval)': ['459e592b26bdda54a2a484bfbf345ec4', true, 'v'],
  'agent_wp_complete(bigint,text,bigint,text)': ['769f42e6ac63b5da7c5aabc0b25c8ee8', true, 'v'],
  'agent_wp_fail(bigint,text,bigint,text)': ['7e51a537b7daf55dbb61dbd8e9e32fcc', true, 'v'],
  'agent_wp_reap()': ['92f775a88632470d8660de9331b1dc60', true, 'v'], // after 20260908195354
  'auto_route_intake()': ['786b028b33a53045a08299c592f689f7', true, 'v'],
  'backfill_lead_intake(integer)': ['ecdd7cc0cd5166724290a4e34879e83d', true, 'v'],
  'capture_form_intake()': ['bd65183f2e113c503fabfdd5bd28fd57', true, 'v'],
  'capture_lead_intake()': ['292247135652f817d1a9631b63914eaf', true, 'v'],
  'claim_agent_job(text)': ['d3e7e9742c869405afa87b5b6020f10e', false, 'v'],
  'fail_agent_job(bigint,text)': ['c6b346b8937d00248187139106fa2161', false, 'v'],
  'finish_agent_job(bigint,text)': ['7a82aa943ddb93d50f19036caa0aa32a', false, 'v'],
}

const migrationPath = ([v, name]) => `supabase/migrations/${v}_${name}.sql`
const verbatim = async ([, , slug]) => {
  const raw = await read(`docs/repairs/${slug}.applied.sql`)
  const marker = '-- ===== VERBATIM BODY BELOW =====\n'
  return raw.slice(raw.indexOf(marker) + marker.length)
}
const applyAll = async (db) => {
  for (const m of LEDGER) await db.exec(await read(migrationPath(m)))
  await db.exec(await read(LATER_ON_MASTER))
}
const base = async () => {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';`)
  return db
}

// 1 ---------------------------------------------------------------------------------
for (const m of LEDGER) assert.equal(md5(await verbatim(m)), m[3], `verbatim body drifted: ${m[2]}`)
console.log('ok  1 all seven docs/repairs bodies are byte-identical to the production ledger (md5)')
if (process.argv.includes('--verify-verbatim')) process.exit(0)

// 2 ---------------------------------------------------------------------------------
{
  const db = await base()
  await assert.rejects(async () => db.exec(await verbatim(LEDGER[0])), /is_platform_admin\(\) does not exist/)
  const db2 = await base()
  await db2.exec(`create function public.is_platform_admin() returns boolean language sql stable as 'select true';
    create table public.incoming_leads (id uuid primary key default gen_random_uuid(), opportunity_name text, notes text,
      sku text, source_campaign text, utm_campaign text, utm_source text, lane text, contact_name text, org_id uuid);
    create table public.customer_intake_forms (id uuid primary key default gen_random_uuid(), request_type text, subject text, details text, source text);`)
  await db2.exec(await verbatim(LEDGER[0]))
  await assert.rejects(async () => db2.exec(await verbatim(LEDGER[2])), /intake_events.*does not exist/)
  console.log('ok  2 verbatim bodies are NOT fresh-safe (missing is_platform_admin / intake_events): repo forms are needed')
}

// 3 ---------------------------------------------------------------------------------
{
  const db = await base()
  await applyAll(db)
  const tables = await rows(db, `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('agent_definitions','agent_jobs') order by 1`)
  assert.deepEqual(tables, [{ relname: 'agent_definitions', relrowsecurity: true }, { relname: 'agent_jobs', relrowsecurity: true }])
  assert.equal(await one(db, `select count(*)::int from pg_policies where tablename in ('agent_definitions','agent_jobs')`), 0)
  assert.equal(await one(db, `select count(*)::int from pg_trigger where not tgisinternal`), 0)
  assert.deepEqual((await rows(db, 'select slug, active from public.agent_definitions order by slug')).map((r) => r.slug),
    ['expense-categoriser', 'intake-router'])
  assert.notEqual(await one(db, `select to_regprocedure('public.agent_wp_reap()')::text`), null)
  await applyAll(db) // re-run
  console.log('ok  3 fresh empty DB: all repo forms apply, RLS on with no policy (deny), no triggers on missing tables, cron skipped, re-run clean')
}

// 4 ---------------------------------------------------------------------------------
{
  const db = await base()
  await db.exec(`
    create function public.is_platform_admin() returns boolean language sql stable as 'select false';
    create table public.audit_events (id bigint generated always as identity primary key, ts timestamptz not null default now(), action text, payload jsonb);
    create table public.expenses (id uuid primary key default gen_random_uuid(), expense_type text, vendor_payee text,
      description text, notes text, amount numeric, vehicle_name text, org_id uuid);
    create table public.incoming_leads (id uuid primary key default gen_random_uuid(), opportunity_name text, notes text,
      sku text, source_campaign text, utm_campaign text, utm_source text, lane text, contact_name text, org_id uuid);
    create table public.customer_intake_forms (id uuid primary key default gen_random_uuid(), request_type text, subject text, details text, source text);
    create table public.intake_events (id bigint generated always as identity primary key, source text, record_id text, haystack text,
      payload jsonb, program text, confidence text, matched_on text, routed_at timestamptz, routed_action text, note text, org_id uuid,
      created_at timestamptz not null default now());
    create function public.intake_capture(p_source text, p_record_id text, p_haystack text, p_payload jsonb, p_org uuid)
      returns bigint language sql as $$ insert into public.intake_events (source, record_id, haystack, payload, org_id)
      values (p_source, p_record_id, p_haystack, p_payload, p_org) returning id $$;
    create function public.route_intake_event(p_id bigint) returns void language sql as
      $$ update public.intake_events set routed_at = now(), routed_action = 'rehearsal' where id = p_id $$;`)
  await applyAll(db)

  // 4a function bodies, security, volatility == production
  const fns = await rows(db, `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
      md5(p.prosrc) as src, p.prosecdef, p.provolatile
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)
  const bySig = Object.fromEntries(fns.map((f) => [f.sig.replace(/\b\w+ (text|integer|bigint|jsonb|interval)\b/g, '$1').replace(/, /g, ','), f]))
  for (const [sig, [src, secdef, vol]] of Object.entries(PROD_FN)) {
    const f = bySig[sig]
    assert.ok(f, `missing function ${sig}`)
    assert.equal(f.src, src, `body differs from production: ${sig}`)
    assert.equal(f.prosecdef, secdef, `security differs: ${sig}`)
    assert.equal(f.provolatile, vol, `volatility differs: ${sig}`)
  }
  console.log('ok  4 all 15 queue/routing functions: body md5, SECURITY DEFINER and volatility equal production')

  // 4b ACLs that production relies on
  const can = (role, fn) => one(db, `select has_function_privilege($1, $2, 'EXECUTE')`, [role, fn])
  for (const fn of ['public.agent_wp_claim(text,integer,interval)', 'public.agent_wp_complete(bigint,text,bigint,text)', 'public.agent_wp_fail(bigint,text,bigint,text)']) {
    assert.equal(await can('service_role', fn), true, fn)
    assert.equal(await can('anon', fn), false, fn)
    assert.equal(await can('authenticated', fn), false, fn)
  }
  for (const fn of ['public.agent_wp_reap()', 'public.agent_claim_jobs(text,integer)', 'public.agent_complete_job(bigint,text,text)',
    'public.claim_agent_job(text)', 'public.finish_agent_job(bigint,text)', 'public.fail_agent_job(bigint,text)']) {
    assert.equal(await can('service_role', fn), false, fn)
    assert.equal(await can('anon', fn), false, fn)
  }
  assert.equal(await one(db, `select count(*)::int from pg_policies where tablename in ('agent_definitions','agent_jobs')`), 2)
  const trg = (await rows(db, `select tgrelid::regclass::text || '.' || tgname as t from pg_trigger where not tgisinternal order by 1`)).map((r) => r.t)
  assert.deepEqual(trg, ['customer_intake_forms.capture_form_intake_trg', 'expenses.agent_enqueue_expenses',
    'incoming_leads.capture_lead_intake_trg', 'intake_events.agent_enqueue_intake_events', 'intake_events.auto_route_intake_trg'])
  console.log('ok  5 ACLs match production (agent_wp_* service_role only; reap and gen-1/gen-2 not callable); 2 policies; 5 triggers')

  // 4c lifecycle: lead -> capture -> enqueue -> lease claim -> fenced complete -> write-back -> auto-route
  await db.exec(`update public.agent_definitions set active = true`)
  await db.exec(`insert into public.incoming_leads (contact_name, opportunity_name, notes) values ('Jane Rehearsal', 'Rehearsal lead', 'wants a car for uber')`)
  const job = (await rows(db, `select id, status, prompt from public.agent_jobs where agent_slug = 'intake-router'`))[0]
  assert.equal(job.status, 'queued')
  assert.match(job.prompt, /wants a car for uber/)
  assert.doesNotMatch(job.prompt, /Jane Rehearsal/, 'contact_name must not reach the model (20260826050151)')
  const claim = (await rows(db, `select * from public.agent_wp_claim('rehearsal-worker', 1, interval '15 minutes')`))[0]
  assert.equal(claim.job_id, job.id)
  assert.equal(Number(claim.lease_epoch), 1)
  const lease = await one(db, `select round(extract(epoch from lease_expires_at - claimed_at)) from public.agent_jobs where id = $1`, [job.id])
  assert.equal(Number(lease), 900)
  const done = await one(db, `select public.agent_wp_complete($1, 'rehearsal-worker', 1, 'rentals_rideshare')`, [job.id])
  assert.equal(done.accepted, true)
  assert.equal(done.wrote_field, true)
  const ev = (await rows(db, `select program, routed_action from public.intake_events`))[0]
  assert.deepEqual(ev, { program: 'rentals_rideshare', routed_action: 'rehearsal' })
  const again = await one(db, `select public.agent_wp_complete($1, 'rehearsal-worker', 1, 'general')`, [job.id])
  assert.deepEqual([again.accepted, again.rejected], [false, 'not_running'])
  console.log('ok  6 lifecycle: capture -> enqueue -> 15-min lease claim -> fenced complete -> write-back -> auto-route; duplicate completion rejected')

  // 4d lease expiry -> reap -> stale result rejected -> reclaim
  await db.exec(`insert into public.expenses (vendor_payee, description, amount) values ('Shell', 'fuel', 40)`)
  const ej = await one(db, `select id from public.agent_jobs where agent_slug = 'expense-categoriser'`)
  const c1 = (await rows(db, `select * from public.agent_wp_claim('worker-a', 1, interval '1 second')`))[0]
  assert.equal(c1.job_id, ej)
  await db.exec(`select pg_sleep(1.2)`)
  assert.equal(await one(db, `select public.agent_wp_reap()`), 1)
  const audit = (await rows(db, `select action, payload from public.audit_events`))[0]
  assert.equal(audit.action, 'agent_job.lease_expired')
  const stale = await one(db, `select public.agent_wp_complete($1, 'worker-a', 1, 'Fuel')`, [ej])
  assert.deepEqual([stale.accepted, stale.rejected], [false, 'not_running'])
  const c2 = (await rows(db, `select * from public.agent_wp_claim('worker-b', 1, interval '15 minutes')`))[0]
  assert.equal(Number(c2.lease_epoch), 3)
  const late = await one(db, `select public.agent_wp_complete($1, 'worker-a', 1, 'Other')`, [ej])
  assert.deepEqual([late.accepted, late.rejected], [false, 'not_owner'])
  assert.equal((await one(db, `select public.agent_wp_complete($1, 'worker-b', 3, 'Fuel')`, [ej])).accepted, true)
  assert.equal(await one(db, `select expense_type from public.expenses`), 'Fuel')
  console.log('ok  7 lease expiry -> reap (audited) -> stale and foreign results rejected -> reclaim epoch 3 -> single write-back')

  // 4e re-running every repo form cannot regress later history
  for (const m of LEDGER) await db.exec(await read(migrationPath(m)))
  const reap = await one(db, `select md5(prosrc) from pg_proc where proname = 'agent_wp_reap'`)
  assert.equal(reap, PROD_FN['agent_wp_reap()'][0])
  assert.equal(await one(db, `select count(*)::int from public.agent_definitions`), 2)
  console.log('ok  8 re-running all seven repo forms is clean and does not regress the 20260908195354 reaper')
}

console.log('\nALL PASS')
