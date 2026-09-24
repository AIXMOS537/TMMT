// Adversarial privilege-escalation regression suite for
// 20260917160000_profiles_protect_access_columns.sql (PR #249).
//
// Complements profiles-access-columns.rehearsal.mjs. That suite proves the
// protected-column invariant; this one attacks the SIDE DOORS a reviewer asked
// about in Phase 2A:
//   - hostile signup metadata (role / portal_role / organization_id in user_metadata)
//   - rewriting your own primary key to become another profile
//   - org_roles self-grant (tenant_admin bootstrap) -> is_org_member()
//   - installations self-insert -> backend_unlocked_for()
//   - an anon caller carrying a forged `sub` claim
//   - multi-statement / upsert-with-conflict tricks
//   - a before/after snapshot proving no attack left ANY trace on the row
//
// Production objects used here were re-read from the catalog on 2026-09-21
// (profiles columns, profiles/org_roles/installations policies, helper bodies,
// signup trigger) and match the 2026-09-17 fixture.
//
// Every escalation is run BEFORE the migration (where the chained attack must
// work, proving the test can fail) and AFTER it (where it must not).
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/profiles-escalation-adversarial.rehearsal.mjs
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
const NEWBIE = '00000000-0000-4000-8000-0000000000e1'
const ORG = '00000000-0000-4000-8000-0000000000f1'

const SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key, email text, email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb,
    raw_app_meta_data jsonb default '{}'::jsonb
  );
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

  -- production column list, 2026-09-21
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
  create table public.installations (
    id serial primary key, org_id uuid, user_id uuid, status text,
    paid_at timestamptz, setup_completed_at timestamptz, comprehension_passed_at timestamptz
  );

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
  create function public.is_platform_admin() returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select exists ( select 1 from public.profiles where id = auth.uid() and role::text = 'admin' ); $f$;
  create function public.is_org_member(p_org_id uuid) returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    select exists (select 1 from public.org_roles where org_id = p_org_id and user_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid()
        and organization_id = p_org_id and role::text in ('admin', 'internal_team')) $f$;
  create function public.backend_unlocked_for(p_user uuid) returns boolean language sql stable security definer
    set search_path to 'public', 'pg_temp' as $f$
    SELECT CASE
      WHEN (SELECT role FROM public.profiles WHERE id = p_user) = 'admin' THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.installations i
        JOIN public.profiles p ON p.organization_id = i.org_id
        WHERE p.id = p_user AND i.status = 'active' AND i.paid_at IS NOT NULL
          AND i.setup_completed_at IS NOT NULL AND i.comprehension_passed_at IS NOT NULL)
    END; $f$;

  -- Signup: the ATTACHED trigger (handle_new_auth_user) and the unattached
  -- legacy handle_new_user, both verbatim. Only full_name is read from metadata.
  create function public.handle_new_auth_user() returns trigger language plpgsql security definer
    set search_path to 'public', 'pg_temp' as $f$
    begin
      insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
      return new;
    end; $f$;
  create function public.handle_new_user() returns trigger language plpgsql security definer
    set search_path to 'public', 'pg_temp' as $f$
    begin
      insert into public.profiles (id, email, full_name)
      values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
      on conflict (id) do nothing;
      return new;
    end; $f$;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_auth_user();

  alter table public.profiles enable row level security;
  alter table public.org_roles enable row level security;
  alter table public.installations enable row level security;

  -- Production policies, verbatim (2026-09-21).
  create policy profiles_admin_all on public.profiles as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());
  create policy profiles_self_read on public.profiles as PERMISSIVE for SELECT to public using (((id = ( SELECT auth.uid() AS uid)) OR is_staff() OR is_admin()));
  create policy profiles_self_update on public.profiles as PERMISSIVE for UPDATE to public using (((id = ( SELECT auth.uid() AS uid)) OR is_admin())) with check (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));
  create policy self_read on public.org_roles for SELECT using ((user_id = auth.uid()) OR is_staff());
  create policy tenant_admin_write on public.org_roles for ALL to public
    using ((is_staff() OR (EXISTS ( SELECT 1 FROM org_roles r WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))))
    with check ((is_staff() OR (EXISTS ( SELECT 1 FROM org_roles r WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))));
  create policy staff_all_installations on public.installations for ALL to authenticated using (is_staff()) with check (is_staff());
  create policy self_read on public.installations for SELECT to public using (((user_id = auth.uid()) OR is_staff()));

  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  revoke truncate on all tables in schema public from anon, authenticated;
