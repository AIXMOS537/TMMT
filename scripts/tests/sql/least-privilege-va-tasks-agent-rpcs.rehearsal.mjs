// Rehearses the least-privilege migration for exec_va_tasks and the agent helper
// functions in embedded PostgreSQL, including that the SECURITY DEFINER call
// chains that use those helpers still work for an anon-originated trigger.
// Usage: node scripts/tests/sql/least-privilege-va-tasks-agent-rpcs.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = await readFile(
  resolve(repo, 'supabase/migrations/20260916193847_least_privilege_exec_va_tasks_agent_rpcs.sql'),
  'utf8'
)
const ROLES = 'create role anon; create role authenticated; create role service_role;'

// 1. Fresh environment: skips cleanly.
{
  const db = new PGlite()
  await db.exec(ROLES)
  await db.exec(migration)
  console.log('ok  1 fresh environment: skipped without error')
}

// 2. Production-shaped objects.
const db = new PGlite()
await db.exec(ROLES + `
  create table public.exec_va_tasks (id uuid primary key default gen_random_uuid(), status text default 'pending');
  alter table public.exec_va_tasks enable row level security;
  create policy service_role_all on public.exec_va_tasks for all to service_role using (true);
  grant select, insert, update, delete, references, trigger on public.exec_va_tasks to anon, authenticated, service_role;

  create table public.incoming_leads (id uuid primary key default gen_random_uuid(), assigned_to uuid, status text, opted_out boolean);
  grant insert on public.incoming_leads to anon;
  create table public.assignments (lead uuid, load int);

  create function public.agent_open_load(p_profile uuid) returns integer language sql stable set search_path = public
    as 'select count(*)::int from public.incoming_leads where assigned_to = p_profile';
  create function public.pick_idle_closer(p_lead uuid) returns integer language sql stable set search_path = public
    as 'select public.agent_open_load(p_lead)';
  create function public.agent_render_prompt(p_template text, p_row jsonb) returns text language sql immutable
    as $$ select replace(p_template, '{{a}}', p_row->>'a') $$;

  -- SECURITY DEFINER trigger, owned by the migration runner, like tg_auto_assign_lead / agent_enqueue.
  create function public.tg_auto_assign_lead() returns trigger language plpgsql security definer set search_path = public as $$
  begin
    insert into public.assignments values (new.id, public.pick_idle_closer(new.id));
    perform public.agent_render_prompt('x{{a}}', '{"a":"1"}'::jsonb);
    return new;
  end $$;
  create trigger trg_auto_assign_lead after insert on public.incoming_leads for each row execute function public.tg_auto_assign_lead();
`)
await db.exec(migration)
await db.exec(migration) // re-runnable

const priv = (await db.query(`select
  has_table_privilege('anon','public.exec_va_tasks','SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER') anon_tbl,
  has_table_privilege('authenticated','public.exec_va_tasks','SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER') auth_tbl,
  has_table_privilege('service_role','public.exec_va_tasks','SELECT,INSERT,UPDATE,DELETE') svc_tbl,
  has_function_privilege('anon','public.agent_open_load(uuid)','EXECUTE') anon_load,
  has_function_privilege('authenticated','public.pick_idle_closer(uuid)','EXECUTE') auth_pick,
  has_function_privilege('anon','public.agent_render_prompt(text,jsonb)','EXECUTE') anon_render,
  has_function_privilege('service_role','public.agent_open_load(uuid)','EXECUTE') svc_load`)).rows[0]
assert.deepEqual(priv, {
  anon_tbl: false, auth_tbl: false, svc_tbl: true,
  anon_load: false, auth_pick: false, anon_render: false, svc_load: true,
})
console.log('ok  2 anon/authenticated: no table access, no helper EXECUTE; service_role keeps both')

await db.exec('set role anon')
await assert.rejects(() => db.query('select * from public.exec_va_tasks'), /permission denied/)
await assert.rejects(() => db.query(`select public.agent_open_load(gen_random_uuid())`), /permission denied/)
await db.exec('insert into public.incoming_leads (status) values (\'new\')')
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from public.assignments')).rows[0].n, 1)
console.log('ok  3 anon is denied directly, but an anon lead insert still runs the definer trigger chain')

await db.exec('set role service_role')
await db.query('select * from public.exec_va_tasks')
await db.exec('reset role')
console.log('ok  4 service_role server paths still read exec_va_tasks')

console.log('least-privilege rehearsal passed')
