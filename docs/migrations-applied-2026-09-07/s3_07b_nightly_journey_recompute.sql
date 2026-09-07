-- ============================================================================
-- S3-07b · NIGHTLY RECOMPUTE (SEPARATE AUTHORIZATION — this is behavior)
-- Do not bundle with S3-07 up.sql. Apply only after S3-07 is PRODUCTION VERIFIED
-- and the owner has authorized scheduled writes to client_journey.
--
-- What it does: once nightly, calls the EXISTING public.recompute_journey(email)
-- for every active customer with an email, so good_standing / good_standing_days /
-- the day_90_good_standing checkpoint / lto_eligible are kept current.
-- Follows the pg_cron pattern already used by 8 existing jobs.
-- ============================================================================

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

-- 04:30 UTC ≈ 00:30 America/New_York (matches the business's timezone, unlike the Airtable jobs)
select cron.schedule('aixmos_nightly_journey_recompute', '30 4 * * *', $$select public.recompute_all_journeys();$$);

-- ROLLBACK:
--   select cron.unschedule('aixmos_nightly_journey_recompute');
--   drop function if exists public.recompute_all_journeys();
