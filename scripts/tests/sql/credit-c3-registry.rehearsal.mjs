// Credit C3 rehearsal: recipient registry + template approvals, embedded Postgres (PGlite).
//
// Target: supabase/migrations/_staged/20260923120000_credit_recipients_and_template_approvals_STAGED.sql
// (NOT applied to production). Checks, against production-shaped roles and helpers:
//   - only a platform admin reads or writes either table; staff, customers, anon get nothing
//   - a recipient version's name/address/source cannot change; only verification / effectiveTo
//   - an AI / agent / AIXMOS / system actor cannot verify a recipient or approve a template
//   - approvals are append-only: insert active, the one change is active -> revoked
//   - no DELETE, no TRUNCATE for app roles
//   - the migration applies twice cleanly and its written rollback removes everything
// Then MUTATION mode re-runs the checks against weakened copies of the SQL and requires
// every mutation to be caught.
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/credit-c3-registry.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const STAGED = await readFile(resolve(repo, 'supabase/migrations/_staged/20260923120000_credit_recipients_and_template_approvals_STAGED.sql'), 'utf8')

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const STAFF = '00000000-0000-4000-8000-0000000000b1'
const CUST = '00000000-0000-4000-8000-0000000000c1'
const HASH_A = 'a'.repeat(64)

const SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table public.profiles (id uuid primary key, role text not null default 'customer');
  create function public.is_platform_admin() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $f$;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase default privileges: new tables are granted to anon/authenticated. The
  -- migration must REVOKE, so the fixture reproduces the default grant.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  insert into public.profiles values ('${ADMIN}','admin'), ('${STAFF}','internal_team'), ('${CUST}','customer');
