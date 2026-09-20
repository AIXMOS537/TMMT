-- Stop the same car being rented to two people over the same dates.
--
-- ⚠️ NOT APPLIED. Written 2026-09-16, left for X to run deliberately.
--    Applying DDL to the live database is his call, not mine.
--
-- WHY
-- Verified read-only against production 2026-09-16. public.bookings has:
--   bookings_pkey, bookings_ref_code_key (unique), and six FKs.
-- It has NO constraint preventing overlapping bookings on one vehicle, and NO
-- check on `status` (free text). Nothing has written the table yet, so nothing
-- has gone wrong — but the application-level guard added today
-- (src/lib/rental-pricing/availability.ts) loses the race between two
-- simultaneous requests. Only the database can win that race.
--
-- SAFETY
--   bookings row count at time of writing: 0.
--   Adding these constraints therefore cannot fail on existing data and cannot
--   invalidate a live booking. Re-verify the count is still 0 before running;
--   if rows exist by then, run the two SELECTs at the bottom FIRST.
--
-- PROVEN, not assumed. Every statement below was executed on the disposable
-- project tmmt-e2e-throwaway (xcjuohpmtdywgzdxkssb) on 2026-09-16 against a
-- probe table of identical shape, and each gate was WATCHED REFUSING before
-- this file was called done. The probe table was dropped afterwards.
--
--   ALLOWED  same-day turnaround   (ends 10:00 -> next starts 10:00)   4 rows in
--   ALLOWED  a cancelled booking overlapping a live one
--   ALLOWED  a different car over identical dates
--   REFUSED  a hold overlapping a confirmed booking on the same car
--            -> SQLSTATE 23P01 conflicting key value violates exclusion
--               constraint "bookings_no_overlap"
--   REFUSED  status = 'banana'                    -> check_violation (23514)
--   REFUSED  ends_at earlier than starts_at       -> check_violation (23514)
--
-- 23P01 is the code the write path must catch: it is how the database reports
-- that two requests raced and this one lost. See src/lib/rental-pricing/
-- create-booking.ts, which turns it into a conflict result rather than a 500.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. btree_gist lets an EXCLUDE constraint mix equality (=) on a uuid with
--    overlap (&&) on a time range in one index. Without it the constraint
--    below cannot be created.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pin the status vocabulary.
--
-- Mirrors BOOKING_STATUSES in src/lib/rental-pricing/availability.ts exactly.
-- Keep the two in step: the partial index in step 3 depends on these spellings,
-- and a typo'd status would silently stop blocking the calendar.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('hold','confirmed','active','completed','cancelled','no_show'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. An end must come after its start.
--    The app guard already refuses this; the database should not accept it
--    either, or a direct SQL write could create a booking that never ends.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add constraint bookings_interval_sane
  check (starts_at is null or ends_at is null or ends_at > starts_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. THE GUARANTEE: no two live bookings on one vehicle may overlap in time.
--
-- HALF-OPEN '[)' is deliberate and matches intervalsOverlap() in the app: a
-- booking ending at 10:00 and one starting at 10:00 do NOT collide. Same-day
-- turnaround is normal rental business and must stay legal.
--
-- The WHERE clause is what makes this correct rather than merely strict:
--   - only hold/confirmed/active hold a car. completed/cancelled/no_show
--     release it, so a cancelled booking never blocks the calendar.
--   - vehicle_id must be present; a booking with no car cannot conflict.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    vehicle_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (
    vehicle_id is not null
    and starts_at is not null
    and ends_at is not null
    and status in ('hold','confirmed','active')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. The calendar read path: "what is on this car between these dates".
--    Without it every availability check sequential-scans bookings.
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists bookings_vehicle_window_idx
  on public.bookings (vehicle_id, starts_at, ends_at)
  where status in ('hold','confirmed','active');

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- PRE-FLIGHT, if bookings is no longer empty when this is run.
-- Both must return zero rows before the constraints above will apply cleanly.
--
-- Bad intervals:
--   select id, starts_at, ends_at from public.bookings
--   where starts_at is not null and ends_at is not null and ends_at <= starts_at;
--
-- Existing overlaps:
--   select a.id, b.id, a.vehicle_id
--   from public.bookings a
--   join public.bookings b
--     on a.vehicle_id = b.vehicle_id and a.id < b.id
--    and tstzrange(a.starts_at, a.ends_at, '[)')
--     && tstzrange(b.starts_at, b.ends_at, '[)')
--   where a.status in ('hold','confirmed','active')
--     and b.status in ('hold','confirmed','active');
--
-- Unknown statuses (would fail bookings_status_check):
--   select distinct status from public.bookings
--   where status not in ('hold','confirmed','active','completed','cancelled','no_show');
--
-- ROLLBACK
--   alter table public.bookings drop constraint bookings_no_overlap;
--   alter table public.bookings drop constraint bookings_interval_sane;
--   alter table public.bookings drop constraint bookings_status_check;
--   drop index if exists public.bookings_vehicle_window_idx;
-- ─────────────────────────────────────────────────────────────────────────────
