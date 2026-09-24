-- Rental reservation spine: reservations + vehicle_blocks + one occupancy ledger.
--
-- ⚠️ NOT APPLIED TO PRODUCTION. Written 2026-09-24 on feat/rental-reservation-spine.
--    Applying DDL to the live database is the owner's call (prod-write baton).
--
-- DECIDED (not re-litigated here)
--   * Canonical vehicle = public.vehicles(id). public.fleet is legacy provenance and
--     is NOT touched by this file.
--   * Reservation lifecycle: pending -> confirmed -> {cancelled | expired |
--     converted_to_rental}. pending may also go straight to cancelled | expired.
--     Only pending, confirmed and converted_to_rental occupy inventory.
--   * btree_gist is already installed (create extension if not exists is a no-op).
--
-- WHY AN OCCUPANCY LEDGER, NOT CONSTRAINT TRIGGERS
--   Block-vs-reservation non-overlap is enforced by ONE exclusion constraint on
--   public.vehicle_occupancy, a derived table that AFTER-row triggers on
--   reservations and vehicle_blocks keep in step (one row per occupying
--   reservation / active block). The alternative -- a constraint trigger that locks
--   the vehicles row FOR UPDATE and then SELECTs for overlaps -- is only correct
--   under READ COMMITTED: at REPEATABLE READ / SERIALIZABLE the post-lock SELECT
--   still uses the transaction's start snapshot and can miss the row the other
--   writer just committed, and every future write path must remember to take the
--   same lock in the same order. An exclusion constraint has neither weakness:
--   the GiST index sees uncommitted conflicting entries, makes the second writer
--   WAIT on the first transaction, and raises 23P01 if the first commits (or lets
--   it through if the first rolls back) at every isolation level, with no locking
--   discipline required from application code. `source_type WITH <>` makes the
--   ledger reject reservation-vs-block overlaps only; reservation-vs-reservation
--   is the job of reservations_no_double_booking (per org/vehicle/status, below),
--   and overlapping blocks (e.g. maintenance + damage) are allowed.
--   The ledger is keyed on vehicle_id alone (a vehicle uuid is global), and a
--   BEFORE trigger pins every reservation/block org_id to its vehicle's org_id so
--   one org can never book another org's car.
--
-- Half-open '[)' ranges throughout: a slot ending at 10:00 and one starting at
-- 10:00 do not collide (same-day turnaround stays legal).
--
-- Idempotent: every object is guarded (if not exists / or replace / drop-if-exists
-- then create / constraint existence checks). Safe to re-run.
--
-- Proven on the disposable project tmmt-e2e-throwaway (xcjuohpmtdywgzdxkssb),
-- schema rental_proto, 2026-09-24 -- see M1-HANDOFF-E6.md for the SQL and results.

begin;

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. reservations
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reservations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default coalesce(
                    case when public.is_staff() then null else public.acting_org_id() end,
                    '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid),
  vehicle_id      uuid not null,
  person_id       uuid,
  period          tstzrange not null,
  status          text not null default 'pending',
  hold_expires_at timestamptz,
  notes           text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_vehicle_id_fkey'
                 and conrelid = 'public.reservations'::regclass) then
    alter table public.reservations
      add constraint reservations_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'reservations_status_check'
                 and conrelid = 'public.reservations'::regclass) then
    alter table public.reservations
      add constraint reservations_status_check
      check (status in ('pending','confirmed','cancelled','expired','converted_to_rental'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'reservations_period_valid'
                 and conrelid = 'public.reservations'::regclass) then
    alter table public.reservations
      add constraint reservations_period_valid
      check (not isempty(period) and lower(period) < upper(period)
             and not lower_inf(period) and not upper_inf(period));
  end if;

  -- THE GUARANTEE (reservation vs reservation).
  if not exists (select 1 from pg_constraint where conname = 'reservations_no_double_booking'
                 and conrelid = 'public.reservations'::regclass) then
    alter table public.reservations
      add constraint reservations_no_double_booking
      exclude using gist (org_id with =, vehicle_id with =, period with &&)
      where (status in ('pending','confirmed','converted_to_rental'));
  end if;
end $$;

create index if not exists reservations_org_id_idx on public.reservations (org_id);
create index if not exists reservations_vehicle_id_idx on public.reservations (vehicle_id);

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
-- 3. vehicle_occupancy -- derived ledger; the block-vs-reservation guarantee.
--    Written ONLY by the SECURITY DEFINER triggers below. Clients may read it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vehicle_occupancy (
  source_type text not null check (source_type in ('reservation','block')),
  source_id   uuid not null,
  org_id      uuid not null,
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

-- 4a. org_id must equal the vehicle's org (when the vehicle has one).
create or replace function public.rsv_enforce_vehicle_org()
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

-- 4b. Reservation lifecycle: only forward moves; terminal states are final.
create or replace function public.rsv_guard_reservation_transition()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'pending'   and new.status in ('confirmed','cancelled','expired'))
    or (old.status = 'confirmed' and new.status in ('cancelled','expired','converted_to_rental'))
  ) then
    raise exception 'illegal reservation transition % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

