// G-02 phase 1 (shadow) rehearsal in embedded PostgreSQL.
// Fixtures are the real incidents found on 2026-09-16, rebuilt with SYNTHETIC data only.
// Usage: node scripts/tests/sql/g02-shadow-eligibility.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = await readFile(resolve(repo, 'supabase/migrations/20260916194644_comms_g02_shadow_phase1.sql'), 'utf8')
const ROLES = 'create role anon; create role authenticated; create role service_role;'

// Fresh environment: builds with none of the source tables present.
{
  const db = new PGlite()
  await db.exec(ROLES)
  await db.exec(migration)
  const r = (await db.query(`select comms.evaluate_eligibility('email','internal_alert',null,'owner@example.test') r`)).rows[0].r
  assert.equal(r.decision, 'eligible')
  console.log('ok  0 fresh environment builds; evaluator works with no source tables')
}

const db = new PGlite()
await db.exec(ROLES + `
  create table public.do_not_contact_numbers (phone10 text, reason text);
  create table public.incoming_leads (id uuid primary key default gen_random_uuid(), phone numeric, phone_e164 text, email text, opted_out boolean default false);
  create table public.ghl_contacts (id uuid primary key default gen_random_uuid(), phone text, email text, raw_payload jsonb);
  create table public.customer_payments (id uuid primary key default gen_random_uuid());
  create table public.payment_obligation_reconciliation (customer_payment_id uuid primary key, state text, verified_owed_at timestamptz, verified_by text, evidence_ref text);
  create table public.automation_outbox (id bigint generated always as identity primary key, automation text, channel text, to_address text, status text);
  create table public.exec_va_tasks (id uuid primary key default gen_random_uuid(), category text, subject_phone text, subject_email text,
    status text default 'pending', handled_at timestamptz, result jsonb, source_table text, source_id text);
`)
await db.exec(migration)
await db.exec(migration) // re-runnable

const ev = async (channel, purpose, phone, email, taskId = null, subject = {}) =>
  (await db.query('select comms.evaluate_eligibility($1,$2,$3,$4,$5,$6::jsonb) r', [channel, purpose, phone, email, taskId, JSON.stringify(subject)])).rows[0].r
const codes = (r) => r.reasons.map((x) => x.code).sort()
const task = async (fields) => (await db.query(
  `insert into public.exec_va_tasks (category, subject_phone, subject_email, status, handled_at, result, source_table, source_id)
   values ($1,$2,$3,coalesce($4,'pending'),$5,$6::jsonb,$7,$8) returning id`,
  [fields.category, fields.phone ?? null, fields.email ?? null, fields.status ?? null, fields.handled_at ?? null,
   fields.result ? JSON.stringify(fields.result) : null, fields.source_table ?? null, fields.source_id ?? null])).rows[0].id

// 1. Dismissed task still says pending.
{
  const id = await task({ category: 'payment_followup', phone: '+15550100001', handled_at: '2026-09-08T20:18:05Z', result: { decision: { kind: 'dismiss' } } })
  const r = await ev('sms', 'payment_servicing', '+15550100001', null, id)
  assert.equal(r.decision, 'blocked'); assert.ok(codes(r).includes('task_closed'))
  console.log('ok  1 dismissed task that still says pending -> blocked task_closed')
}

// 2. Phone added to DNC after the task was created.
{
  const id = await task({ category: 'lead_reengagement', phone: '+15550100002' })
  assert.ok(!codes(await ev('sms', 'rental_marketing', '+15550100002', null, id)).includes('suppressed_manual_dnc'))
  await db.exec(`insert into public.do_not_contact_numbers (phone10) values ('5550100002')`)
  const r = await ev('sms', 'rental_marketing', '+15550100002', null, id)
  assert.equal(r.decision, 'blocked'); assert.ok(codes(r).includes('suppressed_manual_dnc'))
  console.log('ok  2 DNC added after task creation -> re-evaluation blocks (send-time style check)')
}

// 3. GHL DND exists, TMMT DNC does not.
{
  await db.exec(`insert into public.ghl_contacts (phone, raw_payload) values ('(555) 010-0003', '{"dnd": false, "dndSettings": {"SMS": {"status": "active"}}}')`)
  const r = await ev('sms', 'payment_servicing', '+15550100003', null, null, { relationship_verified: true })
  assert.equal(r.decision, 'blocked'); assert.ok(codes(r).includes('suppressed_provider_dnd'))
  const inactive = await (async () => {
    await db.exec(`insert into public.ghl_contacts (phone, raw_payload) values ('5550100033', '{"dnd": false, "dndSettings": {"SMS": {"status": "inactive"}}}')`)
    return ev('sms', 'internal_alert', '5550100033', null)
  })()
  assert.equal(inactive.decision, 'eligible')
  console.log('ok  3 GHL per-channel DND without TMMT DNC -> blocked suppressed_provider_dnd; inactive DND ignored')
}

