-- =============================================================================
-- 20260901120000_vehicle_owners_and_agreements.sql
--
-- Roadmap Phase 2, steps 1-2. Gives vehicle ownership a real identity and gives
-- each vehicle a real agreement, so an owner statement can finally be produced.
--
-- STATUS: NOT YET APPLIED. Requires owner approval -- see CHANGE_REQUEST_001.md.
--
-- WHAT THIS DOES NOT DO (deliberately):
--   * It does not modify, move or delete a single existing row.
--   * It does not populate fleet.owner_id. The backfill is a separate, reviewed
--     step because 21 free-text owner strings need a HUMAN to say who is who.
--   * It does not drop fleet.partner_name or fleet.partner_percentage. Those stay
--     as the source of truth until the backfill is verified, then get retired in
--     a later migration.
--
-- WHY NOT REUSE revenue_splits: it is keyed on operator_id / deal_id and has no
-- vehicle reference at all. It models the operator-network business, not
-- vehicle-owner payouts. Extending it would conflate two different money flows.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. vehicle_owners -- the identity of a person or entity that owns vehicles
-- -----------------------------------------------------------------------------
create table if not exists public.vehicle_owners (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id),

  display_name      text not null,
  legal_name        text,
  entity_type       text not null default 'individual'
                      check (entity_type in ('individual','company','house')),

  -- 'house' means TMMT itself owns the vehicle. Kept as an owner record rather
  -- than a null so that company-owned vehicles appear in the same reporting.
  is_house          boolean not null default false,

  email             text,
  phone_e164        text,

  -- Every spelling of this owner ever seen in fleet.partner_name. Keeps the
  -- reconciliation auditable and lets the backfill be re-run or reversed.
  known_aliases     text[] not null default '{}',

  status            text not null default 'active'
                      check (status in ('active','inactive','exited')),
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.vehicle_owners is
  'A person or entity that owns vehicles TMMT manages. Replaces the free-text fleet.partner_name. NOT the same as public.partners, which is a referral-routing table.';
comment on column public.vehicle_owners.known_aliases is
  'Every fleet.partner_name spelling mapped to this owner. Audit trail for the reconciliation.';
comment on column public.vehicle_owners.is_house is
  'True when TMMT owns the vehicle itself (the "TMMT Rentals" / "TMMT" / "Tmmt" strings).';

create unique index if not exists vehicle_owners_org_display_name_uniq
  on public.vehicle_owners (org_id, lower(btrim(display_name)));
create index if not exists vehicle_owners_org_idx
  on public.vehicle_owners (org_id);

-- -----------------------------------------------------------------------------
-- 2. fleet.owner_id -- nullable FK, additive only
-- -----------------------------------------------------------------------------
alter table public.fleet
  add column if not exists owner_id uuid references public.vehicle_owners (id);

create index if not exists fleet_owner_id_idx on public.fleet (owner_id);

comment on column public.fleet.owner_id is
  'The vehicle owner. Nullable during migration. Supersedes partner_name/partner_percentage, which stay populated until the backfill is verified.';

-- -----------------------------------------------------------------------------
-- 3. owner_agreements -- the terms, PER VEHICLE
--
-- Per owner instruction 2026-09-01: terms "vary per person and per car", so this
-- is keyed on (owner, vehicle) and never on the owner alone.
--
-- Shape follows docs/PARTNERSHIP-MODEL.md and scripts/deal.sh: TMMT's carrying
-- cost comes off the top FIRST, then the remainder is split. A flat percentage
-- of gross cannot express that, which is why cost_recovery_cents exists.
-- -----------------------------------------------------------------------------
create table if not exists public.owner_agreements (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations (id),

  owner_id                 uuid not null references public.vehicle_owners (id),
  vehicle_id               uuid not null references public.fleet (id),

  -- Which written agreement this came from, so a row can always be traced to paper.
  source_document          text,
  jv_tier                  smallint check (jv_tier between 1 and 5),

  -- THE SPLIT.
  -- owner_share_pct is the OWNER's share of the splittable remainder, in basis
  -- points (7000 = 70.00%). Basis points, not a float, because money must not
  -- carry rounding error.
  --
  -- Semantics confirmed 2026-09-01 by cross-referencing the live DB against the
  -- Drive payout reports: fleet.partner_percentage = 0.7 for Asad, and Asad's
  -- report shows "Split: 30/70" with payout = 70% of gross. So the stored number
  -- has always been the PARTNER's share, not TMMT's.
  owner_share_bps          integer not null check (owner_share_bps between 0 and 10000),

  -- Cost recovery off the top, per period. Null = no cost recovery on this deal
  -- (a straight percentage arrangement). 0 is meaningfully different from null.
  cost_recovery_cents      integer check (cost_recovery_cents >= 0),

  -- Recurring deductions taken from the owner's side before payout. The live
  -- payout reports deduct a flat $120/month for insurance; the v2 contract says
  -- $70 and v3 leaves it blank. [OPEN] -- do not seed a default.
  insurance_charge_cents   integer check (insurance_charge_cents >= 0),
  insurance_charge_period  text check (insurance_charge_period in ('weekly','monthly')),

  -- Who bears which cost. Text rather than boolean because 'shared' and
  -- 'renter' are both real answers.
  maintenance_paid_by      text check (maintenance_paid_by in ('owner','tmmt','shared','renter')),
  repairs_paid_by          text check (repairs_paid_by in ('owner','tmmt','shared','renter')),
  tickets_paid_by          text check (tickets_paid_by in ('owner','tmmt','shared','renter')),
  insurance_paid_by        text check (insurance_paid_by in ('owner','tmmt','shared','renter')),

  -- Above this, a repair needs approval before it is incurred. Null = always ask.
  repair_approval_limit_cents integer check (repair_approval_limit_cents >= 0),

  payout_cadence           text check (payout_cadence in ('weekly','biweekly','monthly','on_collection')),

  effective_from           date not null,
  effective_to             date,

  status                   text not null default 'active'
                             check (status in ('draft','active','superseded','terminated')),

  -- Whether real signed paper exists. Today the honest answer for every row is
  -- false: the Drive sweep found no executed JV agreement.
  signed                   boolean not null default false,
  signed_at                timestamptz,
  signed_document_path     text,

  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint owner_agreements_period_sane
    check (effective_to is null or effective_to >= effective_from),
  constraint owner_agreements_signed_has_date
    check (not signed or signed_at is not null)
);

