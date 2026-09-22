// Credit data isolation rehearsal (Phase C1-014), embedded PostgreSQL 17 (PGlite).
//
// Two parts:
//   A. TODAY'S production rules for dispute_clients (read from the catalog
//      2026-09-21: RLS on, one policy `dispute_clients_admin_only` FOR ALL TO
//      authenticated USING/CHECK is_platform_admin(); anon has no grants;
//      authenticated has table grants) plus the applied profiles fix
//      (20260917160000), so a customer cannot promote themselves first.
//   B. The STAGED case foundation (_staged/20260922120000_credit_case_foundation_STAGED.sql):
//      org-scoped credit operators and the credit_evidence table.
//
// Every "cannot" is paired with a "can" for the right caller, so a broken fixture
// cannot pass by denying everyone.
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/credit-isolation.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const profilesFix = await readFile(resolve(repo, 'supabase/migrations/20260917160000_profiles_protect_access_columns.sql'), 'utf8')
// CREDIT_STAGED_SQL lets a mutation run point at a deliberately weakened copy.
const staged = await readFile(
  process.env.CREDIT_STAGED_SQL ?? resolve(repo, 'supabase/migrations/_staged/20260922120000_credit_case_foundation_STAGED.sql'),
  'utf8'
)

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const STAFF = '00000000-0000-4000-8000-0000000000b1'
const CUST_A = '00000000-0000-4000-8000-0000000000c1'
const CUST_B = '00000000-0000-4000-8000-0000000000c2'
const OP_A = '00000000-0000-4000-8000-0000000000d1'
const OP_B = '00000000-0000-4000-8000-0000000000d2'
const ORG_A = '00000000-0000-4000-8000-0000000000f1'
const ORG_B = '00000000-0000-4000-8000-0000000000f2'

const SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create type public.user_role as enum ('admin','internal_team','investor','vendor','customer');
  create type public.portal_role as enum ('client','team_member','manager','admin','super_admin');
  create table public.organizations (id uuid primary key);
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text, full_name text, phone text,
    role public.user_role not null default 'customer',
    portal_role public.portal_role not null default 'client',
    organization_id uuid references public.organizations(id),
    updated_at timestamptz default now()
  );
  create table public.org_roles (org_id uuid, user_id uuid, role text);

  create function public.is_platform_admin() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select exists ( select 1 from public.profiles where id = auth.uid() and role::text = 'admin' ); $f$;
  create function public.is_staff() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select coalesce((select role in ('admin','internal_team') or coalesce(portal_role::text,'') in ('team_member','manager','admin','super_admin')
      from public.profiles where id = auth.uid()), false) $f$;

  -- dispute_clients exactly as production (2026-09-21).
  create table public.dispute_clients (
    id text primary key, client_name text, email text, source text, external_id text,
    payload jsonb, imported_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
  );
  alter table public.dispute_clients enable row level security;
  create policy dispute_clients_admin_only on public.dispute_clients for ALL to authenticated
    using (is_platform_admin()) with check (is_platform_admin());

  alter table public.profiles enable row level security;
  create policy profiles_self_read on public.profiles for select using (id = auth.uid() or is_staff());
  create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to authenticated, service_role;
  grant select, insert, update on public.profiles to anon;
  revoke all on public.dispute_clients from anon;
  revoke truncate on all tables in schema public from anon, authenticated;
`

const SEED = `
  insert into public.organizations values ('${ORG_A}'), ('${ORG_B}');
  insert into auth.users values ('${ADMIN}','admin@x'),('${STAFF}','staff@x'),('${CUST_A}','a@x'),('${CUST_B}','b@x'),('${OP_A}','opa@x'),('${OP_B}','opb@x');
  insert into public.profiles (id, email, role) values
    ('${ADMIN}','admin@x','admin'),('${STAFF}','staff@x','internal_team'),
    ('${CUST_A}','a@x','customer'),('${CUST_B}','b@x','customer'),
    ('${OP_A}','opa@x','customer'),('${OP_B}','opb@x','customer');
  insert into public.org_roles values ('${ORG_A}','${OP_A}','credit_operator'), ('${ORG_B}','${OP_B}','credit_operator'), ('${ORG_A}','${STAFF}','member');
  insert into public.dispute_clients (id, client_name, email, source, payload) values
    ('client-a','Client A','a@x','myfreescorenow','{"profile":{"id":"client-a"}}'),
    ('client-b','Client B','b@x','disputefox','{"profile":{"id":"client-b"}}');
