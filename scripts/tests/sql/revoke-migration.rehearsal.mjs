// Rehearses the STAGED revoke migration in embedded PostgreSQL.
// Proves: a policy-referenced function is left alone; a trigger function loses its user grant yet the
// trigger still fires for that user; a service-role-only RPC loses anon/authenticated but keeps service_role;
// re-running is a no-op; an absent function is skipped.
// Usage: node scripts/tests/sql/revoke-migration.rehearsal.mjs supabase/migrations/<file>.sql
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = process.argv[2]
assert.ok(migration, 'pass the migration path')
const sql = await readFile(resolve(repo, migration), 'utf8')
const db = new PGlite()
const rows = async (q) => (await db.query(q)).rows
const can = async (role, fn) => (await rows(`select has_function_privilege('${role}','public.${fn}','execute') as ok`))[0].ok

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create table leads (id serial primary key, name text, routed boolean default false);
  grant all on leads to authenticated; grant usage, select on sequence leads_id_seq to authenticated;
  create function public.is_partner() returns boolean language sql security definer as 'select true';
  create table partner_rows (id int);
  alter table partner_rows enable row level security;
  create policy partner_read on partner_rows for select to authenticated using (public.is_partner());
  create function public.on_new_lead() returns trigger language plpgsql security definer as $$
    begin new.routed := true; return new; end $$;
  create trigger trg_new_lead before insert on leads for each row execute function public.on_new_lead();
  create function public.tmmt_token_grant(p_org uuid, p_amount integer, p_reason text, p_dedupe text, p_set_allotment integer, p_tier text)
    returns jsonb language sql security definer as 'select ''{}''::jsonb';
  grant execute on function public.is_partner(), public.on_new_lead(), public.tmmt_token_grant(uuid,integer,text,text,integer,text) to anon, authenticated, service_role;
`)
assert.equal(await can('authenticated', 'on_new_lead()'), true, 'baseline: user grant present')

await db.exec(sql)
assert.equal(await can('authenticated', 'is_partner()'), true, 'policy-referenced helper is left alone')
assert.equal(await can('anon', 'on_new_lead()'), false)
assert.equal(await can('authenticated', 'on_new_lead()'), false, 'trigger fn user grant revoked')
assert.equal(await can('authenticated', 'tmmt_token_grant(uuid,integer,text,text,integer,text)'), false)
assert.equal(await can('service_role', 'tmmt_token_grant(uuid,integer,text,text,integer,text)'), true, 'service_role keeps its grant')
console.log('ok  1 up: policy-referenced fn untouched; trigger fn + service-only RPC revoked for users; service_role kept')

await db.exec(`set role authenticated; insert into leads (name) values ('after-revoke'); reset role;`)
assert.equal((await rows(`select routed from leads where name = 'after-revoke'`))[0].routed, true,
  'trigger still fires for a user who no longer holds EXECUTE on the trigger function')
console.log('ok  2 trigger still fires for authenticated after the revoke')

await db.exec(sql)
assert.equal(await can('authenticated', 'on_new_lead()'), false)
console.log('ok  3 re-run is a no-op (absent functions skipped with notices)')

await db.exec(`grant execute on function public.on_new_lead() to authenticated;`)
assert.equal(await can('authenticated', 'on_new_lead()'), true)
console.log('ok  4 rollback: single grant restores the user grant')
console.log('REHEARSAL PASSED', migration)
