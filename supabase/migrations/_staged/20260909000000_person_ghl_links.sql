-- person_ghl_links — one person, many GHL sub-accounts (the TMMT wheel)
--
-- WHY: public.people.ghl_contact_id is a single column, and GHL sub-accounts are
-- siloed contact databases. A driver who rents AND buys detailing has two GHL
-- contacts in two locations. One column cannot hold two, so the wheel silently
-- degrades into a star with one working spoke.
--
-- ADDITIVE ON PURPOSE: people.ghl_contact_id is NOT dropped and NOT renamed.
-- It keeps meaning "the primary (Rentals) contact id", so all 47 existing code
-- references keep working unchanged. New multi-spoke code reads this table.
-- Callers migrate gradually.
--
-- STAGED — NOT APPLIED. Apply via the reviewed migration path, never `db push`.

create table if not exists public.person_ghl_links (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.people(id) on delete cascade,
  org_id          uuid references public.organizations(id) on delete set null,

  -- GHL sub-account this contact lives in.
  location_id     text not null,
  ghl_contact_id  text not null,

  -- Exactly one primary per person: the anchor relationship (normally Rentals).
  is_primary      boolean not null default false,

  -- Which business this link represents, for humans. Never parsed.
  label           text,

  status          text not null default 'active'
                    check (status in ('active', 'archived')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One contact per person per location: prevents duplicate contacts drifting apart.
create unique index if not exists person_ghl_links_person_location_uniq
  on public.person_ghl_links (person_id, location_id);

-- A given GHL contact belongs to exactly one person: prevents two people
-- claiming the same contact, which would merge two humans by accident.
create unique index if not exists person_ghl_links_location_contact_uniq
  on public.person_ghl_links (location_id, ghl_contact_id);

-- At most one primary per person.
create unique index if not exists person_ghl_links_one_primary
  on public.person_ghl_links (person_id)
  where is_primary;

create index if not exists person_ghl_links_person_idx   on public.person_ghl_links (person_id);
create index if not exists person_ghl_links_location_idx on public.person_ghl_links (location_id);

comment on table public.person_ghl_links is
  'One person, many GHL sub-accounts. The hub-and-spoke join for the TMMT wheel. '
  'people.ghl_contact_id remains the PRIMARY link for backward compatibility.';

-- Backfill: every existing people.ghl_contact_id becomes a primary link.
-- location_id is unknown for historical rows, so it is recorded as
-- ''unknown-legacy'' rather than guessed. Repair it when the owning location is
-- confirmed; guessing here would silently attach contacts to the wrong business.
insert into public.person_ghl_links (person_id, location_id, ghl_contact_id, is_primary, label)
select p.id, 'unknown-legacy', p.ghl_contact_id, true, 'backfilled from people.ghl_contact_id'
from public.people p
where p.ghl_contact_id is not null
  and length(trim(p.ghl_contact_id)) > 0
on conflict do nothing;
