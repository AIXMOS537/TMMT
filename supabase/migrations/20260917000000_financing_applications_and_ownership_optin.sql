-- Closing the Drive-to-Own loop: the opt-in that starts it, and the lender decision that ends it.
--
-- TWO GAPS THIS FILLS, both identified 2026-09-16:
--
-- 1. NOTHING RECORDS THAT A RENTER WANTS TO OWN. The 8-gate ladder exists and 35 renters
--    stand on it, but there is no moment where someone says "I'd like to own a car one day".
--    Without it the whole funnel is a report nobody opted into.
--
-- 2. NOTHING RECORDS A FINANCING APPLICATION OR ITS OUTCOME. The owner's rule is that a
--    renter owns the car only if and when a LENDER approves them. With no table for that,
--    `financingApproved` is permanently null and the ladder reads `pending` forever. This is
--    the single blocker on the loop closing.
--
-- TMMT IS NOT THE CREDITOR. Owner, 2026-09-16: the lease-to-own journey is "clients renting
-- until they can get approved for financing". This table records a THIRD PARTY's decision.
-- It must never accrue terms, rates, schedules or balances -- that would make TMMT a creditor
-- and pull in Reg Z / TILA / state lender licensing. Columns here are deliberately limited to
-- who was applied to, when, and what they said.

begin;

-- ── 1. The opt-in ────────────────────────────────────────────────────────────────────
-- A nullable timestamp, not a boolean: WHEN someone opted in is the useful fact, and null
-- is honestly "never opted in" rather than a default that pretends everyone did.
alter table public.client_journey
  add column if not exists ownership_opt_in_at timestamptz;

comment on column public.client_journey.ownership_opt_in_at is
  'When this renter opted in to the Drive-to-Own path. Null = never opted in. Renter-initiated only; staff must not set this on someone''s behalf.';

-- ── 2. The lender's decision ─────────────────────────────────────────────────────────
create table if not exists public.financing_applications (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  journey_id      uuid not null references public.client_journey(id) on delete cascade,

  lender_name     text not null,
  applied_at      timestamptz not null default now(),

  -- `pending` is the only sane default. Silence from a lender is never approval.
  outcome         text not null default 'pending'
                  check (outcome in ('pending','approved','declined','withdrawn','expired')),
  decided_at      timestamptz,

  -- Why a decline happened, in the renter-safe taxonomy already used for screening.
  -- Nullable because a lender often gives no reason, and inventing one would be worse.
  decline_reason_category text references public.reason_categories(category),

  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A decision must carry its date; an outcome without one is unauditable.
  constraint financing_decision_has_date
    check (outcome = 'pending' or decided_at is not null)
);

create index if not exists financing_applications_journey_idx
  on public.financing_applications (journey_id, applied_at desc);
create index if not exists financing_applications_org_idx
  on public.financing_applications (org_id);

-- ── 3. RLS — same shape as every other tenant table ──────────────────────────────────
alter table public.financing_applications enable row level security;

drop policy if exists financing_applications_org_scoped on public.financing_applications;
create policy financing_applications_org_scoped on public.financing_applications
  as permissive for all to authenticated
  using      (public.is_platform_admin() or public.is_org_member(org_id))
  with check (public.is_platform_admin() or public.is_org_member(org_id));

-- anon has no business here at all. RLS alone does not revoke a grant.
revoke all on public.financing_applications from anon;
grant select, insert, update on public.financing_applications to authenticated;

commit;
