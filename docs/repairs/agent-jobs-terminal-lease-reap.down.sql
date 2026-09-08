-- Rollback candidate: restores prior reaper; does not resurrect/requeue jobs.
begin;
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

revoke all on function public.agent_wp_reap() from public, anon, authenticated, service_role;
commit;