`

const SEED = `
  insert into public.organizations values ('${ORG}');
  insert into auth.users (id, email, email_confirmed_at) values
    ('${ADMIN}', 'admin@example.test', now()), ('${C1}', 'c1@example.test', now()), ('${C2}', 'c2@example.test', now());
  update public.profiles set role = 'admin', portal_role = 'admin' where id = '${ADMIN}';
`

async function build({ migrate }) {
  const db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(SEED)
  if (migrate) await db.exec(migration)
  return db
}

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
const anonForged = (sub) => ({ role: 'anon', sub })
const authAdmin = { role: 'supabase_auth_admin' }

const row = async (db, id) => (await db.query('select * from public.profiles where id = $1', [id])).rows[0]
const helpers = async (db, sub) =>
  (await as(db, customer(sub), `select is_admin() a, is_staff() s, is_platform_admin() p,
     is_org_member($1::uuid) m, backend_unlocked_for($2::uuid) u`, [ORG, sub])).rows[0]
const allFalse = { a: false, s: false, p: false, m: false, u: false }

let n = 0
async function check(name, fn) {
  await fn()
  n++
  console.log(`ok ${String(n).padStart(2)} ${name}`)
}

// ---------------------------------------------------------------- signup
await check('hostile signup metadata never yields a privileged profile (attached + legacy trigger)', async () => {
  for (const migrate of [false, true]) {
    const db = await build({ migrate })
    await db.exec(`create trigger legacy_signup after insert on auth.users
      for each row execute function public.handle_new_user()`)
    const hostile = JSON.stringify({ role: 'admin', portal_role: 'super_admin', organization_id: ORG,
      is_certified: true, unlock_status: 'unlocked', full_name: 'Mallory' })
    const r = await as(db, authAdmin,
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, 'new@example.test', now(), $2::jsonb)`,
      [NEWBIE, hostile])
    assert.ok(r.ok, `signup insert failed: ${r.error?.message}`)
    const p = await row(db, NEWBIE)
    assert.equal(p.role, 'customer')
    assert.equal(p.portal_role, 'client')
    assert.equal(p.organization_id, null)
    assert.equal(p.is_certified, false)
    assert.equal(p.unlock_status, null)
    assert.deepEqual(await helpers(db, NEWBIE), allFalse)
  }
})

// ---------------------------------------------------------------- primary key rewrite
await check('customer cannot rewrite own id (take over another profile / orphan own row)', async () => {
  // Before: already refused, by profiles_self_update WITH CHECK (id = auth.uid()).
  // Asserted in both states so a future policy rewrite that drops the check is caught.
  const before = await build({ migrate: false })
  await before.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${NEWBIE}', 'spare@example.test', now())`)
  await before.exec(`delete from public.profiles where id = '${NEWBIE}'`)
  const b = await as(before, customer(C1), `update public.profiles set id = $1 where id = $2`, [NEWBIE, C1])
  assert.ok(!b.ok, 'id rewrite is already refused by the WITH CHECK before the migration')

  const after = await build({ migrate: true })
  await after.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${NEWBIE}', 'spare@example.test', now())`)
  await after.exec(`delete from public.profiles where id = '${NEWBIE}'`)
  const snap = await row(after, C1)
  for (const target of [NEWBIE, ADMIN]) {
    const a = await as(after, customer(C1), `update public.profiles set id = $1 where id = $2`, [target, C1])
    assert.ok(!a.ok, `id rewrite to ${target} must be refused`)
  }
  assert.deepEqual(await row(after, C1), snap)
})

