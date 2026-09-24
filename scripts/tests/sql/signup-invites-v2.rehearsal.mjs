// signup_invites v2 rehearsal (C3-001/002), embedded Postgres (PGlite).
//
// Base: signup_invites exactly as on prod 2026-09-21 (columns, unique code_hash, partial
// index, RLS on with 0 policies, no anon/authenticated grants). Target:
// _staged/20260923150000_signup_invites_v2_STAGED.sql. Then MUTATION mode.
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/signup-invites-v2.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const V2 = await readFile(resolve(repo, 'supabase/migrations/_staged/20260923150000_signup_invites_v2_STAGED.sql'), 'utf8')

const BASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create table public.signup_invites (
    id uuid primary key default gen_random_uuid(), code_hash text not null unique, label text, email text,
    expires_at timestamptz not null default now() + interval '14 days', used_at timestamptz, used_by uuid,
    created_at timestamptz not null default now(), created_by text);
  create index signup_invites_unused_idx on public.signup_invites (expires_at) where used_at is null;
  alter table public.signup_invites enable row level security;
  revoke all on public.signup_invites from anon, authenticated;
  grant all on public.signup_invites to service_role;
  insert into public.signup_invites (id, code_hash, email, expires_at) values
    ('00000000-0000-4000-8000-000000000001', 'h-open', null, now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000002', 'h-locked', 'Owner.Invited@Example.test', now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000003', 'h-expired', null, now() - interval '1 minute');
  insert into public.signup_invites (id, code_hash, used_at) values ('00000000-0000-4000-8000-000000000004', 'h-used', now() - interval '1 day');
