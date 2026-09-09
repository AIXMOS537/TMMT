-- ===========================================================================
-- TRIAGED 2026-09-09: NOT APPLIED - correct, but premature.
--
-- The migration is sound and its FK targets exist in production
-- (public.organizations and vault.secrets both present, table absent). But NO
-- application code references org_ghl_connections - checked across src/ and
-- scripts/. Applying it now puts an unused table with a vault FK on production
-- ahead of the code that gives it meaning, which is the schema-ahead-of-code
-- pattern that produced the orphan-branch problems already in this repo.
--
-- Apply it in the SAME change that introduces the code that reads it.
-- ===========================================================================

-- Per-organization GoHighLevel connections.
--
-- Until now the GHL location came from env vars alone — GHL_LOCATION_ID and
-- GHL_RESTORATION_LOCATION_ID — so every org shared one location. The live data
-- confirms it: all 1,637 rows in ghl_contacts carry the single location
-- 'Xcd8DZt5T4GWnBtBEC5V'.
--
-- Two DIFFERENT relationships have to be supported, and conflating them is the
-- mistake this table exists to prevent:
--
--   'subaccount'      A location inside OUR agency. We hold the token; the
--                     operator is a tenant of ours. Auth uses the server's
--                     GHL_API_KEY, so no credential is stored here.
--
--   'foreign_agency'  The operator owns their OWN GHL agency (Khan Strategies
--                     does). We are a guest in their account, not their
--                     landlord. Their credential is theirs, is stored in Vault
--                     rather than in a column, and can be revoked by them at any
--                     time without touching anyone else's connection.
--
-- Keeping both in one table with an explicit mode means code can never
-- accidentally send our agency token at a foreign location, or vice versa.

create table if not exists public.org_ghl_connections (
  org_id                uuid primary key references public.organizations(id) on delete cascade,

  -- GHL location (sub-account) id this org's contacts live in.
  location_id           text not null,

  mode                  text not null
                          check (mode in ('subaccount', 'foreign_agency')),

  -- Vault secret holding the operator's own API credential. Required for
  -- foreign_agency, and forbidden otherwise — a subaccount must not carry a
  -- second credential that could drift from the server token.
  credential_secret_id  uuid references vault.secrets(id) on delete set null,

  status                text not null default 'active'
                          check (status in ('active', 'paused', 'revoked')),

  -- Free-text label for the humans: "TMMT Rentals (main)", "Khan Strategies —
  -- their agency". Never parsed.
  label                 text,

  connected_at          timestamptz not null default now(),
  revoked_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint org_ghl_credential_matches_mode check (
    (mode = 'foreign_agency' and credential_secret_id is not null)
    or (mode = 'subaccount'  and credential_secret_id is null)
  ),

  constraint org_ghl_revoked_has_timestamp check (
    (status = 'revoked') = (revoked_at is not null)
  )
);

-- One org per location. Two orgs pointing at the same GHL location would make
-- every contact ambiguous and let one operator's rotation write into another's
-- pipeline.
create unique index if not exists org_ghl_connections_location_uniq
  on public.org_ghl_connections (location_id);

create index if not exists org_ghl_connections_status_idx
  on public.org_ghl_connections (status) where status = 'active';

comment on table public.org_ghl_connections is
  'Which GHL location each org sends to, and whose credential authorizes it. See mode.';

-- ── Row level security ──────────────────────────────────────────────
-- Staff only, read AND write. Deliberately NOT is_org_member(): this table
-- names credential material, and an operator has no reason to read even their
-- own secret id — the server resolves it on their behalf. Widening this to org
-- members would hand every tenant_admin a pointer to a Vault secret.
alter table public.org_ghl_connections enable row level security;

drop policy if exists org_ghl_connections_staff_only on public.org_ghl_connections;
create policy org_ghl_connections_staff_only
  on public.org_ghl_connections
  for all
  using (public.is_staff())
  with check (public.is_staff());

create trigger org_ghl_connections_set_updated_at
  before update on public.org_ghl_connections
  for each row execute function public.set_updated_at();

-- ── Resolver ────────────────────────────────────────────────────────
-- Returns the active location for an org, or NULL. NULL means "fall back to the
-- env default" and is a normal answer, not an error — most orgs have no
-- connection of their own yet.
--
-- SECURITY DEFINER so server code can resolve a location while acting as the
-- operator, without granting that operator read access to the table itself.
-- It returns ONLY the location id and mode — never the credential id.
create or replace function public.org_ghl_location(p_org_id uuid)
returns table (location_id text, mode text)
language sql
stable
security definer
set search_path = public
as $$
  select c.location_id, c.mode
  from public.org_ghl_connections c
  where c.org_id = p_org_id
    and c.status = 'active'
$$;

revoke all on function public.org_ghl_location(uuid) from public;
grant execute on function public.org_ghl_location(uuid) to authenticated, service_role;

comment on function public.org_ghl_location(uuid) is
  'Active GHL location + mode for an org, or no row. Never returns credential ids.';