// ---------------------------------------------------------------- org_roles side door
await check('org_roles: customer cannot self-grant tenant_admin, directly or via a forged role', async () => {
  for (const migrate of [false, true]) {
    const db = await build({ migrate })
    const direct = await as(db, customer(C1),
      `insert into public.org_roles (org_id, user_id, role) values ($1, $2, 'tenant_admin')`, [ORG, C1])
    assert.ok(!direct.ok, 'direct tenant_admin bootstrap must be refused by the policy in both states')
  }
  // Production's tenant_admin_write policy queries org_roles from inside its own
  // policy, so EVERY user-JWT read/write of org_roles fails with 42P17 (infinite
  // recursion) today, even for staff (confirmed on prod 2026-09-21, read-only).
  // That fails closed. If someone repairs the recursion later, the chained attack
  // (role=admin -> is_staff() -> org_roles write) becomes real without this fix,
  // so the AFTER assertions below are the ones that matter.
  const before = await build({ migrate: false })
  assert.ok((await as(before, customer(C1), `update public.profiles set role = 'admin' where id = $1`, [C1])).ok)
  const chained = await as(before, customer(C1),
    `insert into public.org_roles (org_id, user_id, role) values ($1, $2, 'tenant_admin')`, [ORG, C1])
  assert.ok(!chained.ok && chained.error?.code === '42P17', 'expected the known org_roles policy recursion')

  const after = await build({ migrate: true })
  assert.ok(!(await as(after, customer(C1), `update public.profiles set role = 'admin' where id = $1`, [C1])).ok)
  assert.ok(!(await as(after, customer(C1),
    `insert into public.org_roles (org_id, user_id, role) values ($1, $2, 'tenant_admin')`, [ORG, C1])).ok)
  assert.deepEqual(await helpers(after, C1), allFalse)

  // Same chain with the recursion repaired (the likely future policy shape).
  const repairPolicy = `
    create function public.is_tenant_admin_of(p_org uuid) returns boolean language sql stable security definer
      set search_path to 'public', 'pg_temp' as $f$
      select exists (select 1 from public.org_roles where org_id = p_org and user_id = auth.uid() and role = 'tenant_admin') $f$;
    drop policy tenant_admin_write on public.org_roles;
    create policy tenant_admin_write on public.org_roles for ALL to public
      using (is_staff() or is_tenant_admin_of(org_id)) with check (is_staff() or is_tenant_admin_of(org_id));`
  const fixedBefore = await build({ migrate: false })
  await fixedBefore.exec(repairPolicy)
  assert.ok((await as(fixedBefore, customer(C1), `update public.profiles set role = 'admin' where id = $1`, [C1])).ok)
  assert.ok((await as(fixedBefore, customer(C1),
    `insert into public.org_roles (org_id, user_id, role) values ($1, $2, 'tenant_admin')`, [ORG, C1])).ok,
    'with the recursion repaired, the chain must work before the migration')
  const fixedAfter = await build({ migrate: true })
  await fixedAfter.exec(repairPolicy)
  assert.ok(!(await as(fixedAfter, customer(C1), `update public.profiles set role = 'admin' where id = $1`, [C1])).ok)
  assert.ok(!(await as(fixedAfter, customer(C1),
    `insert into public.org_roles (org_id, user_id, role) values ($1, $2, 'tenant_admin')`, [ORG, C1])).ok,
    'with the recursion repaired, the migration must still block the chain')
})

// ---------------------------------------------------------------- installations side door
await check('installations: customer cannot unlock the backend for themselves', async () => {
  const ins = `insert into public.installations (org_id, user_id, status, paid_at, setup_completed_at, comprehension_passed_at)
               values ($1, $2, 'active', now(), now(), now())`
  // Before: set own organization_id + role, then insert an "active paid" install.
  const before = await build({ migrate: false })
  assert.ok((await as(before, customer(C1), `update public.profiles set organization_id = $1, role = 'internal_team' where id = $2`, [ORG, C1])).ok)
  assert.ok((await as(before, customer(C1), ins, [ORG, C1])).ok, 'chained attack must work before the migration')
  assert.equal((await helpers(before, C1)).u, true)

  const after = await build({ migrate: true })
  assert.ok(!(await as(after, customer(C1), `update public.profiles set organization_id = $1 where id = $2`, [ORG, C1])).ok)
  assert.ok(!(await as(after, customer(C1), ins, [ORG, C1])).ok, 'installations insert must be refused (is_staff false)')
  assert.deepEqual(await helpers(after, C1), allFalse)
})

