// Rehearses 20260917160000_profiles_protect_access_columns.sql in embedded
// PostgreSQL 17 (same major as production).
//
// It tests the INVARIANT, not the policy text: a signed-in customer cannot become
// staff/admin and cannot read another customer's rows by editing their own
// profile. The fixture copies production's helper functions, the policies on
// profiles/cases/rental_ledger/client_alerts, and Supabase's default grants,
// verbatim as read from the catalog on 2026-09-17.
//
// Every attack runs twice: against the fixture WITHOUT the migration (it must
// succeed there, so a passing run cannot be a broken test) and WITH it (it must
// fail). Each defence layer, the trigger and the column grants, is also tested
// with the other removed.
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/profiles-access-columns.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = await readFile(
  resolve(repo, 'supabase/migrations/20260917160000_profiles_protect_access_columns.sql'),
  'utf8'
)

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const C1 = '00000000-0000-4000-8000-0000000000c1'
const C2 = '00000000-0000-4000-8000-0000000000c2'
const ORG = '00000000-0000-4000-8000-0000000000f1'
const PKG = '00000000-0000-4000-8000-0000000000b1'
const C1_EMAIL = 'c1@example.test'
const C2_EMAIL = 'c2@example.test'
// Has case/ledger rows but no account: the target of an email swap.
const VICTIM_EMAIL = 'no-account@example.test'

const SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;

  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant insert, select, delete on auth.users to supabase_auth_admin, service_role;

  create type public.user_role as enum ('admin','internal_team','investor','vendor','customer');
  create type public.portal_role as enum ('client','team_member','manager','admin','super_admin');
  create type public.admin_scope as enum ('super','manager','finance','content');
  create type public.team_department as enum ('sales','support','training','ops','general');

  create table public.organizations (id uuid primary key);
  create table public.packages (id uuid primary key);

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique,
    full_name text,
    phone text,
    role public.user_role not null default 'customer',
    organization_id uuid references public.organizations(id) on delete set null,
    airtable_id text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    portal_role public.portal_role not null default 'client',
    admin_scope public.admin_scope,
    team_department public.team_department,
    package_id uuid references public.packages(id) on delete set null,
    respond_capable boolean,
    responder_certs jsonb,
    telegram_chat_id text,
    is_certified boolean not null default false,
    affiliate_code text,
    unlock_status text
  );

  create table public.org_roles (org_id uuid, user_id uuid, role text);
  create table public.cases (id serial primary key, customer_email text, subject text);
  create table public.rental_ledger (id serial primary key, customer_email text, visible_to_client boolean, title text);
  create table public.client_alerts (id serial primary key, customer_email text, org_id uuid, title text);

  -- Production helper bodies, verbatim.
  create function public.is_admin() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select coalesce((
      select role = 'admin'
        or coalesce(portal_role::text, '') in ('admin', 'super_admin')
      from public.profiles where id = auth.uid()
    ), false) $f$;
  create function public.is_staff() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select coalesce((
      select role in ('admin', 'internal_team')
        or coalesce(portal_role::text, '') in ('team_member', 'manager', 'admin', 'super_admin')
      from public.profiles where id = auth.uid()
    ), false) $f$;
  create function public.is_internal_ops() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select exists (select 1 from public.profiles
      where id = auth.uid() and role::text in ('admin', 'internal_team', 'investor')) $f$;
  create function public."current_role"() returns public.user_role language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select role from public.profiles where id = auth.uid() $f$;
  create function public.current_profile_email() returns text language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select email from public.profiles where id = auth.uid() $f$;
  create function public.is_org_member(p_org_id uuid) returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select exists (select 1 from public.org_roles where org_id = p_org_id and user_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid()
        and organization_id = p_org_id and role::text in ('admin', 'internal_team')) $f$;
  create function public.handle_new_auth_user() returns trigger language plpgsql security definer
    set search_path to 'public', 'pg_temp' as $f$
    begin
      insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
      return new;
    end; $f$;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_auth_user();

  alter table public.profiles enable row level security;
  alter table public.org_roles enable row level security;
  alter table public.cases enable row level security;
  alter table public.rental_ledger enable row level security;
  alter table public.client_alerts enable row level security;

  -- Production policies, verbatim.
  create policy profiles_admin_all on public.profiles as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
  create policy profiles_self_read on public.profiles as PERMISSIVE for SELECT to public using (((id = ( SELECT auth.uid() AS uid)) OR is_staff() OR is_admin()));
  create policy profiles_self_update on public.profiles as PERMISSIVE for UPDATE to public using (((id = ( SELECT auth.uid() AS uid)) OR is_admin())) with check (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));
  create policy self_read on public.org_roles for SELECT using ((user_id = auth.uid()) OR is_staff());
  create policy cases_client_email_read on public.cases as PERMISSIVE for SELECT to public using (((customer_email IS NOT NULL) AND (lower(customer_email) = lower(( SELECT profiles.email FROM profiles WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));
  create policy cases_internal_read on public.cases as PERMISSIVE for SELECT to authenticated using (is_internal_ops());
  create policy rental_ledger_client_read on public.rental_ledger as PERMISSIVE for SELECT to public using (((lower(customer_email) = lower(current_profile_email())) AND (COALESCE(visible_to_client, true) = true)));
  create policy rental_ledger_investor_read on public.rental_ledger as PERMISSIVE for SELECT to public using (((public."current_role"() = 'investor'::user_role) OR is_admin()));
  create policy rental_ledger_staff on public.rental_ledger as PERMISSIVE for ALL to public using (is_staff()) with check (is_staff());
  create policy client_alerts_client_read on public.client_alerts as PERMISSIVE for SELECT to public using ((lower(customer_email) = lower(current_profile_email())));
  create policy client_alerts_org_all on public.client_alerts as PERMISSIVE for ALL to public using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id)))) with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
  create policy client_alerts_staff on public.client_alerts as PERMISSIVE for ALL to public using (is_staff()) with check (is_staff());

  -- Supabase's default grants, as production still carries them on profiles.
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  revoke truncate on all tables in schema public from anon, authenticated;
`

const SEED = `
  insert into public.organizations values ('${ORG}');
  insert into public.packages values ('${PKG}');
  insert into auth.users values
    ('${ADMIN}', 'admin@example.test', now()), ('${C1}', '${C1_EMAIL}', now()), ('${C2}', '${C2_EMAIL}', now());
  update public.profiles set role = 'admin', portal_role = 'admin', full_name = 'Admin' where id = '${ADMIN}';
  update public.profiles set full_name = 'Customer One', package_id = '${PKG}' where id = '${C1}';
  insert into public.cases (customer_email, subject) values
    ('${C1_EMAIL}', 'c1 case'), ('${C2_EMAIL}', 'c2 case'), ('${VICTIM_EMAIL}', 'victim case');
  insert into public.rental_ledger (customer_email, visible_to_client, title) values
    ('${C1_EMAIL}', true, 'c1 deposit'), ('${C2_EMAIL}', true, 'c2 deposit'), ('${VICTIM_EMAIL}', true, 'victim deposit');
  insert into public.client_alerts (customer_email, title) values
    ('${C1_EMAIL}', 'c1 alert'), ('${C2_EMAIL}', 'c2 alert'), ('${VICTIM_EMAIL}', 'victim alert');