`
const OPEN = '00000000-0000-4000-8000-000000000001'

async function build(sql) {
  const db = new PGlite()
  await db.exec(BASE)
  await db.exec(sql)
  return db
}
async function as(db, role, sql, sub = '') {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub])
    await db.exec(`set local role ${role}`)
    const r = await db.query(sql)
    await db.exec('commit')
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 }
  } catch (error) {
    await db.exec('rollback')
    return { ok: false, error }
  }
}
const svc = (db, sql) => as(db, 'service_role', sql)
const claim = (db, hash, email) => svc(db, `select * from public.claim_signup_invite('${hash}', '${email}')`)

const CHECKS = [
  ['backfill: the used invite reads as accepted; the rest pending', async (db) => {
    const r = await db.query("select code_hash, status from public.signup_invites order by code_hash")
    assert.deepEqual(r.rows, [
      { code_hash: 'h-expired', status: 'pending' }, { code_hash: 'h-locked', status: 'pending' },
      { code_hash: 'h-open', status: 'pending' }, { code_hash: 'h-used', status: 'accepted' }])
  }],
  ['claim works once (single-use), and a second claim of the same code gets nothing', async (db) => {
    assert.equal((await claim(db, 'h-open', 'a@example.test')).rows.length, 1)
    assert.equal((await claim(db, 'h-open', 'b@example.test')).rows.length, 0)
  }],
  ['claim refuses expired, used, unknown, and wrong-email codes (email match is case-blind)', async (db) => {
    assert.equal((await claim(db, 'h-expired', 'a@example.test')).rows.length, 0)
    assert.equal((await claim(db, 'h-used', 'a@example.test')).rows.length, 0)
    assert.equal((await claim(db, 'nope', 'a@example.test')).rows.length, 0)
    assert.equal((await claim(db, 'h-locked', 'someone@else.test')).rows.length, 0)
    assert.equal((await claim(db, 'h-locked', ' owner.invited@example.test')).rows.length, 1)
  }],
  ['a revoked invite cannot be claimed and stays on record', async (db) => {
    assert.deepEqual((await svc(db, `select public.revoke_signup_invite('${OPEN}', 'owner@x') r`)).rows, [{ r: true }])
    assert.equal((await claim(db, 'h-open', 'a@example.test')).rows.length, 0)
    assert.deepEqual((await db.query(`select status, revoked_by from public.signup_invites where id = '${OPEN}'`)).rows, [{ status: 'revoked', revoked_by: 'owner@x' }])
    assert.ok(!(await svc(db, `update public.signup_invites set status = 'pending', revoked_at = null where id = '${OPEN}'`)).ok, 'un-revoked')
  }],
  ['release hands a claim back only while no account is recorded against it', async (db) => {
    await claim(db, 'h-open', 'a@example.test')
    assert.deepEqual((await svc(db, `select public.release_signup_invite('${OPEN}') r`)).rows, [{ r: true }])
    assert.equal((await claim(db, 'h-open', 'a@example.test')).rows.length, 1)
    await svc(db, `update public.signup_invites set used_by = gen_random_uuid() where id = '${OPEN}'`)
    assert.deepEqual((await svc(db, `select public.release_signup_invite('${OPEN}') r`)).rows, [{ r: false }])
  }],
  ['code, email, binding and expiry cannot be changed; an accepted invite cannot be re-pointed', async (db) => {
    for (const set of ["code_hash = 'x'", "email = 'attacker@x'", "expires_at = now() + interval '1 year'", "relationship_kind = 'credit_customer', relationship_ref = 'case-9'"]) {
      assert.ok(!(await svc(db, `update public.signup_invites set ${set} where id = '${OPEN}'`)).ok, set)
    }
    await claim(db, 'h-open', 'a@example.test')
    await svc(db, `update public.signup_invites set used_by = '00000000-0000-4000-8000-0000000000aa' where id = '${OPEN}'`)
    assert.ok(!(await svc(db, `update public.signup_invites set used_by = '00000000-0000-4000-8000-0000000000bb' where id = '${OPEN}'`)).ok)
  }],
  ['a binding must be complete and of a known kind', async (db) => {
    assert.ok(!(await svc(db, "insert into public.signup_invites (code_hash, relationship_kind) values ('h-b1', 'credit_customer')")).ok)
    assert.ok(!(await svc(db, "insert into public.signup_invites (code_hash, relationship_kind, relationship_ref) values ('h-b2', 'org_admin', 'org-1')")).ok)
    assert.ok((await svc(db, "insert into public.signup_invites (code_hash, relationship_kind, relationship_ref) values ('h-b3', 'credit_customer', 'case-1')")).ok)
    assert.deepEqual((await claim(db, 'h-b3', 'x@x')).rows.map(({ relationship_kind, relationship_ref }) => ({ relationship_kind, relationship_ref })), [{ relationship_kind: 'credit_customer', relationship_ref: 'case-1' }])
  }],
  ['hostile signed-in account and anon: cannot read invites or call the claim / release / revoke functions', async (db) => {
    for (const role of ['anon', 'authenticated']) {
      const sub = role === 'authenticated' ? '00000000-0000-4000-8000-0000000000c1' : ''
      assert.ok(!(await as(db, role, 'select * from public.signup_invites', sub)).ok, `${role} read invites`)
      assert.ok(!(await as(db, role, "select * from public.claim_signup_invite('h-open','a@x')", sub)).ok, `${role} claimed`)
      assert.ok(!(await as(db, role, `select public.release_signup_invite('${OPEN}')`, sub)).ok, `${role} released`)
      assert.ok(!(await as(db, role, `select public.revoke_signup_invite('${OPEN}','me')`, sub)).ok, `${role} revoked`)
      assert.ok(!(await as(db, role, "insert into public.signup_invites (code_hash) values ('mine')", sub)).ok, `${role} minted`)
    }
  }],
  ['two racing claims: exactly one wins', async (db) => {
    const [a, b] = await Promise.all([claim(db, 'h-open', 'a@x'), claim(db, 'h-open', 'b@x')])
    assert.equal(a.rows.length + b.rows.length, 1)
  }],
  ['repeatable and fully reversible', async (db, sql) => {
    await db.exec(sql)
    const rb = sql.split('-- ROLLBACK')[1].split('\n').filter((l) => /^--\s+(drop|alter table) /.test(l)).map((l) => l.replace(/^--\s+/, '')).join('\n')
    await db.exec(rb)
    const cols = (await db.query("select column_name from information_schema.columns where table_name='signup_invites' order by 1")).rows.map((r) => r.column_name)
    assert.deepEqual(cols, ['code_hash', 'created_at', 'created_by', 'email', 'expires_at', 'id', 'label', 'used_at', 'used_by'])
    assert.deepEqual((await db.query("select count(*)::int n from pg_proc where proname like '%signup_invite%'")).rows, [{ n: 0 }])
  }],
]

async function runAll(sql, quiet) {
  const failed = []
  let i = 0
  for (const [name, fn] of CHECKS) {
    i++
    try {
      await fn(await build(sql), sql)
      if (!quiet) console.log(`ok ${String(i).padStart(2)} ${name}`)
    } catch (e) {
      failed.push(name)
      if (!quiet) console.log(`FAIL ${i} ${name}: ${e.message}`)
    }
  }
  return failed
}
if ((await runAll(V2, false)).length) process.exit(1)

const M = [
  ['claim ignores expiry', '     and i.expires_at > now()\n', ''],
  ['claim ignores the email lock', "     and (i.email is null or lower(i.email) = lower(trim(p_email)))\n", ''],
  ['claim reusable (no status check)', "     and i.status = 'pending'\n     and i.used_at is null\n", ''],
  ['claim callable by signed-in users', 'grant execute on function public.claim_signup_invite(text, text) to service_role;', 'grant execute on function public.claim_signup_invite(text, text) to service_role, authenticated;'],
  ['PUBLIC keeps EXECUTE on revoke', 'revoke all on function public.revoke_signup_invite(uuid, text) from public, anon, authenticated;', ''],
  ['release after an account exists', " where id = p_id and status = 'accepted' and used_by is null", " where id = p_id and status = 'accepted'"],
  ['guard allows binding changes', 'new.relationship_kind, new.relationship_ref, new.expires_at', 'old.relationship_kind, old.relationship_ref, old.expires_at'],
  ['guard allows un-revoking', "      or (old.status = 'pending' and new.status = 'revoked')\n", "      or (old.status = 'pending' and new.status = 'revoked')\n      or old.status = 'revoked'\n"],
  ['table re-opened to API roles', 'revoke all on public.signup_invites from anon, authenticated;\n\ncommit;', 'grant select on public.signup_invites to authenticated;\n\ncommit;'],
]
console.log('\nmutations:')
let survived = 0
for (const [name, from, to] of M) {
  if (!V2.includes(from)) { console.log(`  ?? ${name}: anchor not found`); survived++; continue }
  const caught = await runAll(V2.replace(from, to), true)
  if (caught.length) console.log(`  caught   ${name} (${caught.length})`)
  else { console.log(`  SURVIVED ${name}`); survived++ }
}
if (survived) { console.error(`${survived} mutation(s) survived`); process.exit(1) }
console.log(`\n${CHECKS.length} checks passed; ${M.length}/${M.length} mutations caught.`)
