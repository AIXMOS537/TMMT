-- Money Meter — ONE unified ledger for every dollar the platform touches.
--
-- OmniRouter-style: it tracks money in three directions across ANY and ALL
-- things AIXMOS/TMMT builds, buys, or bills —
--   'collected'  money IN     (sales, memberships, deposits, TMMT-token buys)
--   'used'       money OUT     (AI/LLM calls, SMS, subscriptions, ad spend, payouts)
--   'saved'      money AVOIDED (local inference vs cloud, negotiated discounts)
--
-- FREE FOREVER FOR THE OWNER + FAMILY. Their usage is still RECORDED so the
-- meter shows what it *would* cost (full visibility), but every 'used' event on
-- a free-forever org is stamped `billable = false`, so their net billable spend
-- is always $0. This is enforced in code (the record RPC below), not a comment.
--
-- Security posture (mirrors the TMMT token ledger, migration 20260619010000):
--   - RLS on; a caller reads ONLY their own org's rows (is_staff bypass).
--   - No write policies => only service_role (server) records events.
--   - money_meter_record is SECURITY DEFINER with a pinned search_path,
--     EXECUTE revoked from PUBLIC and granted to service_role only.
--   - Append-only; dedupe_key makes recording idempotent (webhook/retry safe).

-- ── Free-forever registry ────────────────────────────────────────────────────
-- An org listed here with free_forever = true is never billed. The owner's home
-- org is seeded below; the owner adds family/personal orgs the same way.
create table if not exists public.money_meter_accounts (
  org_id        uuid primary key references public.organizations(id) on delete cascade,
  free_forever  boolean     not null default false,
  label         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── The ledger (append-only) ─────────────────────────────────────────────────
-- org_id NULL = platform-level money (TMMT's own infra spend not tied to a tenant).
create table if not exists public.money_meter_events (
  id            bigint generated always as identity primary key,
  org_id        uuid          references public.organizations(id) on delete cascade,
  direction     text          not null check (direction in ('collected','used','saved')),
  category      text          not null,
  amount_usd    numeric(14,4) not null check (amount_usd >= 0),
  billable      boolean       not null default true,
  source        text,
  ref           text,
  dedupe_key    text          unique,
  meta          jsonb,
  occurred_at   timestamptz   not null default now(),
  created_at    timestamptz   not null default now()
);
create index if not exists money_meter_events_org_occurred_idx
  on public.money_meter_events (org_id, occurred_at desc);
create index if not exists money_meter_events_dir_cat_idx
  on public.money_meter_events (direction, category);

-- ── RLS: read own org only (staff bypass); no client writes ───────────────────
alter table public.money_meter_accounts enable row level security;
alter table public.money_meter_events   enable row level security;

drop policy if exists money_meter_accounts_read_own on public.money_meter_accounts;
create policy money_meter_accounts_read_own on public.money_meter_accounts
  for select using (public.is_staff() or public.is_org_member(org_id));

drop policy if exists money_meter_events_read_own on public.money_meter_events;
create policy money_meter_events_read_own on public.money_meter_events
  for select using (
    public.is_staff()
    or (org_id is not null and public.is_org_member(org_id))
  );
-- Platform-level rows (org_id is null) are staff-only by omission above.

-- ── Idempotent record (the meter's only writer) ──────────────────────────────
create or replace function public.money_meter_record(
  p_org       uuid,
  p_direction text,
  p_category  text,
  p_amount    numeric,
  p_source    text  default null,
  p_ref       text  default null,
  p_dedupe    text  default null,
  p_meta      jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_billable boolean := true;
  v_free     boolean := false;
  v_id       bigint;
begin
  if p_direction not in ('collected','used','saved') then
    raise exception 'money_meter_record: invalid direction %', p_direction;
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'money_meter_record: amount must be non-negative';
  end if;

  -- Free-forever orgs are never billed for what they USE. Money they collect or
  -- savings they generate are still real, so only 'used' flips to non-billable.
  if p_org is not null then
    select free_forever into v_free from public.money_meter_accounts where org_id = p_org;
    if coalesce(v_free, false) and p_direction = 'used' then
      v_billable := false;
    end if;
  end if;

  insert into public.money_meter_events
      (org_id, direction, category, amount_usd, billable, source, ref, dedupe_key, meta)
    values (p_org, p_direction, p_category, p_amount, v_billable, p_source, p_ref, p_dedupe, p_meta)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  -- Duplicate delivery (same dedupe_key) → no second row; report it as a no-op.
  if p_dedupe is not null and v_id is null then
    return jsonb_build_object('recorded', false, 'reason', 'duplicate');
  end if;

  return jsonb_build_object('recorded', true, 'id', v_id, 'billable', v_billable);
end;
$func$;

-- ── Lock the writer to the server only ───────────────────────────────────────
revoke all on function public.money_meter_record(uuid, text, text, numeric, text, text, text, jsonb) from public;
grant execute on function public.money_meter_record(uuid, text, text, numeric, text, text, text, jsonb) to service_role;

-- ── Seed: OWNER = free forever ───────────────────────────────────────────────
-- TMMT_RENTALS_HOME_ORG_ID (src/lib/verticals/registry.ts). Family/personal orgs
-- are added the same way: insert here with free_forever = true, and flip their
-- token balance to unlimited (below).
insert into public.money_meter_accounts (org_id, free_forever, label)
  values ('8e651b25-e7c8-4356-af64-1716a82053b0', true, 'Owner — TMMT home org (free forever)')
on conflict (org_id) do update set free_forever = true, updated_at = now();

-- Wire the long-designed-but-never-set owner bypass on the TMMT token ledger:
-- the owner's org is `unlimited` and never metered in TMMT tokens either.
insert into public.tmmt_token_balances (org_id, balance, monthly_allotment, plan_tier, unlimited, status)
  values ('8e651b25-e7c8-4356-af64-1716a82053b0', 0, 0, 'owner', true, 'active')
on conflict (org_id) do update set unlimited = true, plan_tier = 'owner', updated_at = now();
