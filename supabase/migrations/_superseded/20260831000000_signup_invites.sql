-- Invite gate for self-serve account creation.
--
-- Public sign-up is open on tmmt-ops, so the ONLY thing standing between the
-- open internet and an auth user in this project is a valid invite code. The
-- contract this table has to hold up:
--
--   • the raw code is NEVER stored — only sha256(normalized code). Reading this
--     table (or a leaked backup) yields nothing a stranger can sign up with.
--   • one code, one account. The claim is a single conditional UPDATE, so two
--     racing requests cannot both win.
--   • codes expire. Default 14 days; an unused code is not a permanent key.
--   • a code may be locked to one email address.
--   • RLS on with NO policies + explicit revoke: anon and authenticated get
--     nothing at all. Only service_role (server-side sign-up path) may read or
--     write it.
--
-- If this table is missing, the sign-up action fails CLOSED — no table, no new
-- accounts. Do not "fix" that by relaxing it.
create table if not exists public.signup_invites (
  id          uuid primary key default gen_random_uuid(),
  code_hash   text not null unique,
  label       text,
  email       text,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  used_at     timestamptz,
  used_by     uuid,
  created_at  timestamptz not null default now(),
  created_by  text
);

comment on table public.signup_invites is
  'Single-use, expiring invite codes gating public sign-up. Stores sha256 of the code, never the code. service_role only.';
comment on column public.signup_invites.code_hash is
  'sha256 hex of the normalized (uppercased, non-alphanumerics stripped) code.';
comment on column public.signup_invites.email is
  'Optional lock — when set, only this email address may redeem the code.';

create index if not exists signup_invites_unused_idx
  on public.signup_invites (expires_at)
  where used_at is null;

alter table public.signup_invites enable row level security;

-- No policies on purpose. RLS with zero policies denies every non-service role.
revoke all on public.signup_invites from anon, authenticated;