`

async function build({ migrate, dropTrigger = false, regrantUpdate = false } = {}) {
  const db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(SEED)
  if (migrate) await db.exec(migration)
  if (dropTrigger) await db.exec('drop trigger profiles_block_protected_self_edits on public.profiles')
  if (regrantUpdate) await db.exec('grant insert, update, delete on public.profiles to anon, authenticated')
  return db
}

// Run one statement as a caller, in its own transaction, the way PostgREST does.
async function as(db, who, sql, params = []) {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who.sub ?? ''])
    if (who.role !== 'postgres') await db.exec(`set local role ${who.role}`)
    const r = await db.query(sql, params)
    await db.exec('commit')
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 }
  } catch (error) {
    await db.exec('rollback')
    return { ok: false, error }
  }
}

const customer = (sub) => ({ role: 'authenticated', sub })
const admin = { role: 'authenticated', sub: ADMIN }
const anon = { role: 'anon' }
const service = { role: 'service_role' }
const superuser = { role: 'postgres' }

const profile = async (db, id) => (await db.query('select * from public.profiles where id = $1', [id])).rows[0]
const count = async (db, who, table, email) =>
  (await as(db, who, `select count(*)::int n from public.${table} where customer_email = $1`, [email])).rows[0].n
const flag = async (db, who, fn) => (await as(db, who, `select public.${fn}() v`)).rows[0].v

// A value different from the seeded one, for every column a user must not change.
const PROTECTED_VALUES = {
  id: 'ffffffff-0000-4000-8000-000000000000',
  email: VICTIM_EMAIL,
  role: 'admin',
  organization_id: ORG,
  airtable_id: 'recStolen',
  created_at: '2000-01-01T00:00:00Z',
  portal_role: 'super_admin',
  admin_scope: 'super',
  team_department: 'ops',
  package_id: null,
  respond_capable: true,
  responder_certs: '["stolen"]',
  telegram_chat_id: '999999',
  is_certified: true,
  affiliate_code: 'STOLEN',
  unlock_status: 'unlocked',
}
const SELF_EDITABLE = ['full_name', 'phone', 'updated_at']

let n = 0
const ok = (msg) => console.log(`ok ${String(++n).padStart(2)} ${msg}`)

// Every profiles column is either self-editable or has a test value. A column
// added to production later fails here until someone decides which it is.
{
  const db = await build()
  const cols = (await db.query(`select column_name c from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' order by ordinal_position`)).rows.map((r) => r.c)
  assert.deepEqual(cols.filter((c) => !SELF_EDITABLE.includes(c)).sort(), Object.keys(PROTECTED_VALUES).sort())
  ok('fixture covers every profiles column')
}

