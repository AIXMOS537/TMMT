// G-02 shadow: internal notifications are evaluated separately from customer
// communication, and customer DND can never be bypassed by relabelling.
// SYNTHETIC data only. Usage: node scripts/tests/sql/g02-internal-destinations.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const phase1 = await readFile(resolve(repo, 'supabase/migrations/20260916194644_comms_g02_shadow_phase1.sql'), 'utf8')
const internal = await readFile(resolve(repo, 'supabase/migrations/20260916200655_comms_g02_internal_destinations.sql'), 'utf8')

const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role;
  create table public.do_not_contact_numbers (phone10 text, reason text);
  create table public.incoming_leads (id uuid primary key default gen_random_uuid(), phone numeric, phone_e164 text, email text, opted_out boolean default false);
  create table public.ghl_contacts (id uuid primary key default gen_random_uuid(), phone text, email text, raw_payload jsonb);
  create table public.automation_outbox (id bigint generated always as identity primary key, automation text, channel text, to_address text, status text);
  create table public.exec_va_tasks (id uuid primary key default gen_random_uuid(), category text, subject_phone text, subject_email text,
    status text default 'pending', handled_at timestamptz, result jsonb, source_table text, source_id text);`)
await db.exec(phase1)
await db.exec(internal)
await db.exec(internal) // re-runnable

// The staff member's address ALSO exists as a GHL contact with Email + SMS DND (the real-world shape).
await db.exec(`
  insert into public.ghl_contacts (phone, email, raw_payload) values
    ('5550200001', 'owner@example.test', '{"dnd": true, "dndSettings": {"Email": {"status": "active"}, "SMS": {"status": "permanent"}}}'),
    ('5550200002', 'customer@example.test', '{"dnd": false, "dndSettings": {"Email": {"status": "active"}, "SMS": {"status": "active"}}}');
  insert into comms.internal_destinations (recipient_role, label, channel, address_norm, purposes_allowed, created_by) values
    ('owner', 'owner new-lead alerts', 'email', 'owner@example.test', array['internal_alert'], 'rehearsal'),
    ('staff', 'staff sms alerts', 'sms', '5550200001', array['internal_alert'], 'rehearsal'),
    ('staff', 'disabled inbox', 'email', 'old-staff@example.test', array['internal_alert'], 'rehearsal');
  update comms.internal_destinations set active = false, disabled_at = now(), disabled_reason = 'left' where address_norm = 'old-staff@example.test';`)

const internalEv = async (ch, purpose, addr) =>
  (await db.query('select comms.evaluate_internal_notification($1,$2,$3) r', [ch, purpose, addr])).rows[0].r
const customerEv = async (ch, purpose, phone, email, subject = {}) =>
  (await db.query('select comms.evaluate_eligibility($1,$2,$3,$4,null,$5::jsonb) r', [ch, purpose, phone, email, JSON.stringify(subject)])).rows[0].r
const codes = (r) => r.reasons.map((x) => x.code).sort()

// 1. Staff internal alert + configured destination + same address is a GHL DND contact -> evaluated independently.
{
  const r = await internalEv('email', 'internal_alert', 'Owner@Example.test ')
  assert.equal(r.decision, 'eligible', JSON.stringify(r))
  assert.equal(r.evaluator, 'internal')
  const s = await internalEv('sms', 'internal_alert', '+1 (555) 020-0001')
  assert.equal(s.decision, 'eligible')
  console.log('ok  1 staff alert to a configured internal destination is eligible even though the address is a GHL DND contact')
}

// 2. Customer message + customer GHL DND -> BLOCKED, including to the very same address.
{
  const cust = await customerEv('email', 'payment_servicing', null, 'customer@example.test', { relationship_verified: true })
  assert.equal(cust.decision, 'blocked'); assert.ok(codes(cust).includes('suppressed_provider_dnd'))
  const sameAddr = await customerEv('email', 'rental_marketing', null, 'owner@example.test')
  assert.equal(sameAddr.decision, 'blocked'); assert.ok(codes(sameAddr).includes('suppressed_provider_dnd'))
  console.log('ok  2 customer message to a GHL DND destination is blocked (also for the staff address used as a customer)')
}

// 3. Relabel attempts cannot bypass customer suppression.
{
  const viaCustomer = await customerEv('email', 'internal_alert', null, 'customer@example.test')
  assert.equal(viaCustomer.decision, 'blocked')
  assert.ok(codes(viaCustomer).includes('internal_purpose_requires_internal_evaluator'))
  const unconfigured = await internalEv('email', 'internal_alert', 'customer@example.test')
  assert.equal(unconfigured.decision, 'blocked')
  assert.deepEqual(codes(unconfigured), ['internal_destination_not_configured'])
  const customerPurposeToStaff = await internalEv('email', 'rental_marketing', 'owner@example.test')
  assert.equal(customerPurposeToStaff.decision, 'blocked')
  assert.ok(codes(customerPurposeToStaff).includes('purpose_not_internal'))
  console.log('ok  3 relabelling fails: internal purpose via customer evaluator, unconfigured address, customer purpose via internal evaluator all blocked')
}

// 4. Internal destinations keep their own controls.
{
  assert.deepEqual(codes(await internalEv('email', 'internal_alert', 'old-staff@example.test')), ['internal_destination_inactive'])
  await db.exec(`insert into comms.purposes values ('internal_digest','internal',array['email'],'none',false,false,'synthetic digest')`)
  assert.deepEqual(codes(await internalEv('email', 'internal_digest', 'owner@example.test')), ['internal_purpose_not_allowed'])
  assert.deepEqual(codes(await internalEv('sms', 'internal_alert', 'owner@example.test')), ['destination_missing'])
  console.log('ok  4 inactive destination, purpose not allowed, and wrong-channel address are blocked')
}

// 5. Shadow batch: internal alerts flip to eligible; customer DND decisions do not change.
{
  await db.exec(`
    insert into public.automation_outbox (automation, channel, to_address, status) values ('notify-new-lead','email','owner@example.test','queued');
    insert into public.incoming_leads (phone_e164, email) values ('+15550200002', 'customer@example.test');`)
  await db.query(`select comms.run_shadow_batch('rehearsal-2')`)
  const rows = (await db.query(`select subject_kind, channel, purpose, comparison from comms.shadow_decisions where run_label = 'rehearsal-2' order by 1,2,3`)).rows
  const alert = rows.find((r) => r.subject_kind === 'automation_outbox')
  assert.equal(alert.comparison, 'allow->eligible')
  const leadRows = rows.filter((r) => r.subject_kind === 'historical_lead')
  assert.ok(leadRows.length === 3 && leadRows.every((r) => r.comparison === 'hold->blocked'), JSON.stringify(leadRows))
  console.log('ok  5 shadow batch: internal alert allow->eligible; the DND customer stays blocked on every channel/purpose')
}

const priv = (await db.query(`select has_table_privilege('anon','comms.internal_destinations','SELECT') a,
  has_function_privilege('authenticated','comms.evaluate_internal_notification(text,text,text)','EXECUTE') u`)).rows[0]
assert.deepEqual(priv, { a: false, u: false })
console.log('ok  6 internal destinations and evaluator locked to service_role')
console.log('G-02 internal destinations rehearsal passed')