`

const rec = (id, v, over = {}) => JSON.stringify({
  recipientId: id, version: v, type: id.split(':')[0], name: 'Experian',
  address: { line1: 'P.O. Box 4500', city: 'Allen', state: 'TX', zip: '75013' },
  source: 'legacy_code_seed', verification: { status: 'unverified' },
  effectiveFrom: '2026-09-22T00:00:00.000Z', createdBy: 'owner@x', createdAt: '2026-09-22T00:00:00.000Z', ...over,
})
const appr = (id, over = {}) => JSON.stringify({
  id, templateId: 'letter:initial_611', templateVersion: 'c1-2026-09-22', contentHash: HASH_A, gate: 'croa_contracts_attorney_approved',
  scope: {}, approver: 'owner@x', approvedAt: '2026-09-22T00:00:00.000Z', reference: 'COUNSEL-001', status: 'active', ...over,
})
const insRecipient = (id, v, over) => `insert into public.credit_recipients (recipient_id, version, record) values ('${id}', ${v}, '${rec(id, v, over)}'::jsonb)`
const insApproval = (id, over = {}) => `insert into public.credit_template_approvals (id, template_id, content_hash, record) values ('${id}', 'letter:initial_611', '${HASH_A}', '${appr(id, over)}'::jsonb)`

async function build(sql) {
  const db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(sql)
  return db
}

async function as(db, who, sql) {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who.sub ?? ''])
    await db.exec(`set local role ${who.role}`)
    const r = await db.query(sql)
    await db.exec('commit')
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 }
  } catch (error) {
    await db.exec('rollback')
    return { ok: false, error }
  }
}
const user = (sub) => ({ role: 'authenticated', sub })
const anon = { role: 'anon' }
const admin = user(ADMIN)
const denied = (r) => !r.ok || r.affected === 0

/** Each check gets the SQL under test and throws on failure. */
const CHECKS = [
  ['admin can add a recipient version and read it back', async (sql) => {
    const db = await build(sql)
    assert.equal((await as(db, admin, insRecipient('CRA:experian', 1))).ok, true)
    const r = await as(db, admin, 'select recipient_id from public.credit_recipients')
    assert.deepEqual(r.rows, [{ recipient_id: 'CRA:experian' }])
  }],
  ['staff, customers and anon can neither read nor write recipients or approvals', async (sql) => {
    const db = await build(sql)
    await as(db, admin, insRecipient('CRA:experian', 1))
    await as(db, admin, insApproval('appr-000001'))
    for (const who of [user(STAFF), user(CUST), anon]) {
      for (const t of ['credit_recipients', 'credit_template_approvals']) {
        const r = await as(db, who, `select * from public.${t}`)
        assert.ok(!r.ok || r.rows.length === 0, `${who.sub ?? 'anon'} read ${t}`)
      }
      assert.ok(denied(await as(db, who, insRecipient('CRA:equifax', 1))), 'non-admin inserted a recipient')
      assert.ok(denied(await as(db, who, insApproval('appr-000009'))), 'non-admin inserted an approval')
      assert.ok(denied(await as(db, who, `update public.credit_recipients set record = jsonb_set(record, '{verification}', '{"status":"verified","by":"x"}')`)), 'non-admin verified')
    }
  }],
  ["a version's address cannot be edited in place — only a new version", async (sql) => {
    const db = await build(sql)
    await as(db, admin, insRecipient('CRA:experian', 1))
    const r = await as(db, admin, `update public.credit_recipients set record = jsonb_set(record, '{address,line1}', '"P.O. Box 666"')`)
    assert.equal(r.ok, false)
    assert.equal((await as(db, admin, insRecipient('CRA:experian', 2, { address: { line1: 'P.O. Box 9701', city: 'Allen', state: 'TX', zip: '75013' } }))).ok, true)
  }],
  ['a person may verify a version; an AI / agent / AIXMOS / system actor may not', async (sql) => {
    const db = await build(sql)
    await as(db, admin, insRecipient('CRA:experian', 1))
    for (const bot of ['ai:model', 'agent:credit', 'AIXMOS-worker', 'system:seed']) {
      const r = await as(db, admin, `update public.credit_recipients set record = jsonb_set(record, '{verification}', '{"status":"verified","by":"${bot}","method":"looked it up"}')`)
      assert.equal(r.ok, false, `${bot} verified`)
    }
    const ok = await as(db, admin, `update public.credit_recipients set record = jsonb_set(record, '{verification}', '{"status":"verified","by":"owner@x","method":"bureau page"}')`)
    assert.equal(ok.ok && ok.affected, 1)
  }],
  ['the record must agree with its key columns', async (sql) => {
    const db = await build(sql)
    const r = await as(db, admin, `insert into public.credit_recipients (recipient_id, version, record) values ('CRA:experian', 1, '${rec('CRA:equifax', 1)}'::jsonb)`)
    assert.equal(r.ok, false)
    assert.equal((await as(db, admin, `insert into public.credit_recipients (recipient_id, version, record) values ('BUREAU:x', 1, '${rec('BUREAU:x', 1)}'::jsonb)`)).ok, false)
  }],
  ['an approval must be made by a person and start active', async (sql) => {
    const db = await build(sql)
    assert.equal((await as(db, admin, insApproval('appr-bot001', { approver: 'agent:credit' }))).ok, false)
    assert.equal((await as(db, admin, insApproval('appr-bot002', { approver: 'aixmos:desk' }))).ok, false)
    assert.equal((await as(db, admin, insApproval('appr-rev001', { status: 'revoked' }))).ok, false)
    assert.equal((await as(db, admin, insApproval('appr-000001'))).ok, true)
  }],
  ['approvals are append-only: wording hash / approver cannot change; revocation can; un-revoking cannot', async (sql) => {
    const db = await build(sql)
    await as(db, admin, insApproval('appr-000001'))
    assert.equal((await as(db, admin, `update public.credit_template_approvals set record = jsonb_set(record, '{approver}', '"someone@else"')`)).ok, false)
    assert.equal((await as(db, admin, `update public.credit_template_approvals set record = jsonb_set(record, '{contentHash}', '"${'b'.repeat(64)}"'), content_hash = '${'b'.repeat(64)}'`)).ok, false)
    const rv = await as(db, admin, `update public.credit_template_approvals set record = record || '{"status":"revoked","revokedBy":"owner@x","revokedAt":"2026-10-01T00:00:00.000Z"}'::jsonb`)
    assert.equal(rv.ok && rv.affected, 1)
    assert.equal((await as(db, admin, `update public.credit_template_approvals set record = record || '{"status":"active"}'::jsonb`)).ok, false)
  }],
  ['no DELETE or TRUNCATE for app roles, even the admin', async (sql) => {
    const db = await build(sql)
    await as(db, admin, insRecipient('CRA:experian', 1))
    await as(db, admin, insApproval('appr-000001'))
    for (const t of ['credit_recipients', 'credit_template_approvals']) {
      assert.ok(denied(await as(db, admin, `delete from public.${t}`)), `delete on ${t}`)
      assert.equal((await as(db, admin, `truncate public.${t}`)).ok, false, `truncate on ${t}`)
    }
    const left = await db.query('select (select count(*) from public.credit_recipients)::int r, (select count(*) from public.credit_template_approvals)::int a')
    assert.deepEqual(left.rows[0], { r: 1, a: 1 })
  }],
  ['privileges are exactly: anon none; authenticated select+insert+update(record); never delete/truncate', async (sql) => {
    // RLS does not cover TRUNCATE, and a policy is only one layer: the grants must be
    // right on their own. Checked in the catalog and by trying as anon and a customer.
    const db = await build(sql)
    await as(db, admin, insRecipient('CRA:experian', 1))
    await as(db, admin, insApproval('appr-000001'))
    for (const t of ['credit_recipients', 'credit_template_approvals']) {
      const q = await db.query(`select
          ${['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'].map((p) => `has_table_privilege('anon', 'public.${t}', '${p}') as anon_${p}`).join(', ')},
          ${['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'].map((p) => `has_table_privilege('authenticated', 'public.${t}', '${p}') as auth_${p}`).join(', ')},
          has_column_privilege('authenticated', 'public.${t}', 'record', 'update') as auth_upd_record,
          has_column_privilege('authenticated', 'public.${t}', ${t === 'credit_recipients' ? "'recipient_id'" : "'content_hash'"}, 'update') as auth_upd_key`)
      const p = q.rows[0]
      for (const [k, v] of Object.entries(p)) {
        const want = ['auth_select', 'auth_insert', 'auth_upd_record'].includes(k)
        assert.equal(v, want, `${t}: ${k} is ${v}`)
      }
      for (const who of [anon, user(CUST)]) {
        assert.equal((await as(db, who, `truncate public.${t}`)).ok, false, `${who.sub ?? 'anon'} truncated ${t}`)
      }
    }
  }],
  ['applies twice cleanly, and the written rollback removes everything', async (sql) => {
    const db = await build(sql)
    await db.exec(sql)
    const rollback = sql.split('-- ROLLBACK')[1].split('\n').filter((l) => /^--\s+drop /.test(l)).map((l) => l.replace(/^--\s+/, '')).join('\n')
    await db.exec(rollback)
    const left = await db.query(`select count(*)::int n from pg_class where relname in ('credit_recipients','credit_template_approvals')
      union all select count(*)::int from pg_proc where proname in ('credit_recipients_guard','credit_template_approvals_guard')`)
    assert.deepEqual(left.rows.map((r) => r.n), [0, 0])
  }],
]

async function runAll(sql, { quiet = false } = {}) {
  const failures = []
  let i = 0
  for (const [name, fn] of CHECKS) {
    i++
    try {
      await fn(sql)
      if (!quiet) console.log(`ok ${String(i).padStart(2)} ${name}`)
    } catch (e) {
      failures.push(name)
      if (!quiet) console.log(`FAIL ${String(i).padStart(2)} ${name}: ${e.message}`)
    }
  }
  return failures
}

const base = await runAll(STAGED)
if (base.length) {
  console.error(`\n${base.length} check(s) failed against the staged SQL.`)
  process.exit(1)
}

// ------------------------------------------------------------ mutations
const MUTATIONS = [
  ['policy lets any signed-in user read recipients', 'for select to authenticated using (public.is_platform_admin());\ndrop policy if exists credit_recipients_admin_insert', 'for select to authenticated using (true);\ndrop policy if exists credit_recipients_admin_insert'],
  ['anon keeps the Supabase default grant (no REVOKE)', 'revoke all on public.credit_recipients from anon, authenticated;', 'revoke all on public.credit_recipients from authenticated;'],
  ['RLS never enabled on approvals', 'alter table public.credit_template_approvals enable row level security;', ''],
  ['recipient guard allows address edits', "if (new.record - 'verification' - 'effectiveTo') is distinct from (old.record - 'verification' - 'effectiveTo') then", 'if false then'],
  ['recipient guard lets agents verify', "~* '^(ai|agent|aixmos|system)[:_-]' then\n      raise exception 'credit_recipients", "~* '^(nobody)[:_-]' then\n      raise exception 'credit_recipients"],
  ['approval guard lets agents approve', "if coalesce(new.record->>'approver', '') ~* '^(ai|agent|aixmos|system)[:_-]' then", 'if false then'],
  ['approval guard allows any update', "if old.record->>'status' <> 'active' or new.record->>'status' <> 'revoked'", 'if false'],
  ['full UPDATE grant instead of record column', 'grant update (record) on public.credit_template_approvals to authenticated;', 'grant update, delete on public.credit_template_approvals to authenticated;'],
  ['delete granted on recipients', 'grant select, insert on public.credit_recipients to authenticated;', 'grant select, insert, delete, truncate on public.credit_recipients to authenticated;'],
]

console.log('\nmutations:')
let survived = 0
for (const [name, from, to] of MUTATIONS) {
  if (!STAGED.includes(from)) {
    console.log(`  ?? ${name}: pattern not found (mutation not applied)`)
    survived++
    continue
  }
  const caught = await runAll(STAGED.replace(from, to), { quiet: true })
  if (caught.length) console.log(`  caught  ${name}  (${caught.length} check(s) failed)`)
  else {
    console.log(`  SURVIVED ${name}`)
    survived++
  }
}
if (survived) {
  console.error(`\n${survived} mutation(s) survived.`)
  process.exit(1)
}
console.log(`\n${CHECKS.length} checks passed; ${MUTATIONS.length}/${MUTATIONS.length} mutations caught.`)
