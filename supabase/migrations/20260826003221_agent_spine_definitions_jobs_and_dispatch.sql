-- Agent spine: agent_definitions + agent_jobs + enqueue/claim/complete (gen-1).
-- APPLIED to prod as ledger version 20260826003221 (2026-08-26). Exact applied
-- body kept verbatim in docs/repairs/agent-spine-definitions-jobs-and-dispatch.applied.sql.
--
-- Repo form differences (fresh-environment safety only; same objects on prod):
--   * The two RLS policies reference public.is_platform_admin(), which the repo
--     creates later (20260828000000). They are created only if that function
--     exists; otherwise both tables keep RLS ON with no policy (deny all to API
--     roles) and a NOTICE is raised.
-- Supabase never re-runs an applied version, so prod is unaffected. Re-running
-- this file by hand is harmless (IF NOT EXISTS / CREATE OR REPLACE / drop+create).
--
-- Later history: gen-1 claim/complete were revoked from service_role by
-- 20260906022156 (agent_jobs_lease_fencing); agent_render_prompt lost PUBLIC/anon/
-- authenticated EXECUTE in 20260916193847 (least_privilege_exec_va_tasks_agent_rpcs).

create table if not exists public.agent_definitions (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  description     text,
  source_table    text not null,               -- table the agent watches
  fire_on         text not null default 'insert'
                    check (fire_on in ('insert','update','both')),
  watch_fields    text[],                      -- update-only: fire when these change
  only_when_null  text,                        -- skip if this column already has a value
  prompt_template text not null,               -- {{column}} placeholders
  target_field    text,                        -- column the answer is written into
  model           text not null default 'rick',
  temperature     numeric not null default 0,
  max_attempts    int not null default 3,
  active          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.agent_jobs (
  id            bigint generated always as identity primary key,
  agent_slug    text not null references public.agent_definitions(slug) on delete cascade,
  source_table  text not null,
  record_id     text not null,
  status        text not null default 'queued'
                  check (status in ('queued','running','done','failed','skipped')),
  prompt        text,
  response      text,
  error         text,
  attempts      int not null default 0,
  claimed_by    text,
  claimed_at    timestamptz,
  finished_at   timestamptz,
  org_id        uuid,
  created_at    timestamptz not null default now()
);

create index if not exists agent_jobs_queue_idx
  on public.agent_jobs (status, created_at)
  where status in ('queued','running');
create index if not exists agent_jobs_record_idx
  on public.agent_jobs (source_table, record_id);

alter table public.agent_definitions enable row level security;
alter table public.agent_jobs        enable row level security;

do $guard$
begin
  if to_regprocedure('public.is_platform_admin()') is null then
    raise notice 'agent spine: public.is_platform_admin() absent; admin policies not created (RLS on, deny all)';
    return;
  end if;
  execute 'drop policy if exists agent_definitions_admin on public.agent_definitions';
  execute 'create policy agent_definitions_admin on public.agent_definitions
             for all to authenticated
             using (public.is_platform_admin()) with check (public.is_platform_admin())';
  execute 'drop policy if exists agent_jobs_admin on public.agent_jobs';
  execute 'create policy agent_jobs_admin on public.agent_jobs
             for all to authenticated
             using (public.is_platform_admin()) with check (public.is_platform_admin())';
end
$guard$;

-- Render {{column}} placeholders against the row.
create or replace function public.agent_render_prompt(p_template text, p_row jsonb)
returns text language plpgsql immutable set search_path = public, pg_temp as $fn$
declare k text; v text; out_text text := p_template;
begin
  for k in select jsonb_object_keys(p_row) loop
    v := coalesce(nullif(p_row ->> k, ''), '(blank)');
    out_text := replace(out_text, '{{' || k || '}}', v);
  end loop;
  return out_text;
end $fn$;

-- Generic trigger: enqueue a job for every active agent watching this table.
create or replace function public.agent_enqueue()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
declare d record; v_row jsonb := to_jsonb(new); v_changed boolean;
begin
  for d in
    select * from public.agent_definitions
    where active
      and source_table = tg_table_name
      and (fire_on = 'both'
           or (fire_on = 'insert' and tg_op = 'INSERT')
           or (fire_on = 'update' and tg_op = 'UPDATE'))
  loop
    if d.only_when_null is not null
       and coalesce(v_row ->> d.only_when_null, '') <> '' then
      continue;
    end if;

    if tg_op = 'UPDATE' and d.watch_fields is not null then
      select bool_or(to_jsonb(old) ->> f is distinct from v_row ->> f)
        into v_changed from unnest(d.watch_fields) f;
      if not coalesce(v_changed, false) then
        continue;
      end if;
    end if;

    insert into public.agent_jobs (agent_slug, source_table, record_id, prompt, org_id)
    values (
      d.slug, tg_table_name, (v_row ->> 'id'),
      public.agent_render_prompt(d.prompt_template, v_row),
      case when v_row ? 'org_id' then (v_row ->> 'org_id')::uuid else null end
    );
  end loop;
  return new;
end $fn$;

-- Worker pulls work. SKIP LOCKED so several workers can run side by side.
create or replace function public.agent_claim_jobs(p_worker text, p_limit int default 5)
returns table (job_id bigint, agent_slug text, model text, temperature numeric,
               source_table text, record_id text, prompt text)
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_claim_jobs: workers only' using errcode = '42501';
  end if;
  return query
  with picked as (
    select j.id from public.agent_jobs j
    join public.agent_definitions d on d.slug = j.agent_slug and d.active
    where j.status = 'queued' and j.attempts < d.max_attempts
    order by j.created_at
    limit greatest(1, least(coalesce(p_limit, 5), 50))
    for update of j skip locked
  )
  update public.agent_jobs j
     set status = 'running', attempts = j.attempts + 1,
         claimed_by = p_worker, claimed_at = now()
    from picked p, public.agent_definitions d
   where j.id = p.id and d.slug = j.agent_slug
  returning j.id, j.agent_slug, d.model, d.temperature, j.source_table, j.record_id, j.prompt;
end $fn$;

-- Worker writes the answer back. The table and column come from the agent definition,
-- never from the caller, so the dynamic update cannot be steered by job data.
create or replace function public.agent_complete_job(
  p_job_id bigint, p_response text, p_error text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare j record; d record; v_written boolean := false;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_complete_job: workers only' using errcode = '42501';
  end if;

  select * into j from public.agent_jobs where id = p_job_id;
  if not found then raise exception 'agent_complete_job: job % not found', p_job_id; end if;
  select * into d from public.agent_definitions where slug = j.agent_slug;

  if p_error is not null then
    update public.agent_jobs
       set status = case when attempts >= d.max_attempts then 'failed' else 'queued' end,
           error = left(p_error, 2000), finished_at = now()
     where id = p_job_id;
    return jsonb_build_object('job', p_job_id, 'status', 'error', 'error', left(p_error, 200));
  end if;

  if d.target_field is not null and d.source_table = j.source_table then
    execute format('update public.%I set %I = $1 where id = $2::uuid', d.source_table, d.target_field)
      using btrim(coalesce(p_response, '')), j.record_id;
    v_written := true;
  end if;

  update public.agent_jobs
     set status = 'done', response = p_response, error = null, finished_at = now()
   where id = p_job_id;

  return jsonb_build_object('job', p_job_id, 'status', 'done', 'wrote_field', v_written);
end $fn$;

revoke all on function public.agent_claim_jobs(text,int)             from public, anon, authenticated;
revoke all on function public.agent_complete_job(bigint,text,text)   from public, anon, authenticated;
revoke all on function public.agent_enqueue()                        from public, anon, authenticated;
grant execute on function public.agent_claim_jobs(text,int)           to service_role;
grant execute on function public.agent_complete_job(bigint,text,text) to service_role;
