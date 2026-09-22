// Credit migration rehearsal against the PRODUCTION catalog shape (C3-009).
//
// fixtures/prod-shape-credit-2026-09-21.sql is a read-only catalog capture of
// production (tables, constraints, helpers, triggers, RLS, policies, grants for
// organizations / profiles / org_roles / dispute_clients). No row contents.
// Unlike credit-isolation.rehearsal.mjs (a hand-written minimal fixture), this one
// carries prod's real org_roles CHECK constraint, its recursive tenant_admin_write
// policy, and its real grants — which is how the C1 'credit_operator' role bug was
// found (prod's CHECK cannot hold that role).
//
// Applies, in order, the two staged credit migrations:
//   1. _staged/20260922120000_credit_case_foundation_STAGED.sql
//   2. _staged/20260923120000_credit_recipients_and_template_approvals_STAGED.sql
// and checks: existing rows preserved byte-for-byte (payload AND updated_at), FKs and
// ON DELETE behaviour, indexes, the optimistic-concurrency trigger still bumps
// updated_at, no 42P17 on any credit path, repeatable apply, and that the written
// ROLLBACK blocks return the catalog to exactly the production shape.
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/credit-migration-prodshape.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const PROD = await readFile(resolve(here, 'fixtures/prod-shape-credit-2026-09-21.sql'), 'utf8')
const CASE = await readFile(resolve(repo, 'supabase/migrations/_staged/20260922120000_credit_case_foundation_STAGED.sql'), 'utf8')
const REG = await readFile(resolve(repo, 'supabase/migrations/_staged/20260923120000_credit_recipients_and_template_approvals_STAGED.sql'), 'utf8')

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const OP = '00000000-0000-4000-8000-0000000000d1'
const TENANT = '00000000-0000-4000-8000-0000000000e1'
const CUST = '00000000-0000-4000-8000-0000000000c1'
const ORG_A = '00000000-0000-4000-8000-0000000000f1'
const ORG_B = '00000000-0000-4000-8000-0000000000f2'

const SEED = `
  insert into public.organizations (id, name) values ('${ORG_A}','Org A'), ('${ORG_B}','Org B');
  insert into auth.users values ('${ADMIN}','admin@x'),('${OP}','op@x'),('${TENANT}','tenant@x'),('${CUST}','cust@x');
  insert into public.profiles (id, email, role, organization_id) values
    ('${ADMIN}','admin@x','admin',null),('${OP}','op@x','customer','${ORG_A}'),
    ('${TENANT}','tenant@x','customer','${ORG_A}'),('${CUST}','cust@x','customer',null);
  insert into public.org_roles (org_id, user_id, role) values ('${ORG_A}','${TENANT}','tenant_admin');
  -- Prod has 0 dispute_clients today; rehearse WITH rows so preservation is tested.
  insert into public.dispute_clients (id, client_name, email, source, payload, imported_at, updated_at) values
    ('case-1','Fixture One','one@x','myfreescorenow','{"profile":{"id":"case-1"},"disputeRounds":[{"id":"r1","status":"sent"}]}','2026-09-01T00:00:00Z','2026-09-02T00:00:00Z'),
    ('case-2','Fixture Two','two@x','disputefox','{"profile":{"id":"case-2"}}','2026-09-03T00:00:00Z','2026-09-04T00:00:00Z');
`

async function fresh() {
  const db = new PGlite()
  await db.exec(PROD)
  await db.exec(SEED)
  return db
}
async function as(db, sub, sql) {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ''])
    await db.exec(`set local role ${sub ? 'authenticated' : 'anon'}`)
    const r = await db.query(sql)
    await db.exec('commit')
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 }
  } catch (error) {
    await db.exec('rollback')
    return { ok: false, error }
  }
}
const rows = async (db, sql) => (await db.query(sql)).rows

