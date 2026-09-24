-- Vehicle blocks + one occupancy ledger over public.bookings + hold expiry.
--
-- ⚠️ NOT APPLIED TO PRODUCTION. Written 2026-09-24 on feat/rental-reservation-spine (E6b).
--    Applying DDL to the live database is the owner's call (prod-write baton).
--
-- DECIDED (M1-DECISION-BOOKINGS-CANONICAL.md, 2026-09-24)
--   * public.bookings is THE reservation. It already has vehicle_id -> vehicles(id), org_id and
--     org-scoped RLS, and the app writes it (bookings/actions.ts, rental-pricing/create-booking.ts).
--     No second reservation table ships: E6's public.reservations is withdrawn.
--   * Canonical vehicle = public.vehicles(id). public.fleet is NOT touched.
--   * Occupying booking statuses: hold, confirmed, active. completed / cancelled / no_show release.
--
-- SECTION 1: RECORD WHAT PROD ALREADY HAS (create-only-if-missing).
--   bookings_status_check, bookings_interval_sane, bookings_no_overlap and bookings_vehicle_window_idx
--   are live in production. They arrived from 20260916235900_bookings_no_double_booking.sql, which
--   apply_migration recorded under its own version 20260917200051, so the repo file name never
--   matches the ledger. That file uses bare ADD CONSTRAINT and would fail if re-run. The guarded
--   copies below make a fresh database match prod and are a no-op on prod.
--   They are deliberately NOT "fixed": the definitions are byte-for-byte what pg_get_constraintdef
--   returns in prod today.
--
-- SECTION 2+: WHY AN OCCUPANCY LEDGER, NOT CONSTRAINT TRIGGERS
--   Block-vs-booking non-overlap is enforced by ONE exclusion constraint on
--   public.vehicle_occupancy. That is a derived table which AFTER-row triggers on bookings and
--   vehicle_blocks keep in step: one row per occupying booking / active block.
--   The alternative was a constraint trigger that locks the vehicles row FOR UPDATE and then
--   SELECTs for overlaps. It is only correct under READ COMMITTED. At REPEATABLE READ /
--   SERIALIZABLE the post-lock SELECT still uses the transaction's start snapshot and can miss the
--   row the other writer just committed. On top of that, every future write path would have to
--   remember to take the same lock.
--   An exclusion constraint has neither weakness. The GiST index sees uncommitted conflicting
--   entries and makes the second writer WAIT on the first transaction. If the first commits, the
--   second gets 23P01; if the first rolls back, the second goes through. This holds at every
--   isolation level, with no locking discipline required of application code.
--   `source_type WITH <>` means the ledger only rejects booking-vs-block overlaps.
--   Booking-vs-booking stays the job of bookings_no_overlap (belt and braces). Overlapping blocks
--   (e.g. maintenance + damage) are allowed.
--   The ledger is keyed on vehicle_id alone, because a vehicle uuid is global.
--
-- SECTION 5: HOLD EXPIRY
--   A 'hold' older than the TTL releases the car. public.expire_stale_booking_holds() moves it to
--   'cancelled' and stamps metadata.cancel_reason = 'hold_expired'. The status vocabulary has no
--   'expired', and this file does not change the live CHECK. The occupancy trigger then drops the
--   ledger row, and the bookings_no_overlap partial index stops covering it.
--   pg_cron runs it every 5 minutes. The TTL default MUST equal HOLD_TTL_MINUTES in
--   src/lib/rental-pricing/availability.ts; the schema-contract test pins the two together.
--   BUSINESS POLICY REQUIRED: 30 minutes is a placeholder until the owner sets the real TTL.
--
-- Half-open '[)' ranges throughout: a slot ending at 10:00 and one starting at 10:00 do not collide.
-- Idempotent: every object is guarded. Safe to re-run.
-- Rehearsed on tmmt-e2e-throwaway (xcjuohpmtdywgzdxkssb), schema rental_proto, against a copy of the
-- live bookings shape, 2026-09-24. See M1-HANDOFF-E6.md (section E6b).

