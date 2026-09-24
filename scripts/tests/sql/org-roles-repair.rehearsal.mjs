// org_roles repair rehearsal (C3-005 / C3-006), on the PRODUCTION catalog shape.
//
// Base: fixtures/prod-shape-credit-2026-09-21.sql (read-only catalog capture of prod:
// org_roles with its real CHECK, its recursive tenant_admin_write policy and its real
// grants) plus, below, operator_profiles / operator_training_progress as they stand
// on prod (columns, grants and the operator_training_progress_rw policy verbatim,
// read 2026-09-21). Target: _staged/20260923140000_org_roles_repair_STAGED.sql.
//
// BEFORE: proves today's breakage (42P17 for every signed-in reader) and the hidden
// cross-tenant training-progress hole (visible once recursion is removed).
// AFTER: tenant admin works inside their own org only; no self-assignment; no
// promotion to tenant_admin; no cross-org grants; anon has nothing; customers get
// nothing; Org A staff-less members cannot touch Org B; the training hole is closed.
// Then MUTATION mode: weakened copies of the repair must each be caught.
//
// Usage: (cd scripts/tests/sql && npm ci) && node scripts/tests/sql/org-roles-repair.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const PROD = await readFile(resolve(here, 'fixtures/prod-shape-credit-2026-09-21.sql'), 'utf8')
const REPAIR = await readFile(resolve(repo, 'supabase/migrations/_staged/20260923140000_org_roles_repair_STAGED.sql'), 'utf8')

const STAFF = '00000000-0000-4000-8000-0000000000b1'
const TA_A = '00000000-0000-4000-8000-0000000000a1' // tenant admin of Org A
const DISP_A = '00000000-0000-4000-8000-0000000000a2' // dispatcher in Org A
const NEW_A = '00000000-0000-4000-8000-0000000000a3' // someone Org A wants to add
const TA_B = '00000000-0000-4000-8000-0000000000b2' // tenant admin of Org B
const OPB = '00000000-0000-4000-8000-0000000000b3' // operator (learner) in Org B
const CUST = '00000000-0000-4000-8000-0000000000c1' // fresh signed-up account: no role, no org
const ORG_A = '00000000-0000-4000-8000-0000000000f1'
const ORG_B = '00000000-0000-4000-8000-0000000000f2'

// Stand-ins for the two training tables, shaped like prod (only the columns used).
const TRAINING = `
  create table public.operator_profiles (id uuid primary key default gen_random_uuid(), profile_id uuid, org_id uuid references public.organizations(id));
  create table public.operator_training_progress (
    id uuid primary key default gen_random_uuid(), profile_id uuid not null, module_id uuid not null,
    percent_complete smallint not null default 0, completed_at timestamptz, updated_at timestamptz not null default now());
  alter table public.operator_training_progress enable row level security;
  create policy operator_training_progress_rw on public.operator_training_progress for all to authenticated
    using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM org_roles r WHERE (r.user_id = auth.uid())))))
    with check (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM org_roles r WHERE (r.user_id = auth.uid())))));
  grant select, insert, update, delete, references, trigger on public.operator_training_progress to anon, authenticated;
  grant select on public.operator_profiles to authenticated;
`

const SEED = `
  insert into public.organizations (id, name) values ('${ORG_A}','Org A'), ('${ORG_B}','Org B');
  insert into auth.users values ('${STAFF}','s@x'),('${TA_A}','taa@x'),('${DISP_A}','da@x'),('${NEW_A}','na@x'),('${TA_B}','tab@x'),('${OPB}','opb@x'),('${CUST}','c@x');
  insert into public.profiles (id, email, role) values ('${STAFF}','s@x','internal_team'),('${TA_A}','taa@x','customer'),('${DISP_A}','da@x','customer'),
    ('${NEW_A}','na@x','customer'),('${TA_B}','tab@x','customer'),('${OPB}','opb@x','customer'),('${CUST}','c@x','customer');
  insert into public.org_roles (org_id, user_id, role) values
    ('${ORG_A}','${TA_A}','tenant_admin'), ('${ORG_A}','${DISP_A}','dispatcher'), ('${ORG_B}','${TA_B}','tenant_admin'), ('${ORG_B}','${OPB}','viewer');
  -- a learner in EACH org, so an uncorrelated rule shows up as a cross-org read
  insert into public.operator_profiles (profile_id, org_id) values ('${OPB}','${ORG_B}'), ('${DISP_A}','${ORG_A}');
  insert into public.operator_training_progress (profile_id, module_id, percent_complete) values ('${OPB}', gen_random_uuid(), 40);
`

