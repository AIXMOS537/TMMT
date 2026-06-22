-- Lead Pool + Operator Sub-Accounts — Phase 1 (additive, owner-shipped).
-- Spec: docs/superpowers/specs/2026-06-19-lead-pool-and-subaccounts-design.md
-- Topology: docs/NETWORK-TOPOLOGY.md
--
-- PROJECT AIXMOS = engine. MOE LEGACY + TMMT RENTALS = agencies (tenants).
-- Operators = child sub-accounts. Ads -> shared lead pool -> agency -> operator.
--
-- SAFETY: purely additive. No existing table is dropped or repurposed; new
-- columns are nullable so current flat orgs keep working unchanged. RLS on;
-- service_role-only writes; atomic claim (no double-claim); fail-closed.
-- "Everyone pays": a sub-account is its own org with its own token balance
-- (funded via the existing tmmt_token_grant). Only the owner carries unlimited.

-- ── Hierarchy on organizations (nullable = no behavior change for existing) ──
alter table public.organizations
  add column if not exists parent_org_id uuid references public.organizations(id) on delete set null;
alter table public.organizations
  add column if not exists org_kind text;  -- 'engine' | 'agency' | 'operator' (null = legacy/agency)
create index if not exists organizations_parent_idx on public.organizations (parent_org_id);

-- Caller's org (SECURITY DEFINER so RLS policies can use it without recursion).
create or replace function public.lp_caller_org()
returns uuid language sql stable security definer set search_path = '' as $fn$
  select organization_id from public.profiles where id = auth.uid()
$fn$;

-- ── Lead routing rules: campaign/source/vertical -> agency ───────────────────
create table if not exists public.lead_routes (
  id            bigint generated always as identity primary key,
  match_kind    text    not null check (match_kind in ('vertical','utm_campaign','utm_source')),
  match_value   text    not null,
  agency_org_id uuid    not null references public.organizations(id) on delete cascade,
  vertical      text    not null check (vertical in ('rentals','funding')),
  priority      int     not null default 100,
  created_at    timestamptz not null default now(),
  unique (match_kind, match_value)
);

-- ── The shared lead pool (one row per lead per agency) ───────────────────────
create table if not exists public.lead_pool (
  id                 bigint generated always as identity primary key,
  lead_id            uuid        references public.incoming_leads(id) on delete cascade,
  vertical           text        not null check (vertical in ('rentals','funding')),
  agency_org_id      uuid        not null references public.organizations(id) on delete cascade,
  status             text        not null default 'available'
                       check (status in ('available','claimed','assigned','closed','expired')),
  claimed_by_org_id  uuid        references public.organizations(id) on delete set null,
  claimed_by_user_id uuid,
  claimed_at         timestamptz,
  origin             text,        -- 'route' | 'cross_referral'
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (lead_id, agency_org_id)  -- one pool entry per lead per agency (enables cross-referral)
);
create index if not exists lead_pool_agency_status_idx on public.lead_pool (agency_org_id, status, created_at desc);
create index if not exists lead_pool_claimed_idx on public.lead_pool (claimed_by_org_id) where claimed_by_org_id is not null;

-- ── RLS: read-own; no client writes (service_role only) ─────────────────────
alter table public.lead_routes enable row level security;
alter table public.lead_pool   enable row level security;

drop policy if exists lead_routes_read on public.lead_routes;
create policy lead_routes_read on public.lead_routes
  for select using (public.is_staff());

-- An operator (child) sees only AVAILABLE leads for its agency + its OWN claims —
-- never a sibling's claimed/assigned lead. The agency main account sees its whole
-- pool. Staff bypass. This fence protects every operator's book from siblings.
drop policy if exists lead_pool_read on public.lead_pool;
create policy lead_pool_read on public.lead_pool
  for select using (
    public.is_staff()
    or agency_org_id = public.lp_caller_org()              -- agency main account: whole pool
    or claimed_by_org_id = public.lp_caller_org()          -- the operator's own claimed/assigned
    or (
      status = 'available'                                 -- child operator: AVAILABLE only
      and agency_org_id = (select parent_org_id from public.organizations where id = public.lp_caller_org())
    )
  );