/** A catalog fingerprint of everything the migrations could touch. */
async function catalog(db) {
  return {
    columns: await rows(db, `select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
      where table_schema = 'public' order by 1, 2`),
    tables: await rows(db, `select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1`),
    indexes: await rows(db, `select indexname, indexdef from pg_indexes where schemaname = 'public' order by 1`),
    policies: await rows(db, `select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`),
    functions: await rows(db, `select proname from pg_proc where pronamespace = 'public'::regnamespace order by 1`),
    grants: await rows(db, `select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon','authenticated') order by 1, 2, 3`),
    triggers: await rows(db, `select tgname from pg_trigger where not tgisinternal order by 1`),
  }
}

function rollbackOf(sql) {
  return sql.split('-- ROLLBACK')[1].split('\n')
    .filter((l) => /^--\s+(drop|alter table) /.test(l))
    .map((l) => l.replace(/^--\s+/, ''))
    .join('\n')
}

let n = 0
async function check(name, fn) {
  await fn()
  n++
  console.log(`ok ${String(n).padStart(2)} ${name}`)
}

await check('baseline: the production shape reproduces the org_roles recursion (42P17) for signed-in users', async () => {
  const db = await fresh()
  const r = await as(db, TENANT, 'select * from public.org_roles')
  assert.equal(r.ok, false)
  assert.match(r.error.message, /infinite recursion/)
})

await check("finding: prod's org_roles CHECK cannot hold a 'credit_operator' role (why C1's design was changed)", async () => {
  const db = await fresh()
  await assert.rejects(db.exec(`insert into public.org_roles (org_id, user_id, role) values ('${ORG_A}','${OP}','credit_operator')`), /org_roles_role_check/)
})

await check('both staged migrations apply cleanly on the production shape, in order', async () => {
  const db = await fresh()
  await db.exec(CASE)
  await db.exec(REG)
})

await check('existing cases are preserved exactly — payload, timestamps, every column', async () => {
  const db = await fresh()
  const before = await rows(db, 'select id, client_name, email, source, external_id, payload, imported_at, created_at, updated_at from public.dispute_clients order by id')
  await db.exec(CASE)
  await db.exec(REG)
  const after = await rows(db, 'select id, client_name, email, source, external_id, payload, imported_at, created_at, updated_at, org_id, customer_user_id from public.dispute_clients order by id')
  assert.deepEqual(after.map(({ org_id, customer_user_id, ...r }) => r), before)
  assert.ok(after.every((r) => r.org_id === null && r.customer_user_id === null), 'new columns start empty')
})

await check('existing rows stay platform-admin only (org_id is null, so no operator reaches them)', async () => {
  const db = await fresh()
  await db.exec(CASE)
  await db.exec(`insert into public.credit_operator_grants (org_id, user_id, granted_by) values ('${ORG_A}','${OP}','${ADMIN}')`)
  assert.deepEqual((await as(db, OP, 'select id from public.dispute_clients')).rows, [])
  assert.deepEqual((await as(db, ADMIN, 'select id from public.dispute_clients order by id')).rows.map((r) => r.id), ['case-1', 'case-2'])
})

await check('no 42P17 anywhere on the credit paths, even for a user who holds an org_roles row', async () => {
  const db = await fresh()
  await db.exec(CASE)
  await db.exec(REG)
  await db.exec(`update public.dispute_clients set org_id = '${ORG_A}' where id = 'case-1'`)
  await db.exec(`insert into public.credit_operator_grants (org_id, user_id, granted_by) values ('${ORG_A}','${OP}','${ADMIN}')`)
  for (const sub of [ADMIN, OP, TENANT, CUST]) {
    for (const t of ['dispute_clients', 'credit_evidence', 'credit_operator_grants', 'credit_recipients', 'credit_template_approvals']) {
      const r = await as(db, sub, `select 1 from public.${t}`)
      assert.ok(r.ok || !/recursion/.test(r.error.message), `${t} as ${sub}: ${r.error?.message}`)
      assert.ok(r.ok, `${t} as ${sub} errored: ${r.error?.message}`)
    }
  }
  assert.deepEqual((await as(db, OP, 'select id from public.dispute_clients')).rows, [{ id: 'case-1' }])
  assert.deepEqual((await as(db, TENANT, 'select id from public.dispute_clients')).rows, [], "tenant_admin is not a credit operator")
})

