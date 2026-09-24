-- Lease fencing for agent_jobs: lease_epoch / lease_expires_at / worker_id and the
-- current queue contract agent_wp.v1 (agent_wp_claim / _complete / _fail) + reaper.
-- APPLIED to prod as ledger version 20260906022156 (2026-09-06). Exact applied body
-- kept verbatim in docs/repairs/agent-jobs-lease-fencing.applied.sql.
--
-- Repo form differences (fresh-environment safety only; same objects on prod):
--   * agent_wp_reap() is created only if absent (see note at that statement).
--   * cron.schedule runs only if pg_cron is installed.
--   * The body's first comment points at supabase/migrations/20260906020000_agent_jobs_lease_fencing.sql;
--     that file exists on no remote branch (checked 2026-09-16). This file is the record.
-- All other statements are identical. Re-running by hand is harmless.
--
-- Later history: 20260906022251 revoked anon/authenticated EXECUTE (ACL fix);
-- 20260908195354 replaced the reaper body (terminal lease after max attempts);
-- 20260916191024 granted the three contract functions to role agent_worker.
-- Fence the agent_jobs completion path. See
-- supabase/migrations/20260906020000_agent_jobs_lease_fencing.sql for the full
-- rationale. Signatures and ACLs were read from production 2026-09-05 per
-- docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md steps 1 and 3.

alter table public.agent_jobs
  add column if not exists lease_epoch      bigint not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists worker_id        text;

comment on column public.agent_jobs.lease_epoch is
  'Monotonic per job. Advances on claim, failure and reclaim. A result carrying a stale epoch is rejected.';
comment on column public.agent_jobs.lease_expires_at is
  'When the current claim stops being authoritative. The reaper, not the worker, decides expiry.';
comment on column public.agent_jobs.worker_id is
  'The fenced principal. claimed_by is kept alongside it as the human-readable audit trail.';

create index if not exists agent_jobs_lease_idx
  on public.agent_jobs (lease_expires_at)
  where status = 'running';