-- Let a user read their own org + its parent + their own children (additive to
-- the existing staff_all_organizations policy; never reduces access).
drop policy if exists org_read_self_and_kin on public.organizations;
create policy org_read_self_and_kin on public.organizations
  for select using (
    public.is_staff()
    or id = public.lp_caller_org()
    or id = (select parent_org_id from public.organizations o2 where o2.id = public.lp_caller_org())
    or parent_org_id = public.lp_caller_org()
  );

-- ── Route a captured lead into the pool (idempotent per lead+agency) ─────────
create or replace function public.lead_route(
  p_lead     uuid,
  p_vertical text,
  p_agency   uuid,
  p_expires  timestamptz default null,
  p_origin   text default 'route'
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_id bigint;
begin
  if p_vertical not in ('rentals','funding') then
    raise exception 'lead_route: vertical must be rentals|funding';
  end if;
  insert into public.lead_pool (lead_id, vertical, agency_org_id, expires_at, origin)
    values (p_lead, p_vertical, p_agency, p_expires, p_origin)
  on conflict (lead_id, agency_org_id) do nothing
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('routed', false, 'reason', 'duplicate');
  end if;
  return jsonb_build_object('routed', true, 'pool_id', v_id);
end;
$fn$;

-- ── Atomic claim (fairness meter — no two operators get one lead) ───────────
create or replace function public.lead_claim(
  p_pool bigint,
  p_org  uuid,
  p_user uuid
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_id bigint;
begin
  update public.lead_pool
    set status='claimed', claimed_by_org_id=p_org, claimed_by_user_id=p_user,
        claimed_at=now(), updated_at=now()
    where id=p_pool and status='available'
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'unavailable');
  end if;
  return jsonb_build_object('claimed', true, 'pool_id', v_id);
end;
$fn$;

-- ── Agency/owner assigns a lead to a specific operator sub-account ───────────
create or replace function public.lead_assign(
  p_pool bigint,
  p_org  uuid
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_id bigint;
begin
  update public.lead_pool
    set status='assigned', claimed_by_org_id=p_org, claimed_at=now(), updated_at=now()
    where id=p_pool and status in ('available','claimed')
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('assigned', false, 'reason', 'not_assignable');
  end if;
  return jsonb_build_object('assigned', true, 'pool_id', v_id);
end;
$fn$;

-- ── Network cross-referral: hand a lead to the OTHER agency (new pool row) ───
create or replace function public.lead_cross_refer(
  p_pool            bigint,
  p_target_agency   uuid,
  p_target_vertical text
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_lead uuid; v_new bigint;
begin
  if p_target_vertical not in ('rentals','funding') then
    raise exception 'lead_cross_refer: vertical must be rentals|funding';
  end if;
  select lead_id into v_lead from public.lead_pool where id=p_pool;
  if v_lead is null then
    return jsonb_build_object('referred', false, 'reason', 'no_source');
  end if;
  insert into public.lead_pool (lead_id, vertical, agency_org_id, origin)
    values (v_lead, p_target_vertical, p_target_agency, 'cross_referral')
  on conflict (lead_id, agency_org_id) do nothing
  returning id into v_new;
  if v_new is null then
    return jsonb_build_object('referred', false, 'reason', 'duplicate');
  end if;
  return jsonb_build_object('referred', true, 'pool_id', v_new);
end;
$fn$;

-- ── Lock functions to the server (service_role) only ────────────────────────
revoke all on function public.lead_route(uuid, text, uuid, timestamptz, text) from public;
revoke all on function public.lead_claim(bigint, uuid, uuid) from public;
revoke all on function public.lead_assign(bigint, uuid) from public;
revoke all on function public.lead_cross_refer(bigint, uuid, text) from public;
grant execute on function public.lead_route(uuid, text, uuid, timestamptz, text) to service_role;
grant execute on function public.lead_claim(bigint, uuid, uuid) to service_role;
grant execute on function public.lead_assign(bigint, uuid) to service_role;
grant execute on function public.lead_cross_refer(bigint, uuid, text) to service_role;
