-- Exact agent_wp_* function bodies from
-- chore/agent-jobs-lease-fencing-20260906 : 20260906022156_agent_jobs_lease_fencing.sql.
-- The fixture schema is created by automation-repairs.pglite.test.mjs.

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
