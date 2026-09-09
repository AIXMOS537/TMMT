-- REVIEW CANDIDATE ONLY. Not applied and intentionally outside migrations/.
-- Requires the existing lease-fencing migration and its worker signatures.
-- No worker, schedule or messaging behavior is enabled by this candidate.
begin;
do $guard$
begin
  if to_regprocedure('public.agent_wp_complete(bigint,text,bigint,text)') is null
     or to_regprocedure('public.agent_wp_fail(bigint,text,bigint,text)') is null
     or to_regprocedure('public.agent_wp_claim(text,integer,interval)') is null
     or to_regprocedure('public.agent_wp_reap()') is null
     or (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'agent_jobs'
            and column_name in ('lease_epoch', 'lease_expires_at', 'worker_id')) <> 3 then
    raise exception 'Missing lease fencing prerequisites; reconcile migration history first';
  end if;
end
$guard$;

create or replace function public.agent_wp_reap()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_n integer;
begin
  with limits as (
    select j.id, coalesce(d.max_attempts, 3) as max_attempts
      from public.agent_jobs j
      left join public.agent_definitions d on d.slug = j.agent_slug
  ), expired as (
    update public.agent_jobs j
       set status           = case when j.attempts >= l.max_attempts then 'failed' else 'queued' end,
           finished_at      = case when j.attempts >= l.max_attempts then now() else null end,
           error            = case when j.attempts >= l.max_attempts
                                   then 'Lease expired after maximum attempts' else j.error end,
           worker_id        = null,
           claimed_by       = null,
           claimed_at       = null,
           lease_expires_at = null,
           lease_epoch      = j.lease_epoch + 1
      from limits l
     where j.id = l.id and j.status           = 'running'
       and j.lease_expires_at is not null
       and j.lease_expires_at < now()
    returning j.id, j.lease_epoch, j.attempts, j.status
  )
  insert into public.audit_events (action, payload)
  select 'agent_job.lease_expired',
         jsonb_build_object('job', e.id, 'new_epoch', e.lease_epoch, 'attempts', e.attempts, 'status', e.status)
    from expired e;

  get diagnostics v_n = row_count;
  return v_n;
end
$fn$;

-- Existing reaper is postgres/cron-only. Never expose this SECURITY DEFINER RPC.
revoke all on function public.agent_wp_reap() from public, anon, authenticated, service_role;
commit;
