-- Fence the agent_jobs completion path.
--
-- THE DEFECT
--   agent_complete_job(bigint, text, text), finish_agent_job(bigint, text) and
--   fail_agent_job(bigint, text) each take a job id and a payload and nothing
--   else. None of them checks worker identity, job status, or ownership. Any
--   caller holding service_role can therefore complete ANY job at ANY time --
--   one held by a different worker, or one that is already done. A worker that
--   partitions, loses its lease, and reconnects will happily overwrite work
--   another worker already finished.
--
--   Nothing has been harmed by this yet only because the plane has never had a
--   consumer: `grep` finds zero callers of any job RPC in src/ or scripts/, and
--   agent_jobs holds 24 'skipped' + 1 'done' and nothing else.
--
-- THE FIX
--   A claim mints a monotonic per-job lease_epoch. Completion and failure are
--   accepted only when (id, status='running', worker_id, lease_epoch) ALL still
--   match -- enforced in the WHERE clause of a single UPDATE, never in
--   application code. Zero rows updated means the caller is stale, duplicate or
--   an impostor; it gets a structured rejection instead of an exception, so a
--   reconnecting worker can discard cleanly rather than retry forever.
--
--   The epoch advances on claim, on failure, and on reclaim. That is what makes
--   a dead lease permanently dead without comparing clocks across machines.
--
-- A SECOND BUG, FIXED IN PASSING
--   agent_complete_job writes back with `where id = $2::uuid`. expenses.id is
--   uuid, but intake_events.id is BIGINT -- so that cast raises for every
--   intake-router job, and intake-router is active. The older finish_agent_job
--   used `id::text = $2`, which is correct for both. This migration keeps the
--   older form and restores that function's `and <target> is null` guard, which
--   the newer one dropped and which is what makes a duplicate write harmless.
--
-- SAFETY
--   Additive columns with defaults; 25 existing rows, none 'queued' or
--   'running', so nothing in flight. New functions under new names. The old
--   functions are left in place and only have EXECUTE revoked, so the change is
--   undone by a single GRANT if anything outside this repo turns out to call
--   them.
--
-- Signatures and ACLs below were read from production on 2026-09-05, never from
-- memory, per docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md steps 1 and 3.

-- ---------------------------------------------------------------- 1. columns

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

-- ------------------------------------------------------------------ 2. claim

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

-- --------------------------------------------------------------- 3. complete

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

  -- THE FENCE. Four predicates, one statement. Nothing downstream is trusted.
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

  -- Write-back happens only inside the accepted branch, so a rejected result
  -- can never reach a business row.
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
    -- id::text, not $2::uuid: intake_events.id is bigint and the cast raises.
    -- "and <target> is null" keeps a re-run from overwriting a value that a
    -- different lease already wrote.
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

-- ------------------------------------------------------------------- 4. fail

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

  -- Same fence. The epoch advances either way, so this lease is retired even
  -- when the job goes back on the queue.
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

-- ------------------------------------------------------------------ 5. reaper

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

-- ------------------------------------------------------------------ 6. grants
--
-- A freshly created function grants EXECUTE to PUBLIC by default. Revoking that
-- explicitly is not optional -- it is failure mode #1 in the runbook, inverted.

revoke all on function public.agent_wp_claim(text, integer, interval)      from public;
revoke all on function public.agent_wp_complete(bigint, text, bigint, text) from public;
revoke all on function public.agent_wp_fail(bigint, text, bigint, text)     from public;
revoke all on function public.agent_wp_reap()                               from public;

grant execute on function public.agent_wp_claim(text, integer, interval)      to service_role;
grant execute on function public.agent_wp_complete(bigint, text, bigint, text) to service_role;
grant execute on function public.agent_wp_fail(bigint, text, bigint, text)     to service_role;
-- agent_wp_reap is driven by cron as postgres; service_role has no reason to call it.

-- ------------------------------------------------- 7. close the unfenced path
--
-- Observed ACL on all five is {postgres=X/postgres,service_role=X/postgres} --
-- explicit grants, no PUBLIC entry -- so revoking service_role genuinely
-- removes reachability rather than silently no-opping. Bodies are left intact;
-- one GRANT restores any of them.

revoke execute on function public.agent_complete_job(bigint, text, text) from service_role;
revoke execute on function public.finish_agent_job(bigint, text)         from service_role;
revoke execute on function public.fail_agent_job(bigint, text)           from service_role;
revoke execute on function public.claim_agent_job(text)                  from service_role;
revoke execute on function public.agent_claim_jobs(text, integer)        from service_role;

-- -------------------------------------------------------------------- 8. cron

select cron.schedule('agent-wp-reap', '* * * * *', 'select public.agent_wp_reap();');