// ---------------------------------------------------------------- unauthenticated
await check('anon with a forged sub claim cannot read or write any profile', async () => {
  for (const migrate of [false, true]) {
    const db = await build({ migrate })
    const snap = await row(db, C1)
    const read = await as(db, anonForged(C1), `select * from public.profiles`)
    // Before the fix anon still has table grants, but RLS lets it see C1's row
    // when a sub is forged; after the fix reads are unchanged by design (SELECT
    // grants untouched), so we only assert writes. Record the read result.
    if (migrate) {
      for (const sql of [
        `update public.profiles set role = 'admin' where id = '${C1}'`,
        `update public.profiles set full_name = 'x' where id = '${C1}'`,
        `insert into public.profiles (id, email, role) values ('${NEWBIE}', 'n@example.test', 'admin')`,
        `delete from public.profiles where id = '${C1}'`,
      ]) {
        const w = await as(db, anonForged(C1), sql)
        assert.ok(!w.ok || w.affected === 0, `anon write must fail: ${sql}`)
      }
      assert.deepEqual(await row(db, C1), snap)
    }
    assert.ok(read.ok)
  }
})

// ---------------------------------------------------------------- request manipulation
await check('manipulated requests: upsert-on-conflict, returning, CTE and multi-row tricks all refused', async () => {
  const db = await build({ migrate: true })
  const snapC1 = await row(db, C1)
  const snapC2 = await row(db, C2)
  const snapA = await row(db, ADMIN)
  const attacks = [
    // PostgREST "Prefer: resolution=merge-duplicates" is an upsert.
    `insert into public.profiles (id, email, role) values ('${C1}', 'c1@example.test', 'admin')
       on conflict (id) do update set role = excluded.role`,
    // Change only a protected field while also changing an allowed one.
    `update public.profiles set full_name = 'ok', portal_role = 'super_admin' where id = '${C1}'`,
    // Data-modifying CTE.
    `with x as (update public.profiles set role = 'admin' where id = '${C1}' returning id) select * from x`,
    // Multi-row update aimed at every row the policy lets through.
    `update public.profiles set organization_id = '${ORG}'`,
    // Steal the admin's email (email-keyed customer policies).
    `update public.profiles set email = 'admin@example.test' where id = '${C1}'`,
    // Demote the admin (integrity, not just escalation).
    `update public.profiles set role = 'customer' where id = '${ADMIN}'`,
    // Delete someone else / self.
    `delete from public.profiles where id = '${C2}'`,
    `delete from public.profiles where id = '${C1}'`,
  ]
  for (const sql of attacks) {
    const r = await as(db, customer(C1), sql)
    assert.ok(!r.ok || r.affected === 0, `must be refused: ${sql.replace(/\s+/g, ' ')}`)
  }
  assert.deepEqual(await row(db, C1), snapC1)
  assert.deepEqual(await row(db, C2), snapC2)
  assert.deepEqual(await row(db, ADMIN), snapA)
  assert.deepEqual(await helpers(db, C1), allFalse)
})

// ---------------------------------------------------------------- legitimate paths still work
await check('ordinary user keeps display edits; admin (service role path) can still administer roles', async () => {
  const db = await build({ migrate: true })
  const ok = await as(db, customer(C1), `update public.profiles set full_name = 'New Name', phone = '555' where id = $1`, [C1])
  assert.ok(ok.ok && ok.affected === 1)
  const svc = await as(db, { role: 'service_role' }, `update public.profiles set role = 'internal_team' where id = $1`, [C2])
  assert.ok(svc.ok && svc.affected === 1)
  assert.equal((await row(db, C2)).role, 'internal_team')
  const adminJwt = await helpers(db, ADMIN)
  assert.equal(adminJwt.a, true)
  assert.equal(adminJwt.s, true)
})

console.log(`\n${n} adversarial checks passed`)