begin;

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Record the live bookings guards (create only if missing; no-op on prod)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_status_check'
                 and conrelid = 'public.bookings'::regclass) then
    alter table public.bookings
      add constraint bookings_status_check
      check (status in ('hold','confirmed','active','completed','cancelled','no_show'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_interval_sane'
                 and conrelid = 'public.bookings'::regclass) then
    alter table public.bookings
      add constraint bookings_interval_sane
      check (starts_at is null or ends_at is null or ends_at > starts_at);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap'
                 and conrelid = 'public.bookings'::regclass) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (vehicle_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
      where (vehicle_id is not null and starts_at is not null and ends_at is not null
             and status in ('hold','confirmed','active'));
  end if;
end $$;

create index if not exists bookings_vehicle_window_idx
  on public.bookings (vehicle_id, starts_at, ends_at)
  where status in ('hold','confirmed','active');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. vehicle_blocks
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vehicle_blocks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null default coalesce(
                case when public.is_staff() then null else public.acting_org_id() end,
                '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid),
  vehicle_id  uuid not null,
  kind        text not null,
  period      tstzrange not null,
  status      text not null default 'active',
  reason      text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicle_blocks_vehicle_id_fkey'
                 and conrelid = 'public.vehicle_blocks'::regclass) then
    alter table public.vehicle_blocks
      add constraint vehicle_blocks_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vehicle_blocks_kind_check'
                 and conrelid = 'public.vehicle_blocks'::regclass) then
    alter table public.vehicle_blocks
      add constraint vehicle_blocks_kind_check
      check (kind in ('maintenance','out_of_service','owner_hold','damage'));
  end if;

  -- active = occupies the vehicle; ended = released early; cancelled = never happened.
  if not exists (select 1 from pg_constraint where conname = 'vehicle_blocks_status_check'
                 and conrelid = 'public.vehicle_blocks'::regclass) then
    alter table public.vehicle_blocks
      add constraint vehicle_blocks_status_check
      check (status in ('active','ended','cancelled'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vehicle_blocks_period_valid'
                 and conrelid = 'public.vehicle_blocks'::regclass) then
    alter table public.vehicle_blocks
      add constraint vehicle_blocks_period_valid
      check (not isempty(period) and lower(period) < upper(period) and not lower_inf(period));
  end if;
end $$;

create index if not exists vehicle_blocks_org_id_idx on public.vehicle_blocks (org_id);
create index if not exists vehicle_blocks_vehicle_id_idx on public.vehicle_blocks (vehicle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. vehicle_occupancy: the derived ledger that guarantees no booking/block overlap.
--    Written ONLY by the SECURITY DEFINER trigger below. Clients may read it.
--    org_id is nullable because bookings.org_id is nullable in prod.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vehicle_occupancy (
  source_type text not null check (source_type in ('booking','block')),
  source_id   uuid not null,
  org_id      uuid,
  vehicle_id  uuid not null,
  period      tstzrange not null,
  primary key (source_type, source_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicle_occupancy_no_block_overlap'
                 and conrelid = 'public.vehicle_occupancy'::regclass) then
    alter table public.vehicle_occupancy
      add constraint vehicle_occupancy_no_block_overlap
      exclude using gist (vehicle_id with =, period with &&, source_type with <>);
  end if;
end $$;

create index if not exists vehicle_occupancy_org_id_idx on public.vehicle_occupancy (org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. A block's org_id must equal its vehicle's org (when the vehicle has one).
--     Not added to bookings: that would change behaviour on a live, app-written table.
create or replace function public.vehicle_blocks_enforce_vehicle_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_org uuid;
begin
  select v.org_id into v_org from public.vehicles v where v.id = new.vehicle_id;
  if v_org is not null and v_org is distinct from new.org_id then
    raise exception 'org_id % does not own vehicle %', new.org_id, new.vehicle_id
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;

-- 4b. Keep the occupancy ledger in step. The INSERT into vehicle_occupancy is where a
--     booking/block overlap raises 23P01 (vehicle_occupancy_no_block_overlap).
create or replace function public.vehicle_occupancy_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_type text := case when tg_table_name = 'vehicle_blocks' then 'block' else 'booking' end;
  v_occupies boolean;
  v_period tstzrange;
begin
  if tg_op in ('UPDATE','DELETE') then
    delete from public.vehicle_occupancy o
     where o.source_type = v_type and o.source_id = old.id;
  end if;

  if tg_op in ('INSERT','UPDATE') then
    if v_type = 'block' then
      v_occupies := new.status = 'active';
      v_period := new.period;
    else
      v_occupies := new.status in ('hold','confirmed','active')
                    and new.vehicle_id is not null
                    and new.starts_at is not null
                    and new.ends_at is not null;
      if v_occupies then
        v_period := tstzrange(new.starts_at, new.ends_at, '[)');
      end if;
    end if;
    if v_occupies then
      insert into public.vehicle_occupancy (source_type, source_id, org_id, vehicle_id, period)
      values (v_type, new.id, new.org_id, new.vehicle_id, v_period);
    end if;
  end if;

  return null;
end;
$fn$;

revoke all on function public.vehicle_blocks_enforce_vehicle_org() from public, anon, authenticated;
revoke all on function public.vehicle_occupancy_sync() from public, anon, authenticated;

drop trigger if exists vehicle_blocks_enforce_vehicle_org on public.vehicle_blocks;
create trigger vehicle_blocks_enforce_vehicle_org
  before insert or update of vehicle_id, org_id on public.vehicle_blocks
  for each row execute function public.vehicle_blocks_enforce_vehicle_org();

drop trigger if exists vehicle_blocks_sync_occupancy on public.vehicle_blocks;
create trigger vehicle_blocks_sync_occupancy
  after insert or update or delete on public.vehicle_blocks
  for each row execute function public.vehicle_occupancy_sync();

drop trigger if exists bookings_sync_occupancy on public.bookings;
create trigger bookings_sync_occupancy
  after insert or update or delete on public.bookings
  for each row execute function public.vehicle_occupancy_sync();

-- Backfill: any booking that already occupies a car gets its ledger row (prod: 0 rows today).
insert into public.vehicle_occupancy (source_type, source_id, org_id, vehicle_id, period)
select 'booking', b.id, b.org_id, b.vehicle_id, tstzrange(b.starts_at, b.ends_at, '[)')
  from public.bookings b
 where b.status in ('hold','confirmed','active')
   and b.vehicle_id is not null and b.starts_at is not null and b.ends_at is not null
on conflict (source_type, source_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Hold expiry (TTL must equal HOLD_TTL_MINUTES in availability.ts)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.expire_stale_booking_holds(
  p_ttl interval default interval '30 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare n integer;
begin
  update public.bookings b
     set status = 'cancelled',
         updated_at = now(),
         metadata = coalesce(b.metadata, '{}'::jsonb)
                    || jsonb_build_object('cancel_reason', 'hold_expired',
                                          'hold_expired_at', now(),
                                          'hold_ttl', p_ttl::text)
   where b.status = 'hold'
     and b.created_at < now() - p_ttl;
  get diagnostics n = row_count;
  return n;
end;
$fn$;

revoke all on function public.expire_stale_booking_holds(interval) from public, anon, authenticated;
grant execute on function public.expire_stale_booking_holds(interval) to service_role;

-- cron.schedule upserts by job name, so this is idempotent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-stale-booking-holds', '*/5 * * * *',
                          'select public.expire_stale_booking_holds()');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS: same shape as 20260621020000_tenant_scope_rls_policies.sql.
--    bookings keeps its existing live policies; nothing here touches them.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vehicle_blocks    enable row level security;
alter table public.vehicle_occupancy enable row level security;

drop policy if exists org_member_read on public.vehicle_blocks;
create policy org_member_read on public.vehicle_blocks for select to authenticated
  using (public.is_staff() or public.is_org_member(org_id));
drop policy if exists org_member_write on public.vehicle_blocks;
create policy org_member_write on public.vehicle_blocks for all to authenticated
  using (public.is_staff() or public.is_org_member(org_id))
  with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)));

-- Occupancy: read-only to members; no write policy, so only the definer trigger writes.
drop policy if exists org_member_read on public.vehicle_occupancy;
create policy org_member_read on public.vehicle_occupancy for select to authenticated
  using (public.is_staff() or public.is_org_member(org_id));

-- Supabase default privileges grant ALL on new public tables, including TRUNCATE, which skips
-- row triggers and would desync the ledger. Reset, then grant exactly what is needed.
revoke all on public.vehicle_blocks, public.vehicle_occupancy from anon, authenticated;
grant select, insert, update, delete on public.vehicle_blocks to authenticated;
grant select on public.vehicle_occupancy to authenticated;

commit;