// ---- 1. The attacks work WITHOUT the migration (the test can see the hole) ----
{
  const db = await build({ migrate: false })
  assert.equal(await flag(db, customer(C1), 'is_admin'), false)
  const r = await as(db, customer(C1), `update public.profiles set role = 'admin' where id = $1`, [C1])
  assert.equal(r.ok, true)
  assert.equal((await profile(db, C1)).role, 'admin')
  assert.equal(await flag(db, customer(C1), 'is_admin'), true)
  assert.equal(await count(db, customer(C1), 'cases', C2_EMAIL), 1, 'self-made admin reads another customer')
  ok('BEFORE: customer sets own role=admin and gains is_admin() + other customers\' cases')
}
{
  const db = await build({ migrate: false })
  assert.equal(await count(db, customer(C1), 'cases', VICTIM_EMAIL), 0)
  assert.equal((await as(db, customer(C1), `update public.profiles set email = $1 where id = $2`, [VICTIM_EMAIL, C1])).ok, true)
  assert.equal(await count(db, customer(C1), 'cases', VICTIM_EMAIL), 1)
  assert.equal(await count(db, customer(C1), 'rental_ledger', VICTIM_EMAIL), 1)
  assert.equal(await count(db, customer(C1), 'client_alerts', VICTIM_EMAIL), 1)
  ok('BEFORE: customer swaps own email and reads that person\'s cases, ledger, alerts')
}

// ---- 2. WITH the migration ----
for (const [label, opts] of [
  ['migration (trigger + grants)', { migrate: true }],
  ['grants only (trigger dropped)', { migrate: true, dropTrigger: true }],
  ['trigger only (table grants restored)', { migrate: true, regrantUpdate: true }],
]) {
  // Every protected column, one at a time, as the customer on their own row.
  for (const [col, value] of Object.entries(PROTECTED_VALUES)) {
    const db = await build(opts)
    const before = await profile(db, C1)
    const r = await as(db, customer(C1), `update public.profiles set ${col} = $1 where id = $2`, [value, C1])
    assert.equal(r.ok, false, `${label}: customer changed profiles.${col}`)
    assert.equal(r.error.code, '42501', `${label}: ${col} rejected with ${r.error.code} ${r.error.message}`)
    assert.deepEqual(await profile(db, C1), before, `${label}: ${col} row unchanged`)
  }
  ok(`${label}: customer cannot change any of ${Object.keys(PROTECTED_VALUES).length} protected columns on own row`)

  const db = await build(opts)

  // Smuggling a protected column alongside an allowed one.
  let r = await as(db, customer(C1), `update public.profiles set full_name = 'x', role = 'internal_team' where id = $1`, [C1])
  assert.equal(r.ok, false)
  assert.equal((await profile(db, C1)).role, 'customer')
  // Upsert onto own id, insert of a fresh admin row, delete.
  r = await as(db, customer(C1), `insert into public.profiles (id, email, role) values ($1, $2, 'admin')
    on conflict (id) do update set role = 'admin'`, [C1, C1_EMAIL])
  assert.equal(r.ok, false)
  r = await as(db, customer(C1), `insert into public.profiles (id, email, role, portal_role) values ($1, 'new@example.test', 'admin', 'super_admin')`,
    ['eeeeeeee-0000-4000-8000-000000000000'])
  assert.equal(r.ok, false)
  // Without grants a DELETE errors; with grants restored RLS still hides the row (0 rows). Either way it survives.
  await as(db, customer(C1), `delete from public.profiles where id = $1`, [C1])
  assert.ok(await profile(db, C1), 'own profile not deletable')
  assert.equal((await profile(db, C1)).role, 'customer')
  ok(`${label}: combined update, upsert, insert and delete give no path to a role`)

  for (const who of [customer(C1), anon]) {
    r = await as(db, who, `update public.profiles set role = 'admin' where id = $1`, [C2])
    assert.ok(!r.ok || r.affected === 0)
  }
  r = await as(db, anon, `insert into public.profiles (id, email) values ($1, 'anon@example.test')`, ['dddddddd-0000-4000-8000-000000000000'])
  assert.equal(r.ok, false)
  assert.equal((await profile(db, C2)).role, 'customer')
  ok(`${label}: customer and anon cannot change another profile or create one`)

  // The customer stays a customer in every helper, and sees only their own rows.
  for (const fn of ['is_admin', 'is_staff', 'is_internal_ops']) assert.equal(await flag(db, customer(C1), fn), false, fn)
  for (const table of ['cases', 'rental_ledger', 'client_alerts']) {
    assert.equal(await count(db, customer(C1), table, C1_EMAIL), 1, `${table} own`)
    assert.equal(await count(db, customer(C1), table, C2_EMAIL), 0, `${table} other customer`)
    assert.equal(await count(db, customer(C1), table, VICTIM_EMAIL), 0, `${table} no-account email`)
  }
  ok(`${label}: helpers stay false; customer A reads own rows, not customer B's or an unclaimed email's`)
}