`

async function build({ stagedToo = false } = {}) {
  const db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(SEED)
  await db.exec(profilesFix.replace(/grant update \(full_name, phone, updated_at\) on public\.profiles to authenticated;/, 'grant update (full_name, phone, updated_at) on public.profiles to authenticated;'))
  if (stagedToo) {
    await db.exec(staged)
    await db.exec(`update public.dispute_clients set org_id = '${ORG_A}' where id = 'client-a';
                   update public.dispute_clients set org_id = '${ORG_B}' where id = 'client-b';`)
  }
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
const ids = (r) => (r.ok ? r.rows.map((x) => x.id).sort() : `ERR ${r.error?.message}`)

let n = 0
async function check(name, fn) {
  await fn()
  n++
  console.log(`ok ${String(n).padStart(2)} ${name}`)
}

// ------------------------------------------------------------ A. today
await check('A: platform admin reads every credit client (the one allowed reader today)', async () => {
  const db = await build()
  assert.deepEqual(ids(await as(db, user(ADMIN), 'select id from public.dispute_clients')), ['client-a', 'client-b'])
})

await check("A: customer A cannot read customer B's report — or their own (admin-only store)", async () => {
  const db = await build()
  assert.deepEqual(ids(await as(db, user(CUST_A), 'select id from public.dispute_clients')), [])
  assert.deepEqual(ids(await as(db, user(CUST_A), "select id from public.dispute_clients where id = 'client-b'")), [])
})

await check('A: ordinary staff (internal_team) get no credit access', async () => {
  const db = await build()
  assert.deepEqual(ids(await as(db, user(STAFF), 'select id from public.dispute_clients')), [])
  const w = await as(db, user(STAFF), "update public.dispute_clients set payload = '{}' where id = 'client-a'")
  assert.ok(!w.ok || w.affected === 0)
})

await check('A: a customer cannot promote themselves to reach credit data (profiles fix applied)', async () => {
  const db = await build()
  const esc = await as(db, user(CUST_A), `update public.profiles set role = 'admin' where id = '${CUST_A}'`)
  assert.ok(!esc.ok, 'self-promotion must be refused')
  assert.deepEqual(ids(await as(db, user(CUST_A), 'select id from public.dispute_clients')), [])
})

await check('A: public callers cannot enumerate, insert or delete credit records', async () => {
  const db = await build()
  for (const sql of [
    'select id from public.dispute_clients',
    "insert into public.dispute_clients (id) values ('x')",
    "delete from public.dispute_clients where id = 'client-a'",
  ]) {
    const r = await as(db, anon, sql)
    assert.ok(!r.ok, `anon must be refused: ${sql}`)
  }
})

await check('A: a customer cannot plant a credit record or rewrite one', async () => {
  const db = await build()
  const ins = await as(db, user(CUST_A), "insert into public.dispute_clients (id, payload) values ('planted', '{}')")
  assert.ok(!ins.ok, 'insert must fail the RLS check')
  const upd = await as(db, user(CUST_A), "update public.dispute_clients set payload = '{}' where id = 'client-b'")
  assert.ok(!upd.ok || upd.affected === 0)
})

// ------------------------------------------------------------ B. staged foundation
await check("B: an org A credit operator sees org A's client and not org B's", async () => {
  const db = await build({ stagedToo: true })
  assert.deepEqual(ids(await as(db, user(OP_A), 'select id from public.dispute_clients')), ['client-a'])
  assert.deepEqual(ids(await as(db, user(OP_B), 'select id from public.dispute_clients')), ['client-b'])
})

await check('B: an org A operator cannot move a client into their org or edit org B', async () => {
  const db = await build({ stagedToo: true })
  const steal = await as(db, user(OP_A), `update public.dispute_clients set org_id = '${ORG_A}' where id = 'client-b'`)
  assert.ok(!steal.ok || steal.affected === 0)
  const plant = await as(db, user(OP_A), `insert into public.dispute_clients (id, org_id, payload) values ('p', '${ORG_B}', '{}')`)
  assert.ok(!plant.ok, 'inserting into another org must fail')
})

await check('B: staff with a plain org membership are still not credit operators', async () => {
  const db = await build({ stagedToo: true })
  assert.deepEqual(ids(await as(db, user(STAFF), 'select id from public.dispute_clients')), [])
})

await check("B: evidence — org A's operator files and reads org A evidence; org B's cannot see it", async () => {
  const db = await build({ stagedToo: true })
  const add = await as(db, user(OP_A), "insert into public.credit_evidence (id, dispute_client_id, kind, description, source) values ('e1','client-a','payment_record','Bank statement for March','customer')")
  assert.ok(add.ok, `org A operator should add evidence: ${add.error?.message}`)
  assert.deepEqual(ids(await as(db, user(OP_A), 'select id from public.credit_evidence')), ['e1'])
  assert.deepEqual(ids(await as(db, user(OP_B), 'select id from public.credit_evidence')), [])
  assert.deepEqual(ids(await as(db, user(CUST_B), 'select id from public.credit_evidence')), [])
  assert.deepEqual(ids(await as(db, user(ADMIN), 'select id from public.credit_evidence')), ['e1'])
})

await check("B: evidence cannot be filed against another org's client, or re-homed", async () => {
  const db = await build({ stagedToo: true })
  const cross = await as(db, user(OP_A), "insert into public.credit_evidence (id, dispute_client_id, kind, description, source) values ('e2','client-b','other','Something about B','operator')")
  assert.ok(!cross.ok, 'org A operator must not attach evidence to org B client')
  const forged = await as(db, user(OP_A), `insert into public.credit_evidence (id, dispute_client_id, org_id, kind, description, source) values ('e3','client-a','${ORG_B}','other','Forged org','operator')`)
  assert.ok(!forged.ok, 'org_id is not writable by the caller')
})

await check('B: evidence has no public URLs, no delete, and anon gets nothing', async () => {
  const db = await build({ stagedToo: true })
  const url = await as(db, user(ADMIN), "insert into public.credit_evidence (id, dispute_client_id, kind, description, storage_path, source) values ('e4','client-a','other','Doc','https://public.example/x.pdf','operator')")
  assert.ok(!url.ok, 'a URL must be rejected as a storage path')
  await as(db, user(OP_A), "insert into public.credit_evidence (id, dispute_client_id, kind, description, source) values ('e5','client-a','other','Doc','operator')")
  const del = await as(db, user(OP_A), "delete from public.credit_evidence where id = 'e5'")
  assert.ok(!del.ok, 'API roles cannot delete evidence')
  assert.ok(!(await as(db, anon, 'select id from public.credit_evidence')).ok)
})

// ------------------------------------------------------------ C. C2 additions (staged)
await check('C: a linked customer still cannot read their case row directly (minimised view only, via server)', async () => {
  const db = await build({ stagedToo: true })
  await db.exec(`update public.dispute_clients set customer_user_id = '${CUST_A}' where id = 'client-a'`)
  assert.deepEqual(ids(await as(db, user(CUST_A), 'select id from public.dispute_clients')), [])
  assert.deepEqual(ids(await as(db, user(OP_A), 'select id from public.dispute_clients')), ['client-a'], 'operator still sees it')
})

await check('C: one case per customer login', async () => {
  const db = await build({ stagedToo: true })
  await db.exec(`update public.dispute_clients set customer_user_id = '${CUST_A}' where id = 'client-a'`)
  await assert.rejects(db.exec(`update public.dispute_clients set customer_user_id = '${CUST_A}' where id = 'client-b'`))
})

await check('C: evidence starts pending review; bad review states, non-allowed types and oversize are refused', async () => {
  const db = await build({ stagedToo: true })
  const ok = await as(db, user(OP_A), "insert into public.credit_evidence (id, dispute_client_id, kind, description, source, mime, size_bytes) values ('e1','client-a','payment_record','Bank statement','customer','application/pdf',1000)")
  assert.ok(ok.ok, ok.error?.message)
  assert.deepEqual((await db.query("select review_state from public.credit_evidence where id='e1'")).rows, [{ review_state: 'pending_review' }])
  for (const sql of [
    "update public.credit_evidence set review_state = 'approved_by_ai' where id = 'e1'",
    "insert into public.credit_evidence (id, dispute_client_id, kind, description, source, mime) values ('e2','client-a','other','Page','customer','text/html')",
    "insert into public.credit_evidence (id, dispute_client_id, kind, description, source, size_bytes) values ('e3','client-a','other','Big','customer',10485761)",
  ]) {
    assert.ok(!(await as(db, user(OP_A), sql)).ok, `must be refused: ${sql}`)
  }
  assert.ok((await as(db, user(OP_A), "update public.credit_evidence set review_state = 'accepted' where id = 'e1'")).ok)
})

await check('C: a stored file cannot be swapped — path, hash, type and size are not updatable by API roles', async () => {
  const db = await build({ stagedToo: true })
  await as(db, user(OP_A), "insert into public.credit_evidence (id, dispute_client_id, kind, description, source, storage_path, sha256) values ('e1','client-a','other','Doc','operator','x/client-a/e1.pdf','" + 'a'.repeat(64) + "')")
  for (const col of ["storage_path = 'x/client-a/other.pdf'", "sha256 = '" + 'b'.repeat(64) + "'", "mime = 'image/png'", 'size_bytes = 5', `org_id = '${ORG_B}'`]) {
    assert.ok(!(await as(db, user(OP_A), `update public.credit_evidence set ${col} where id = 'e1'`)).ok, `must be refused: ${col}`)
  }
})

await check('C: deleting a case that has evidence is refused (no silent loss of the document record)', async () => {
  const db = await build({ stagedToo: true })
  await as(db, user(OP_A), "insert into public.credit_evidence (id, dispute_client_id, kind, description, source) values ('e1','client-a','other','Doc','operator')")
  const del = await as(db, user(ADMIN), "delete from public.dispute_clients where id = 'client-a'")
  assert.ok(!del.ok, 'RESTRICT must block the delete')
})

console.log(`\n${n} credit isolation checks passed`)