// 4. SMS STOP exists: SMS blocked; email only flags the undecided cross-channel policy.
{
  await db.exec(`insert into public.incoming_leads (phone_e164, email, opted_out) values ('+15550100004', 'stop4@example.test', true)`)
  const sms = await ev('sms', 'rental_marketing', '+15550100004', 'stop4@example.test')
  assert.equal(sms.decision, 'blocked'); assert.ok(codes(sms).includes('suppressed_sms_optout'))
  const email = await ev('email', 'rental_marketing', '+15550100004', 'stop4@example.test')
  assert.ok(codes(email).includes('cross_channel_policy_undecided'))
  assert.ok(!codes(email).includes('suppressed_sms_optout'))
  console.log('ok  4 SMS STOP -> SMS blocked; email gets cross_channel_policy_undecided (policy not decided in code)')
}

// 5. Email exists but marketing consent is unknown.
{
  const r = await ev('email', 'rental_marketing', null, 'lead5@example.test')
  assert.equal(r.decision, 'review_required')
  assert.deepEqual(codes(r), ['consent_unknown', 'owner_approval_missing'])
  console.log('ok  5 email present, no consent evidence -> review_required consent_unknown (unknown is not yes)')
}

// 6. Historical rental inquiry considered for credit-service marketing.
{
  const r = await ev('email', 'credit_path_offer', '+15550100006', 'lead6@example.test')
  assert.notEqual(r.decision, 'eligible'); assert.ok(codes(r).includes('consent_unknown'))
  console.log('ok  6 rental inquiry -> credit offer is never eligible without explicit consent evidence')
}

// 7. Payment follow-up with an unverified obligation.
{
  const cp = (await db.query('insert into public.customer_payments default values returning id')).rows[0].id
  await db.query(`insert into public.payment_obligation_reconciliation (customer_payment_id, state) values ($1, 'unverified')`, [cp])
  const id = await task({ category: 'payment_followup', phone: '+15550100007', source_table: 'customer_payments', source_id: cp })
  const r = await ev('sms', 'payment_servicing', '+15550100007', null, id)
  assert.equal(r.decision, 'blocked'); assert.ok(codes(r).includes('obligation_unverified'))
  console.log('ok  7 payment follow-up on an unverified obligation -> blocked obligation_unverified')

  // 9. Valid current transactional workflow: same shape once the obligation is verified with evidence.
  await db.query(`update public.payment_obligation_reconciliation set verified_owed_at = now(), verified_by = 'owner', evidence_ref = 'synthetic' where customer_payment_id = $1`, [cp])
  const ok = await ev('sms', 'payment_servicing', '+15550100007', null, id)
  assert.equal(ok.decision, 'eligible', JSON.stringify(ok))
  console.log('ok  9 verified obligation + open task + no suppression -> eligible (valid transactional)')
}

// 8. Valid internal business alert.
{
  const r = await ev('email', 'internal_alert', null, 'owner@example.test')
  assert.equal(r.decision, 'eligible')
  console.log('ok  8 internal alert to the owner -> eligible')
}

// 10. Owner approval absent where required (consent evidence present).
{
  await db.exec(`insert into comms.consent_evidence (phone10, channel, purpose, method, confidence, disclosure_ref, captured_at)
                 values ('5550100010', 'sms', 'rental_marketing', 'checkbox', 'record', 'synthetic form v1', now())`)
  const id = await task({ category: 'lead_reengagement', phone: '+15550100010' })
  const r = await ev('sms', 'rental_marketing', '+15550100010', null, id)
  assert.equal(r.decision, 'review_required'); assert.deepEqual(codes(r), ['owner_approval_missing'])
  await db.query(`update public.exec_va_tasks set result = '{"approval": {"by": "owner"}}' where id = $1`, [id])
  assert.equal((await ev('sms', 'rental_marketing', '+15550100010', null, id)).decision, 'eligible')
  console.log('ok 10 owner approval missing -> review_required; with record consent + approval -> eligible')
}

// Guards: unknown purpose, wrong channel, missing destination, no PII in shadow rows, locked schema.
{
  assert.ok(codes(await ev('sms', 'made_up_purpose', '+15550100011', null)).includes('purpose_unknown'))
  assert.ok(codes(await ev('voice', 'internal_alert', '+15550100011', null)).includes('channel_not_allowed_for_purpose'))
  assert.ok(codes(await ev('email', 'internal_alert', '+15550100011', null)).includes('destination_missing'))
  await db.exec(`insert into public.automation_outbox (automation, channel, to_address, status) values ('notify-new-lead','email','owner@example.test','queued')`)
  const run = (await db.query(`select comms.run_shadow_batch('rehearsal') r`)).rows[0].r
  assert.ok(run.rows > 0)
  const leak = (await db.query(`select count(*)::int n from comms.shadow_decisions where coalesce(destination_hash,'') ~ '@|\\+1555' or g02_reasons::text ~ '555010|example\\.test'`)).rows[0].n
  assert.equal(leak, 0)
  const cmp = (await db.query(`select comparison, count(*)::int n from comms.shadow_decisions group by 1`)).rows
  assert.ok(cmp.some((c) => c.comparison === 'allow->eligible'))
  const priv = (await db.query(`select has_schema_privilege('anon','comms','USAGE') a, has_function_privilege('authenticated','comms.evaluate_eligibility(text,text,text,text,uuid,jsonb)','EXECUTE') u`)).rows[0]
  assert.deepEqual(priv, { a: false, u: false })
  console.log('ok 11 guards: unknown purpose/channel/destination; shadow rows hold hashes not PII; comms locked to service_role')
}

console.log('G-02 shadow rehearsal passed')
