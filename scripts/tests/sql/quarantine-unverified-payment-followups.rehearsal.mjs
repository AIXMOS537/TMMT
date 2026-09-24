// Rehearses the unverified-payment quarantine migration in embedded PostgreSQL.
// Invariant under test: UNVERIFIED OBLIGATION -> NO COLLECTION CONTACT TASK.
// Usage: node scripts/tests/sql/quarantine-unverified-payment-followups.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = await readFile(
  resolve(repo, 'supabase/migrations/20260916194231_quarantine_unverified_payment_followups.sql'),
  'utf8'
)
const ROLES = 'create role anon; create role authenticated; create role service_role;'
// Minimal shapes of every table generate_va_tasks_v2 reads, synthetic data only.
const SCHEMA = `
  create table public.do_not_contact_numbers (phone10 text, reason text);
  create table public.incoming_leads (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
    contact_name text, opportunity_name text, phone numeric, phone_e164 text, email text, status text, opted_out boolean default false);
  create table public.customer_payments (id uuid primary key default gen_random_uuid(), customer text, customer_phone_number text,
    amount numeric, amout_past_due text, last_payment_date date, next_payment_due_date date, payment_status text, notes text);
  create table public.waitlist (id uuid primary key default gen_random_uuid(), customer_name text, customer_phone text, customer_email text,
    date_added_to_waitlist date, vehicle_type text, make text, model text, desired_weekly_payment numeric, status text);
  create table public.background_checks (customer_id uuid, customer_name text, phone_number text, email text, eligibility_status text, review_notes text);
  create table public.tickets (ticket_id text, requested_by_customer text, amount numeric, violation_type text, status text);
  create table public.exec_va_tasks (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
    sweep_date date default current_date, category text, priority text default 'medium', agent text default 'CHUMMO',
    subject_name text, subject_phone text, subject_email text, context jsonb default '{}', status text default 'pending',
    result jsonb, handled_at timestamptz, triage text, triage_reason text, source_table text, source_id text,
    first_seen_at timestamptz, last_seen_at timestamptz, seen_count int default 1);
  create unique index exec_va_tasks_source_identity_uidx on public.exec_va_tasks (category, source_table, source_id)
    where source_id is not null and status = 'pending';`
const count = async (db, sql) => (await db.query(sql)).rows[0].n

// 1. Fresh environment: data steps skip, function still created.
{
  const db = new PGlite()
  await db.exec(ROLES)
  await db.exec(migration)
  assert.equal((await db.query(`select to_regprocedure('public.generate_va_tasks_v2()') is not null ok`)).rows[0].ok, true)
  assert.equal((await db.query(`select to_regclass('public.payment_obligation_reconciliation') t`)).rows[0].t, null)
  console.log('ok  1 fresh environment: quarantine skipped, generator function created')
}

// 2. Unverified set that is not the verified production 21: abort, nothing changes.
{
  const db = new PGlite()
  await db.exec(ROLES + SCHEMA)
  await db.exec(`
    insert into public.customer_payments (customer, customer_phone_number, amount, payment_status, next_payment_due_date)
      select 'synthetic ' || g, '+1555010' || lpad(g::text, 4, '0'), 100, 'Overdue', current_date - 200 from generate_series(1, 21) g;
    insert into public.exec_va_tasks (category, subject_phone, source_table, source_id)
      select 'payment_followup', cp.customer_phone_number, 'customer_payments', cp.id::text from public.customer_payments cp;`)
  await assert.rejects(() => db.exec(migration), /quarantine abort/)
  assert.equal(await count(db, `select count(*)::int n from public.exec_va_tasks where status = 'pending'`), 21)
  assert.equal((await db.query(`select to_regclass('public.payment_obligation_reconciliation') t`)).rows[0].t, null)
  console.log('ok  2 unverified 21-row set: aborted, statuses unchanged, nothing created')
}

// 3. Already-quarantined shape: re-runs cleanly, seeds reconciliation, and the generator
//    creates NO payment task for unverified obligations until one is verified with evidence.
{
  const db = new PGlite()
  await db.exec(ROLES + SCHEMA)
  await db.exec(`
    insert into public.customer_payments (customer, customer_phone_number, amount, payment_status, next_payment_due_date)
      select 'synthetic ' || g, '+1555020' || lpad(g::text, 4, '0'), 100, 'Overdue', current_date - 200 from generate_series(1, 3) g;
    insert into public.exec_va_tasks (category, subject_phone, source_table, source_id, status)
      select 'payment_followup', cp.customer_phone_number, 'customer_payments', cp.id::text, 'quarantined_unverified' from public.customer_payments cp;`)
  await db.exec(migration)
  await db.exec(migration)
  assert.equal(await count(db, `select count(*)::int n from public.payment_obligation_reconciliation where state = 'unverified' and verified_owed_at is null`), 3)
  const priv = (await db.query(`select has_table_privilege('anon','public.payment_obligation_reconciliation','SELECT') a,
    has_table_privilege('authenticated','public.exec_va_tasks_quarantine_20260916','SELECT') u`)).rows[0]
  assert.deepEqual(priv, { a: false, u: false })
  console.log('ok  3 re-runs cleanly; 3 reconciliation rows seeded unverified; anon/authenticated locked out')

  const r1 = (await db.query('select public.generate_va_tasks_v2() r')).rows[0].r
  assert.equal(r1.touched.payment_followup, 0)
  assert.equal(r1.payment_followup_requires_verified_obligation, true)
  assert.equal(await count(db, `select count(*)::int n from public.exec_va_tasks where category='payment_followup' and status='pending'`), 0)
  console.log('ok  4 generator: 3 overdue but unverified obligations -> 0 payment tasks (quarantined work not recreated)')

  await assert.rejects(() => db.exec(`update public.payment_obligation_reconciliation set verified_owed_at = now()
    where customer_payment_id = (select id from public.customer_payments limit 1)`), /verified_needs_evidence/)
  await db.exec(`update public.payment_obligation_reconciliation
      set state = 'confirmed_owed', verified_owed_at = now(), verified_by = 'owner', evidence_ref = 'synthetic contract ref'
    where customer_payment_id = (select id from public.customer_payments order by customer limit 1)`)
  const r2 = (await db.query('select public.generate_va_tasks_v2() r')).rows[0].r
  assert.equal(r2.touched.payment_followup, 1)
  console.log('ok  5 verification needs evidence; once one obligation is verified, exactly 1 task is generated')

  await db.exec(`insert into public.do_not_contact_numbers (phone10)
    select right(regexp_replace(customer_phone_number, '\\D', '', 'g'), 10) from public.customer_payments order by customer limit 1;
    update public.exec_va_tasks set status = 'archived_legacy' where category = 'payment_followup' and status = 'pending';`)
  const r3 = (await db.query('select public.generate_va_tasks_v2() r')).rows[0].r
  assert.equal(r3.touched.payment_followup, 0)
  console.log('ok  6 verified but DNC: still no task (existing DNC filter preserved)')
}

console.log('quarantine rehearsal passed')