comment on table public.owner_agreements is
  'Per-vehicle terms between TMMT and a vehicle owner. Keyed on (owner, vehicle) because terms vary per person AND per car [STATED, owner, 2026-09-01].';
comment on column public.owner_agreements.owner_share_bps is
  'The OWNER''s share of the splittable remainder, in basis points. 7000 = 70%. Semantics verified against the Drive payout reports.';
comment on column public.owner_agreements.cost_recovery_cents is
  'TMMT carrying cost taken off the top BEFORE the split. Null = straight percentage, no recovery. See docs/PARTNERSHIP-MODEL.md.';

-- Only one active agreement per vehicle at a time. Superseded rows are kept.
create unique index if not exists owner_agreements_one_active_per_vehicle
  on public.owner_agreements (vehicle_id)
  where status = 'active';

create index if not exists owner_agreements_owner_idx   on public.owner_agreements (owner_id);
create index if not exists owner_agreements_vehicle_idx on public.owner_agreements (vehicle_id);
create index if not exists owner_agreements_org_idx     on public.owner_agreements (org_id);

-- -----------------------------------------------------------------------------
-- 4. updated_at triggers
-- -----------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicle_owners_touch on public.vehicle_owners;
create trigger vehicle_owners_touch
  before update on public.vehicle_owners
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists owner_agreements_touch on public.owner_agreements;
create trigger owner_agreements_touch
  before update on public.owner_agreements
  for each row execute function public.tg_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 5. RLS -- deny by default, then grant deliberately
--
-- Deliberately NO anon policy. The advisor scan on 2026-09-01 found 12
-- anon-executable SECURITY DEFINER functions already; this migration adds none.
-- -----------------------------------------------------------------------------
alter table public.vehicle_owners   enable row level security;
alter table public.owner_agreements enable row level security;

revoke all on public.vehicle_owners   from anon;
revoke all on public.owner_agreements from anon;

-- Staff and admins of the owning org can read.
drop policy if exists vehicle_owners_read_internal on public.vehicle_owners;
create policy vehicle_owners_read_internal on public.vehicle_owners
  for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists owner_agreements_read_internal on public.owner_agreements;
create policy owner_agreements_read_internal on public.owner_agreements
  for select to authenticated
  using (public.is_org_member(org_id));

-- Only platform admins may write. Commercial terms are an owner-gated concern:
-- a VA must never be able to change a split.
drop policy if exists vehicle_owners_write_admin on public.vehicle_owners;
create policy vehicle_owners_write_admin on public.vehicle_owners
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists owner_agreements_write_admin on public.owner_agreements;
create policy owner_agreements_write_admin on public.owner_agreements
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- An owner may read their OWN agreement, but only for vehicles already paired to
-- them via partner_fleet_access. Matches the stated access rule: "partners only
-- see what they need once their vehicle is paired with a renter."
drop policy if exists owner_agreements_read_own on public.owner_agreements;
create policy owner_agreements_read_own on public.owner_agreements
  for select to authenticated
  using (
    exists (
      select 1
      from public.partner_fleet_access pfa
      where pfa.fleet_id = owner_agreements.vehicle_id
        and pfa.partner_user_id = auth.uid()
    )
  );

commit;

-- =============================================================================
-- NOT IN THIS MIGRATION, ON PURPOSE
--
--   * Backfilling fleet.owner_id           -> needs human reconciliation first
--   * owner_statements / payouts           -> next migration, after expense
--                                             attribution exists
--   * Retiring partner_name/partner_percentage -> only once the backfill is
--                                             verified against real payouts
--
-- ROLLBACK
--   begin;
--     drop policy if exists owner_agreements_read_own       on public.owner_agreements;
--     drop policy if exists owner_agreements_write_admin    on public.owner_agreements;
--     drop policy if exists owner_agreements_read_internal  on public.owner_agreements;
--     drop policy if exists vehicle_owners_write_admin      on public.vehicle_owners;
--     drop policy if exists vehicle_owners_read_internal    on public.vehicle_owners;
--     drop trigger if exists owner_agreements_touch on public.owner_agreements;
--     drop trigger if exists vehicle_owners_touch   on public.vehicle_owners;
--     drop table if exists public.owner_agreements;
--     alter table public.fleet drop column if exists owner_id;
--     drop table if exists public.vehicle_owners;
--   commit;
--
--   Safe because nothing outside this migration writes to these objects yet and
--   fleet.owner_id is nullable and unpopulated. tg_touch_updated_at() is left in
--   place -- it is generic and harmless.
-- =============================================================================