-- 4c. Keep the occupancy ledger in step. The INSERT into vehicle_occupancy is where
--     a reservation/block overlap raises 23P01 (vehicle_occupancy_no_block_overlap).
create or replace function public.rsv_sync_occupancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_type text := case when tg_table_name like '%vehicle_blocks' then 'block' else 'reservation' end;
  v_occupies boolean;
begin
  if tg_op in ('UPDATE','DELETE') then
    delete from public.vehicle_occupancy o
     where o.source_type = v_type and o.source_id = old.id;
  end if;

  if tg_op in ('INSERT','UPDATE') then
    v_occupies := case v_type
      when 'block' then new.status = 'active'
      else new.status in ('pending','confirmed','converted_to_rental')
    end;
    if v_occupies then
      insert into public.vehicle_occupancy (source_type, source_id, org_id, vehicle_id, period)
      values (v_type, new.id, new.org_id, new.vehicle_id, new.period);
    end if;
  end if;

  return null;
end;
$fn$;

revoke all on function public.rsv_enforce_vehicle_org() from public, anon, authenticated;
revoke all on function public.rsv_guard_reservation_transition() from public, anon, authenticated;
revoke all on function public.rsv_sync_occupancy() from public, anon, authenticated;

drop trigger if exists reservations_enforce_vehicle_org on public.reservations;
create trigger reservations_enforce_vehicle_org
  before insert or update of vehicle_id, org_id on public.reservations
  for each row execute function public.rsv_enforce_vehicle_org();

drop trigger if exists reservations_guard_transition on public.reservations;
create trigger reservations_guard_transition
  before update on public.reservations
  for each row execute function public.rsv_guard_reservation_transition();

drop trigger if exists reservations_sync_occupancy on public.reservations;
create trigger reservations_sync_occupancy
  after insert or update or delete on public.reservations
  for each row execute function public.rsv_sync_occupancy();

drop trigger if exists vehicle_blocks_enforce_vehicle_org on public.vehicle_blocks;
create trigger vehicle_blocks_enforce_vehicle_org
  before insert or update of vehicle_id, org_id on public.vehicle_blocks
  for each row execute function public.rsv_enforce_vehicle_org();

drop trigger if exists vehicle_blocks_sync_occupancy on public.vehicle_blocks;
create trigger vehicle_blocks_sync_occupancy
  after insert or update or delete on public.vehicle_blocks
  for each row execute function public.rsv_sync_occupancy();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS -- same shape as 20260621020000_tenant_scope_rls_policies.sql:
--    staff bypass OR member of the row's org; writes must name an org you belong to.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reservations      enable row level security;
alter table public.vehicle_blocks    enable row level security;
alter table public.vehicle_occupancy enable row level security;

drop policy if exists org_member_read on public.reservations;
create policy org_member_read on public.reservations for select to authenticated
  using (public.is_staff() or public.is_org_member(org_id));
drop policy if exists org_member_write on public.reservations;
create policy org_member_write on public.reservations for all to authenticated
  using (public.is_staff() or public.is_org_member(org_id))
  with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists org_member_read on public.vehicle_blocks;
create policy org_member_read on public.vehicle_blocks for select to authenticated
  using (public.is_staff() or public.is_org_member(org_id));
drop policy if exists org_member_write on public.vehicle_blocks;
create policy org_member_write on public.vehicle_blocks for all to authenticated
  using (public.is_staff() or public.is_org_member(org_id))
  with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)));

-- Occupancy: read-only to members; no write policy, so only the definer triggers write.
drop policy if exists org_member_read on public.vehicle_occupancy;
create policy org_member_read on public.vehicle_occupancy for select to authenticated
  using (public.is_staff() or public.is_org_member(org_id));

-- Supabase default privileges grant ALL (incl. TRUNCATE, which skips row triggers and
-- would desync the ledger) on new public tables. Reset, then grant exactly what is needed.
revoke all on public.reservations, public.vehicle_blocks, public.vehicle_occupancy from anon, authenticated;
grant select, insert, update, delete on public.reservations, public.vehicle_blocks to authenticated;
grant select on public.vehicle_occupancy to authenticated;

commit;
