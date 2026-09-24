-- ROLLBACK for supabase/migrations/20260924180000_vehicle_blocks_and_booking_occupancy.sql
--
-- NOT a migration: the Supabase CLI only reads supabase/migrations/, so this file never runs by
-- itself. Run it by hand, as one named step, only if the forward migration has to come out.
--
-- Origin: adopted from the independent QA's 60_down_spine.sql (qa/reservation-spine-independent
-- @6e6e93d, report QA-RESERVATION-SPINE-1e8f20d.md, B3). QA tested it up -> down -> up on
-- tmmt-e2e-throwaway. It was re-rehearsed up -> down -> up at E6e against the live-shape copy in
-- rental_proto. E6e changes from QA's text:
--   * restores service_role TRUNCATE on bookings, which the E6e forward migration revokes (QA B4).
--     That grant is the Supabase default the table had before the migration.
--   * the cron unschedule stays, harmlessly: E6e ships the job unscheduled, but an owner may have
--     enabled it after the apply.
--
-- Deliberately NOT reverted:
--   * section 1 of the forward migration (bookings_status_check, bookings_interval_sane,
--     bookings_no_overlap, bookings_vehicle_window_idx). These were live in prod BEFORE the
--     migration (ledger 20260917200051) and must survive a rollback. btree_gist is kept for the
--     same reason.
--
-- WARNING: dropping vehicle_blocks destroys every block row. Export them first if any exist:
--   select * from public.vehicle_blocks;
-- The ledger (vehicle_occupancy) is derived data and is rebuilt by the forward migration's backfill.
--
-- OWNER DECISION D4 (open): the faithful revert restores status default 'inquiry', which is outside
-- bookings_status_check, so every insert that omits status fails 23514 again. The app always
-- sends status, so nothing current breaks. If the owner prefers, replace that line with:
--   alter table public.bookings alter column status drop default;

begin;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'expire-stale-booking-holds') then
    perform cron.unschedule('expire-stale-booking-holds');
  end if;
end $$;

drop trigger if exists bookings_sync_occupancy on public.bookings;
drop trigger if exists bookings_enforce_vehicle_org on public.bookings;
drop table if exists public.vehicle_occupancy;
drop table if exists public.vehicle_blocks;          -- its two triggers go with it
drop function if exists public.expire_stale_booking_holds(interval);
drop function if exists public.vehicle_occupancy_sync();
drop function if exists public.enforce_vehicle_org();

-- Section 1b revert (faithful; see D4 above).
alter table public.bookings alter column status set default 'inquiry';

-- QA B4 revert: bookings had the Supabase default service_role grant, including TRUNCATE.
grant truncate on public.bookings to service_role;

commit;