create or replace function public.agent_wp_claim(
  p_worker text,
  p_limit  integer  default 5,
  p_lease  interval default interval '5 minutes'
) returns table (
  job_id       bigint,
  lease_epoch  bigint,
  agent_slug   text,
  model        text,
  temperature  numeric,
  source_table text,
  record_id    text,
  prompt       text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
#variable_conflict use_column
begin
  if p_worker is null or btrim(p_worker) = '' then
    raise exception 'agent_wp_claim: p_worker is required' using errcode = '22023';
  end if;
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_wp_claim: workers only' using errcode = '42501';
  end if;

  return query
  with picked as (
    select j.id
      from public.agent_jobs j
      join public.agent_definitions d
        on d.slug = j.agent_slug and d.active
     where j.status = 'queued'
       and j.attempts < d.max_attempts
     order by j.created_at
     limit greatest(1, least(coalesce(p_limit, 5), 50))
     for update of j skip locked
  )
  update public.agent_jobs j
     set status           = 'running',
         attempts         = j.attempts + 1,
         worker_id        = p_worker,
         claimed_by       = p_worker,
         claimed_at       = now(),
         lease_expires_at = now() + p_lease,
         lease_epoch      = j.lease_epoch + 1
    from picked p, public.agent_definitions d
   where j.id = p.id and d.slug = j.agent_slug
  returning j.id, j.lease_epoch, j.agent_slug, d.model, d.temperature,
            j.source_table, j.record_id, j.prompt;
end
$fn$;

create or replace function public.agent_wp_complete(
  p_job_id   bigint,
  p_worker   text,
  p_epoch    bigint,
  p_response text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_job     public.agent_jobs;
  v_def     public.agent_definitions;
  v_rows    bigint;
  v_wrote   boolean := false;
  v_reason  text;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_wp_complete: workers only' using errcode = '42501';
  end if;

  update public.agent_jobs j
     set status           = 'done',
         response         = p_response,
         error            = null,
         finished_at      = now(),
         lease_expires_at = null
   where j.id          = p_job_id
     and j.status      = 'running'
     and j.worker_id   = p_worker
     and j.lease_epoch = p_epoch
  returning j.* into v_job;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_job from public.agent_jobs where id = p_job_id;
    if not found then
      v_reason := 'not_found';
    elsif v_job.status <> 'running' then
      v_reason := 'not_running';
    elsif v_job.worker_id is distinct from p_worker then
      v_reason := 'not_owner';
    else
      v_reason := 'stale_epoch';
    end if;
    return jsonb_build_object('accepted', false, 'rejected', v_reason, 'job', p_job_id);
  end if;

  select * into v_def from public.agent_definitions where slug = v_job.agent_slug;

  if v_def.target_field is not null
     and v_def.source_table is not null
     and v_def.source_table = v_job.source_table
     and exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name   = v_def.source_table
          and c.column_name  = v_def.target_field
     )
  then
    execute format(
      'update public.%I set %I = $1 where id::text = $2 and %I is null',
      v_def.source_table, v_def.target_field, v_def.target_field
    ) using btrim(coalesce(p_response, '')), v_job.record_id;
    get diagnostics v_rows = row_count;
    v_wrote := v_rows > 0;
  end if;

  return jsonb_build_object(
    'accepted', true, 'job', p_job_id, 'lease_epoch', p_epoch, 'wrote_field', v_wrote
  );
end
$fn$;

create or replace function public.agent_wp_fail(
  p_job_id bigint,
  p_worker text,
  p_epoch  bigint,
  p_error  text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_job    public.agent_jobs;
  v_max    integer;
  v_rows   bigint;
  v_reason text;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_wp_fail: workers only' using errcode = '42501';
  end if;

  select coalesce(d.max_attempts, 3) into v_max
    from public.agent_jobs j
    left join public.agent_definitions d on d.slug = j.agent_slug
   where j.id = p_job_id;
  v_max := coalesce(v_max, 3);

  update public.agent_jobs j
     set status           = case when j.attempts >= v_max then 'failed' else 'queued' end,
         error            = left(p_error, 2000),
         finished_at      = case when j.attempts >= v_max then now() else null end,
         worker_id        = null,
         claimed_by       = null,
         claimed_at       = null,
         lease_expires_at = null,
         lease_epoch      = j.lease_epoch + 1
   where j.id          = p_job_id
     and j.status      = 'running'
     and j.worker_id   = p_worker
     and j.lease_epoch = p_epoch
  returning j.* into v_job;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_job from public.agent_jobs where id = p_job_id;
    if not found then
      v_reason := 'not_found';
    elsif v_job.status <> 'running' then
      v_reason := 'not_running';
    elsif v_job.worker_id is distinct from p_worker then
      v_reason := 'not_owner';
    else
      v_reason := 'stale_epoch';
    end if;
    return jsonb_build_object('accepted', false, 'rejected', v_reason, 'job', p_job_id);
  end if;

  return jsonb_build_object(
    'accepted', true, 'job', p_job_id, 'status', v_job.status, 'attempts', v_job.attempts
  );
end
$fn$;

-- Repo form: create the reaper only if absent. On a fresh reset it is absent here and
-- 20260908195354 (agent_wp_reap_terminal_lease) replaces it next; a manual re-run of
-- this file therefore cannot regress the newer terminal-lease reaper.
do $guard$
begin
  if to_regprocedure('public.agent_wp_reap()') is not null then
    raise notice 'lease fencing: agent_wp_reap() already exists; left unchanged';
    return;
  end if;
  execute $mig$
create or replace function public.agent_wp_reap()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_n integer;
begin
  with expired as (
    update public.agent_jobs j
       set status           = 'queued',
           worker_id        = null,
           claimed_by       = null,
           claimed_at       = null,
           lease_expires_at = null,
           lease_epoch      = j.lease_epoch + 1
     where j.status           = 'running'
       and j.lease_expires_at is not null
       and j.lease_expires_at < now()
    returning j.id, j.lease_epoch, j.attempts, j.claimed_by
  )
  insert into public.audit_events (action, payload)
  select 'agent_job.lease_expired',
         jsonb_build_object('job', e.id, 'new_epoch', e.lease_epoch, 'attempts', e.attempts)
    from expired e;

  get diagnostics v_n = row_count;
  return v_n;
end
$fn$;
$mig$;
end
$guard$;
revoke all on function public.agent_wp_claim(text, integer, interval)       from public;
revoke all on function public.agent_wp_complete(bigint, text, bigint, text) from public;
revoke all on function public.agent_wp_fail(bigint, text, bigint, text)     from public;
revoke all on function public.agent_wp_reap()                               from public;

grant execute on function public.agent_wp_claim(text, integer, interval)       to service_role;
grant execute on function public.agent_wp_complete(bigint, text, bigint, text) to service_role;
grant execute on function public.agent_wp_fail(bigint, text, bigint, text)     to service_role;

revoke execute on function public.agent_complete_job(bigint, text, text) from service_role;
revoke execute on function public.finish_agent_job(bigint, text)         from service_role;
revoke execute on function public.fail_agent_job(bigint, text)           from service_role;
revoke execute on function public.claim_agent_job(text)                  from service_role;
revoke execute on function public.agent_claim_jobs(text, integer)        from service_role;

-- Repo form: schedule the reaper only where pg_cron is installed (cron.schedule upserts by name).
do $guard$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'lease fencing: pg_cron absent; reaper not scheduled';
    return;
  end if;
  perform cron.schedule('agent-wp-reap', '* * * * *', 'select public.agent_wp_reap();');
end
$guard$;
