-- Exported from production migration history (20260907100002).
-- Source of truth: supabase_migrations.schema_migrations.
-- Do not edit by hand — re-run scripts/migrations-pull.mjs instead.

-- S3-07b · NIGHTLY JOURNEY RECOMPUTE
-- Calls the EXISTING public.recompute_journey(email) once nightly for every customer
-- in v_customer_standing so good_standing / good_standing_days / day_90 checkpoint /
-- lto_eligible stay current. Same pg_cron pattern as the 8 existing jobs.
-- Rollback: select cron.unschedule('aixmos_nightly_journey_recompute'); drop function public.recompute_all_journeys();

create or replace function public.recompute_all_journeys()
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare r record; n int := 0; e int := 0;
begin
  for r in select distinct customer_key from public.v_customer_standing loop
    begin
      perform public.recompute_journey(r.customer_key);
      n := n + 1;
    exception when others then
      e := e + 1;
      raise warning 'recompute_all_journeys: % -> %', r.customer_key, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'recomputed', n, 'errors', e, 'at', now());
end $$;
revoke all on function public.recompute_all_journeys() from public, anon, authenticated;

-- 04:30 UTC ≈ 00:30 America/New_York
select cron.schedule('aixmos_nightly_journey_recompute', '30 4 * * *', $$select public.recompute_all_journeys();$$);