await check('the updated_at trigger (optimistic concurrency) still moves on every update', async () => {
  const db = await fresh()
  await db.exec(CASE)
  const [{ updated_at: before }] = await rows(db, "select updated_at from public.dispute_clients where id = 'case-1'")
  await db.exec(`update public.dispute_clients set org_id = '${ORG_A}' where id = 'case-1'`)
  const [{ updated_at: after }] = await rows(db, "select updated_at from public.dispute_clients where id = 'case-1'")
  assert.ok(after > before)
  // A compare-and-swap on the OLD version now matches nothing.
  const cas = await as(db, ADMIN, `update public.dispute_clients set payload = '{}' where id = 'case-1' and updated_at = '${before.toISOString()}'`)
  assert.equal(cas.affected, 0)
})

await check('foreign keys: org delete is blocked by its cases; a deleted login unlinks, never deletes, a case; evidence blocks case delete', async () => {
  const db = await fresh()
  await db.exec(CASE)
  await db.exec(`update public.dispute_clients set org_id = '${ORG_B}', customer_user_id = '${CUST}' where id = 'case-2'`)
  await assert.rejects(db.exec(`delete from public.organizations where id = '${ORG_B}'`), /foreign key/)
  await db.exec(`delete from auth.users where id = '${CUST}'`)
  assert.deepEqual(await rows(db, "select customer_user_id from public.dispute_clients where id = 'case-2'"), [{ customer_user_id: null }])
  await db.exec("insert into public.credit_evidence (id, dispute_client_id, kind, description, source, uploaded_by) values ('e1','case-2','other','Document','operator','" + ADMIN + "')")
  await assert.rejects(db.exec("delete from public.dispute_clients where id = 'case-2'"), /foreign key/)
  // A grant goes when its org or user goes (it is access, not history of the case).
  await db.exec(`insert into public.credit_operator_grants (org_id, user_id, granted_by) values ('${ORG_A}','${OP}','${ADMIN}')`)
  await db.exec(`delete from auth.users where id = '${OP}'`)
  assert.deepEqual(await rows(db, 'select count(*)::int n from public.credit_operator_grants'), [{ n: 0 }])
})

await check('indexes exist: org, customer (unique, partial), evidence by case/org, approvals by template', async () => {
  const db = await fresh()
  await db.exec(CASE)
  await db.exec(REG)
  const names = (await rows(db, "select indexname from pg_indexes where schemaname='public'")).map((r) => r.indexname)
  for (const ix of ['dispute_clients_org_id_idx', 'dispute_clients_customer_user_id_key', 'credit_evidence_client_idx', 'credit_evidence_org_idx', 'credit_operator_grants_pkey', 'credit_recipients_pkey', 'credit_template_approvals_template_idx']) {
    assert.ok(names.includes(ix), `missing index ${ix}`)
  }
})

await check('repeatable: applying both migrations twice changes nothing', async () => {
  const db = await fresh()
  await db.exec(CASE)
  await db.exec(REG)
  const once = await catalog(db)
  await db.exec(CASE)
  await db.exec(REG)
  assert.deepEqual(await catalog(db), once)
})

await check('rollback (reverse order) returns the catalog to exactly the production shape, rows intact', async () => {
  const db = await fresh()
  const prod = await catalog(db)
  const data = await rows(db, 'select id, payload from public.dispute_clients order by id')
  await db.exec(CASE)
  await db.exec(REG)
  await db.exec(rollbackOf(REG))
  await db.exec(rollbackOf(CASE))
  assert.deepEqual(await catalog(db), prod)
  assert.deepEqual(await rows(db, 'select id, payload from public.dispute_clients order by id'), data)
})

await check("the original dispute_clients_admin_only policy is untouched throughout", async () => {
  const db = await fresh()
  const q = "select qual, with_check, cmd from pg_policies where policyname = 'dispute_clients_admin_only'"
  const before = await rows(db, q)
  await db.exec(CASE)
  await db.exec(REG)
  assert.deepEqual(await rows(db, q), before)
})

console.log(`\n${n} production-shape migration checks passed`)