// ---- 3. Legitimate writes still work ----
{
  const db = await build({ migrate: true })

  let r = await as(db, customer(C1), `update public.profiles set full_name = 'New Name', phone = '+15550001111', updated_at = now() where id = $1`, [C1])
  assert.equal(r.ok, true)
  assert.equal(r.affected, 1)
  assert.deepEqual([(await profile(db, C1)).full_name, (await profile(db, C1)).phone], ['New Name', '+15550001111'])
  ok('customer can still edit own full_name and phone')

  r = await as(db, admin, `update public.profiles set full_name = 'Renamed by admin' where id = $1`, [C2])
  assert.equal(r.ok, true)
  assert.equal((await profile(db, C2)).full_name, 'Renamed by admin')
  r = await as(db, admin, `update public.profiles set role = 'internal_team' where id = $1`, [C2])
  assert.equal(r.ok, false, 'deliberate: role changes go through service_role, not an admin JWT')
  ok('admin JWT edits display fields of others; role changes via JWT refused by design')

  r = await as(db, service, `update public.profiles set role = 'internal_team', portal_role = 'team_member', email = 'moved@example.test' where id = $1`, [C2])
  assert.equal(r.ok, true)
  assert.equal(r.affected, 1)
  assert.equal(await flag(db, customer(C2), 'is_staff'), true)
  r = await as(db, superuser, `update public.profiles set role = 'investor' where id = $1`, [C1])
  assert.equal(r.ok, true)
  ok('service_role and postgres can still change role, portal_role and email')

  r = await as(db, { role: 'supabase_auth_admin' }, `insert into auth.users values ($1, 'signup@example.test', now())`,
    ['cccccccc-0000-4000-8000-000000000000'])
  assert.equal(r.ok, true, r.error?.message)
  const created = await profile(db, 'cccccccc-0000-4000-8000-000000000000')
  assert.deepEqual([created.email, created.role, created.portal_role], ['signup@example.test', 'customer', 'client'])
  ok('signup trigger still creates the profile (customer/client defaults)')

  r = await as(db, admin, `delete from public.packages where id = $1`, [PKG])
  assert.equal(r.ok, true, r.error?.message)
  r = await as(db, service, `delete from auth.users where id = $1`, [C1])
  assert.equal(r.ok, true, r.error?.message)
  assert.equal(await profile(db, C1), undefined)
  ok('foreign-key cascades through profiles still run (package set null, user delete)')

  await db.exec(migration)
  const [g] = (await db.query(`select
      has_table_privilege('authenticated', 'public.profiles', 'UPDATE') t_upd,
      has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') name_upd,
      has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') role_upd,
      has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE') email_upd,
      has_table_privilege('authenticated', 'public.profiles', 'INSERT') ins,
      has_table_privilege('anon', 'public.profiles', 'UPDATE') anon_upd,
      has_table_privilege('authenticated', 'public.profiles', 'SELECT') sel,
      (select count(*)::int from pg_trigger where tgname = 'profiles_block_protected_self_edits') triggers`)).rows
  assert.deepEqual(g, { t_upd: false, name_upd: true, role_upd: false, email_upd: false, ins: false, anon_upd: false, sel: true, triggers: 1 })
  ok('re-applying is a no-op; final grants are SELECT + UPDATE(full_name, phone, updated_at)')
}

console.log(`\n${n} checks passed`)