async function build(repair) {
  const db = new PGlite()
  await db.exec(PROD)
  await db.exec(TRAINING)
  await db.exec(SEED)
  if (repair) await db.exec(repair)
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
const denied = (r) => !r.ok || r.affected === 0
const users = (r) => (r.ok ? r.rows.map((x) => x.user_id).sort() : `ERR ${r.error.message}`)
const ins = (org, user, role) => `insert into public.org_roles (org_id, user_id, role) values ('${org}','${user}','${role}')`

// ------------------------------------------------------------ before
let n = 0
const log = (s) => console.log(`ok ${String(++n).padStart(2)} ${s}`)

{
  const db = await build(null)
  for (const who of [TA_A, CUST, STAFF]) {
    const r = await as(db, who, 'select * from public.org_roles')
    assert.match(r.ok ? '' : r.error.message, /infinite recursion/, `before: ${who} should hit 42P17`)
  }
  const t = await as(db, OPB, 'select * from public.operator_training_progress')
  assert.match(t.ok ? '' : t.error.message, /infinite recursion/)
  log('BEFORE: every signed-in read of org_roles and of training progress fails with 42P17 (prod today)')

  // Remove ONLY the recursion (the naive fix) and the hidden hole appears.
  await db.exec(`drop policy tenant_admin_write on public.org_roles;`)
  const leak = await as(db, TA_A, 'select profile_id from public.operator_training_progress')
  assert.deepEqual(leak.rows.map((r) => r.profile_id), [OPB], 'naive fix should expose Org B progress to Org A')
  const tamper = await as(db, TA_A, `update public.operator_training_progress set percent_complete = 100`)
  assert.equal(tamper.affected, 1)
  log('BEFORE: removing only the recursion switches ON a cross-tenant read/write of training progress — why they ship together')
}

// ------------------------------------------------------------ after
const CHECKS = [
  ['no recursion: tenant admin, dispatcher, customer and staff all read org_roles without error', async (db) => {
    for (const who of [TA_A, DISP_A, CUST, STAFF]) {
      const r = await as(db, who, 'select user_id from public.org_roles')
      assert.ok(r.ok, `${who}: ${r.error?.message}`)
    }
  }],
  ['reads are scoped: own rows; tenant admin sees own org; staff see all; a fresh account sees nothing', async (db) => {
    assert.deepEqual(users(await as(db, DISP_A, 'select user_id from public.org_roles')), [DISP_A])
    assert.deepEqual(users(await as(db, TA_A, 'select user_id from public.org_roles')), [TA_A, DISP_A].sort())
    assert.equal((await as(db, STAFF, 'select user_id from public.org_roles')).rows.length, 4)
    assert.deepEqual(users(await as(db, CUST, 'select user_id from public.org_roles')), [])
  }],
  ['a tenant admin can add a dispatcher/responder/viewer to their own org', async (db) => {
    const r = await as(db, TA_A, ins(ORG_A, NEW_A, 'viewer'))
    assert.ok(r.ok && r.affected === 1, r.error?.message)
  }],
  ['a tenant admin cannot create another tenant_admin or promote anyone to it', async (db) => {
    assert.ok(denied(await as(db, TA_A, ins(ORG_A, NEW_A, 'tenant_admin'))))
    assert.ok(denied(await as(db, TA_A, `update public.org_roles set role = 'tenant_admin' where user_id = '${DISP_A}'`)))
  }],
  ['no self-role assignment: nobody (but staff) grants themselves a role', async (db) => {
    assert.ok(denied(await as(db, CUST, ins(ORG_A, CUST, 'viewer'))), 'fresh account self-joined an org')
    assert.ok(denied(await as(db, DISP_A, ins(ORG_A, DISP_A, 'responder'))), 'dispatcher added a role to themselves')
    assert.ok(denied(await as(db, TA_A, ins(ORG_A, TA_A, 'dispatcher'))), 'tenant admin added a role to themselves')
    assert.ok(denied(await as(db, TA_A, `update public.org_roles set user_id = '${TA_A}' where user_id = '${DISP_A}'`)), 'row re-pointed to self')
  }],
  ['no cross-org: Org A tenant admin cannot grant, change or remove anything in Org B', async (db) => {
    assert.ok(denied(await as(db, TA_A, ins(ORG_B, NEW_A, 'viewer'))))
    assert.ok(denied(await as(db, TA_A, `update public.org_roles set role = 'viewer' where org_id = '${ORG_B}'`)))
    assert.ok(denied(await as(db, TA_A, `delete from public.org_roles where org_id = '${ORG_B}'`)))
    assert.ok(denied(await as(db, TA_A, `update public.org_roles set org_id = '${ORG_B}' where user_id = '${DISP_A}'`)), 'moved a member into Org B')
  }],
  ['a dispatcher (not tenant admin) cannot manage roles at all', async (db) => {
    assert.ok(denied(await as(db, DISP_A, ins(ORG_A, NEW_A, 'viewer'))))
    assert.ok(denied(await as(db, DISP_A, `delete from public.org_roles where user_id = '${TA_A}'`)))
  }],
  ['a tenant admin cannot remove another tenant admin or themselves', async (db) => {
    await db.exec(ins(ORG_A, NEW_A, 'tenant_admin'))
    assert.ok(denied(await as(db, TA_A, `delete from public.org_roles where user_id = '${NEW_A}' and role = 'tenant_admin'`)))
    assert.ok(denied(await as(db, TA_A, `delete from public.org_roles where user_id = '${TA_A}'`)))
  }],
  ['staff can manage any role (the escape hatch stays)', async (db) => {
    const r = await as(db, STAFF, ins(ORG_B, NEW_A, 'tenant_admin'))
    assert.ok(r.ok && r.affected === 1, r.error?.message)
  }],
  ['anon has no access to org_roles or training progress; TRUNCATE is refused for app roles', async (db) => {
    for (const t of ['org_roles', 'operator_training_progress']) {
      assert.ok(!(await as(db, null, `select * from public.${t}`)).ok, `anon read ${t}`)
      assert.ok(!(await as(db, null, `truncate public.${t}`)).ok, `anon truncated ${t}`)
      assert.ok(!(await as(db, TA_A, `truncate public.${t}`)).ok, `authenticated truncated ${t}`)
    }
    assert.ok(!(await as(db, null, ins(ORG_A, CUST, 'viewer'))).ok)
  }],
  ['training progress: learner owns their rows; own-org members may read; other orgs see and change nothing', async (db) => {
    assert.equal((await as(db, OPB, 'select 1 from public.operator_training_progress')).rows.length, 1)
    assert.equal((await as(db, TA_B, 'select 1 from public.operator_training_progress')).rows.length, 1, 'Org B admin reads Org B progress')
    assert.equal((await as(db, TA_A, 'select 1 from public.operator_training_progress')).rows.length, 0, 'Org A read Org B progress')
    assert.ok(denied(await as(db, TA_A, 'update public.operator_training_progress set percent_complete = 100')), 'Org A wrote Org B progress')
    assert.ok(denied(await as(db, TA_B, 'update public.operator_training_progress set percent_complete = 100')), 'an admin wrote a learner\'s progress')
    assert.ok(denied(await as(db, CUST, `insert into public.operator_training_progress (profile_id, module_id) values ('${OPB}', gen_random_uuid())`)), 'planted a row for someone else')
    const own = await as(db, OPB, 'update public.operator_training_progress set percent_complete = 60')
    assert.ok(own.ok && own.affected === 1)
  }],
  ['the helper is SECURITY DEFINER, owned by a role that bypasses RLS, and not executable by anon', async (db) => {
    const r = await db.query(`select p.prosecdef, r.rolbypassrls or r.rolsuper as bypass, has_function_privilege('anon', p.oid, 'execute') as anon_exec from pg_proc p join pg_roles r on r.oid = p.proowner where p.proname = 'is_org_tenant_admin'`)
    assert.deepEqual(r.rows, [{ prosecdef: true, bypass: true, anon_exec: false }])
  }],
  ['dispatch helpers used by the app keep working (is_org_member / is_org_dispatcher-style reads)', async (db) => {
    const r = await as(db, DISP_A, `select public.is_org_member('${ORG_A}') a, public.is_org_member('${ORG_B}') b`)
    assert.deepEqual(r.rows, [{ a: true, b: false }])
  }],
  ['repeatable: applying the repair twice is a no-op', async (db, repair) => {
    const q = "select policyname, cmd, qual, with_check from pg_policies where tablename in ('org_roles','operator_training_progress') order by 1"
    const once = (await db.query(q)).rows
    await db.exec(repair)
    assert.deepEqual((await db.query(q)).rows, once)
  }],
]

async function runAll(repair, quiet) {
  const failed = []
  for (const [name, fn] of CHECKS) {
    try {
      const db = await build(repair)
      await fn(db, repair)
      if (!quiet) log(`AFTER: ${name}`)
    } catch (e) {
      failed.push(name)
      if (!quiet) console.log(`FAIL ${name}: ${e.message}`)
    }
  }
  return failed
}

if ((await runAll(REPAIR, false)).length) process.exit(1)

// ------------------------------------------------------------ mutations
const M = [
  ['helper not SECURITY DEFINER (recursion returns)', 'stable\nsecurity definer\nset search_path', 'stable\nset search_path'],
  ['tenant admin may grant tenant_admin', "        and role in ('dispatcher', 'responder', 'viewer')\n        and user_id <> auth.uid())", "        and user_id <> auth.uid())"],
  ['self-role assignment allowed', "        and role in ('dispatcher', 'responder', 'viewer')\n        and user_id <> auth.uid())", "        and role in ('dispatcher', 'responder', 'viewer'))"],
  ['org condition removed from insert', "    or (public.is_org_tenant_admin(org_id)\n        and role", "    or (exists (select 1 from public.org_roles x where false) or true\n        and role"],
  ['update WITH CHECK drops the org condition (move rows across orgs)', "  with check (\n    public.is_staff()\n    or (public.is_org_tenant_admin(org_id) and role in ('dispatcher', 'responder', 'viewer') and user_id <> auth.uid())\n  );\n\ndrop policy if exists org_roles_delete", "  with check (true);\n\ndrop policy if exists org_roles_delete"],
  ['anon keeps its grants', 'revoke all on public.org_roles from anon;', ''],
  ['read policy open to every signed-in user', 'using (user_id = auth.uid() or public.is_staff() or public.is_org_tenant_admin(org_id));', 'using (true);'],
  ['training progress fix left out (hole switched on)', 'drop policy if exists operator_training_progress_rw on public.operator_training_progress;', ''],
  ['training org-read uncorrelated', "      where op.profile_id = public.operator_training_progress.profile_id\n        and op.org_id is not null", "      where op.org_id is not null"],
]
console.log('\nmutations:')
let survived = 0
for (const [name, from, to] of M) {
  if (!REPAIR.includes(from)) { console.log(`  ?? ${name}: anchor not found`); survived++; continue }
  const caught = await runAll(REPAIR.replace(from, to), true)
  if (caught.length) console.log(`  caught   ${name} (${caught.length})`)
  else { console.log(`  SURVIVED ${name}`); survived++ }
}
if (survived) { console.error(`${survived} mutation(s) survived`); process.exit(1) }
console.log(`\n${n} checks passed; ${M.length}/${M.length} mutations caught.`)
