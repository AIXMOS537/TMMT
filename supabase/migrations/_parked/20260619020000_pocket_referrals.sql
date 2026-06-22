-- AIXMOS Pocket — referral codes + earnings (the "earn" half of learn-earn-churn).
--
-- PROTECTIVE STRUCTURE (owner = PROJECT X HAILMARY):
--   - SINGLE-TIER only (no recruiting-on-recruiting / no MLM depth).
--   - Commission is recorded ONLY on COLLECTED sales (status='collected'); a
--     refund/chargeback writes a compensating 'clawed_back' row.
--   - These are internal earnings records — NOT a security, NOT crypto.
--
-- Security posture (matches tmmt_token_ledger + the rest of this DB):
--   - RLS on; a member reads ONLY their own code + their own earnings.
--     public.is_staff() bypasses for the owner/admin.
--   - No write policies => only service_role (server) writes. Attribution and
--     payouts are computed server-side off recorded payments.

-- ── Codes: one referral code per member ─────────────────────────────────────
create table if not exists public.pocket_referral_codes (
  code           text        primary key,
  owner_email    text        not null,
  owner_user_id  uuid,
  created_at     timestamptz not null default now()
);
create unique index if not exists pocket_referral_codes_email_idx
  on public.pocket_referral_codes (lower(owner_email));

-- ── Earnings: append-only, idempotent on payment_ref ────────────────────────
create table if not exists public.pocket_referral_earnings (
  id             bigint generated always as identity primary key,
  code           text        not null references public.pocket_referral_codes(code) on delete cascade,
  referred_email text,
  sale_amount    numeric(12,2) not null default 0 check (sale_amount >= 0),
  commission     numeric(12,2) not null default 0 check (commission >= 0),
  status         text        not null default 'collected'
                   check (status in ('collected','clawed_back')),
  payment_ref    text        unique,
  created_at     timestamptz not null default now()
);
create index if not exists pocket_referral_earnings_code_idx
  on public.pocket_referral_earnings (code, created_at desc);

-- ── RLS: read own only; no client writes ────────────────────────────────────
alter table public.pocket_referral_codes    enable row level security;
alter table public.pocket_referral_earnings enable row level security;

drop policy if exists pocket_codes_read_own on public.pocket_referral_codes;
create policy pocket_codes_read_own on public.pocket_referral_codes
  for select using (public.is_staff() or owner_user_id = auth.uid());

drop policy if exists pocket_earnings_read_own on public.pocket_referral_earnings;
create policy pocket_earnings_read_own on public.pocket_referral_earnings
  for select using (
    public.is_staff()
    or code in (
      select code from public.pocket_referral_codes where owner_user_id = auth.uid()
    )
  );
