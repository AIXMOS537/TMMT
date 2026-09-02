-- TMMT Token Ledger — metered engine access ("the genie meter").
-- $97/mo tops up an org's token balance; each engine job spends tokens.
-- Owner + first-10 operators carry `unlimited = true` and are never metered.
-- Spec: docs/superpowers/specs/2026-06-18-tmmt-token-ledger.md
--
-- Security posture (matches the rest of this DB):
--   - RLS on; a caller reads ONLY their own org's rows (is_staff bypass).
--   - No write policies => only service_role (server) mutates balances/events.
--   - grant/spend are SECURITY DEFINER with pinned search_path, EXECUTE revoked
--     from PUBLIC and granted to service_role only.

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.tmmt_token_balances (
  org_id            uuid primary key references public.organizations(id) on delete cascade,
  balance           integer     not null default 0 check (balance >= 0),
  monthly_allotment integer     not null default 0 check (monthly_allotment >= 0),
  plan_tier         text        not null default 'none',
  unlimited         boolean     not null default false,
  status            text        not null default 'active' check (status in ('active','suspended')),
  last_topup_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Append-only audit trail. dedupe_key makes grants idempotent (payment retries).
create table if not exists public.tmmt_token_events (
  id            bigint generated always as identity primary key,
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  delta         integer     not null,
  reason        text        not null,
  dedupe_key    text        unique,
  job_ref       text,
  balance_after integer,
  created_at    timestamptz not null default now()
);
create index if not exists tmmt_token_events_org_created_idx
  on public.tmmt_token_events (org_id, created_at desc);

-- ── RLS: read own org only; no client writes ───────────────────────────────
alter table public.tmmt_token_balances enable row level security;
alter table public.tmmt_token_events   enable row level security;

drop policy if exists tmmt_balances_read_own on public.tmmt_token_balances;
create policy tmmt_balances_read_own on public.tmmt_token_balances
  for select using (public.is_staff() or public.is_org_member(org_id));

drop policy if exists tmmt_events_read_own on public.tmmt_token_events;
create policy tmmt_events_read_own on public.tmmt_token_events
  for select using (public.is_staff() or public.is_org_member(org_id));

-- ── Idempotent grant (top-up) ──────────────────────────────────────────────
create or replace function public.tmmt_token_grant(
  p_org           uuid,
  p_amount        integer,
  p_reason        text,
  p_dedupe        text    default null,
  p_set_allotment integer default null,
  p_tier          text    default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_event_id bigint;
  v_balance  integer;
begin
  if p_amount < 0 then
    raise exception 'tmmt_token_grant: amount must be non-negative';
  end if;

  -- A repeated dedupe key collides on the unique index → grant nothing twice.
  insert into public.tmmt_token_events (org_id, delta, reason, dedupe_key)
    values (p_org, p_amount, p_reason, p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if p_dedupe is not null and v_event_id is null then
    select balance into v_balance from public.tmmt_token_balances where org_id = p_org;
    return jsonb_build_object('granted', false, 'reason', 'duplicate', 'balance', coalesce(v_balance, 0));
  end if;

  insert into public.tmmt_token_balances as b
      (org_id, balance, monthly_allotment, plan_tier, last_topup_at)
    values (p_org, p_amount, coalesce(p_set_allotment, p_amount), coalesce(p_tier, 'member'), now())
  on conflict (org_id) do update
    set balance           = b.balance + p_amount,
        monthly_allotment = coalesce(p_set_allotment, b.monthly_allotment),
        plan_tier         = coalesce(p_tier, b.plan_tier),
        last_topup_at     = now(),
        updated_at        = now()
  returning b.balance into v_balance;

  update public.tmmt_token_events set balance_after = v_balance where id = v_event_id;

  return jsonb_build_object('granted', true, 'balance', v_balance);
end;
$func$;

-- ── Atomic spend (the meter) ───────────────────────────────────────────────
create or replace function public.tmmt_token_spend(
  p_org  uuid,
  p_cost integer,
  p_job  text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_unlimited boolean;
  v_status    text;
  v_balance   integer;
begin
  if p_cost < 0 then
    raise exception 'tmmt_token_spend: cost must be non-negative';
  end if;

  select unlimited, status, balance into v_unlimited, v_status, v_balance
    from public.tmmt_token_balances where org_id = p_org;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'no_account', 'balance', 0);
  end if;
  if v_status <> 'active' then
    return jsonb_build_object('allowed', false, 'reason', 'suspended', 'balance', v_balance);
  end if;
  if v_unlimited then
    insert into public.tmmt_token_events (org_id, delta, reason, job_ref, balance_after)
      values (p_org, 0, 'spend_unlimited', p_job, v_balance);
    return jsonb_build_object('allowed', true, 'unlimited', true, 'balance', v_balance);
  end if;

  -- Atomic, race-safe: decrement only if enough tokens. No negative balance.
  update public.tmmt_token_balances
    set balance = balance - p_cost, updated_at = now()
    where org_id = p_org and balance >= p_cost
  returning balance into v_balance;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'insufficient',
      'balance', (select balance from public.tmmt_token_balances where org_id = p_org));
  end if;

  insert into public.tmmt_token_events (org_id, delta, reason, job_ref, balance_after)
    values (p_org, -p_cost, 'spend', p_job, v_balance);

  return jsonb_build_object('allowed', true, 'unlimited', false, 'balance', v_balance);
end;
$func$;

-- ── Lock the functions to the server only ──────────────────────────────────
revoke all on function public.tmmt_token_grant(uuid, integer, text, text, integer, text) from public;
revoke all on function public.tmmt_token_spend(uuid, integer, text) from public;
grant execute on function public.tmmt_token_grant(uuid, integer, text, text, integer, text) to service_role;
grant execute on function public.tmmt_token_spend(uuid, integer, text) to service_role;
