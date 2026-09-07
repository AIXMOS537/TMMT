-- 20260907000000_people_organizations_STAGED.sql
-- STAGED — NOT APPLIED. Requires owner authorization to apply.
--
-- WHY MANY-TO-MANY (owner decision 2026-09-06)
--   A durable person may deal with several organizations over time. A single
--   people.org_id would forbid that and force a destructive choice later.
--
-- WHY NOT organizations.slug
--   people.tenant_slug is PROVENANCE (which public site a form arrived on),
--   not tenancy. It is retained unchanged. Organization membership is modelled
--   separately here. See src/lib/platform/tenant-org.ts.
--
-- ORG RESOLUTION ALREADY EXISTS — this migration does not invent it:
--   tier 1  orgIdForTenantSlug() / orgIdForHostStatic()  house brands, in-code
--           SLUG_TO_ORG maps 'aixmos' and 'tmmt_property' -> real org uuids
--   tier 2  public.org_id_for_host(text)                  everyone else,
--           via organization_domains (unique index on hostname guarantees
--           "a hostname resolves to exactly one org")
--
-- Conventions followed from this repo: `create ... if not exists`, uuid PK with
-- gen_random_uuid(), RLS enabled, policies via is_platform_admin()/is_org_member().

create table if not exists public.people_organizations (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.people(id)        on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  -- how this edge was established, so a wrong edge can be found and explained
  source     text,
  created_at timestamptz not null default now()
);

-- One edge per (person, org). Re-running the backfill must not duplicate.
create unique index if not exists people_organizations_person_org_key
  on public.people_organizations (person_id, org_id);

-- Query paths: "which orgs is this person in" and "which people in this org".
create index if not exists people_organizations_org_idx
  on public.people_organizations (org_id);

alter table public.people_organizations enable row level security;

create policy people_organizations_org_all on public.people_organizations
  for all to authenticated
  using      (public.is_platform_admin() or public.is_org_member(org_id))
  with check (public.is_platform_admin() or public.is_org_member(org_id));

comment on table public.people_organizations is
  'Durable person <-> organization membership. Many-to-many by design: one human may deal with several orgs. Distinct from people.tenant_slug, which records which public SITE a form arrived on (provenance), not tenancy.';
comment on column public.people_organizations.source is
  'How the edge was established: backfill_active_customers | backfill_incoming_leads | backfill_former_customers | form_intake | manual.';

-- ── BACKFILL — deterministic, idempotent, duplicate-safe ────────────────────
-- Only rows whose org is already known from an authoritative column. Nothing
-- is inferred from tenant_slug alone here; the house-brand map lives in code
-- and is applied at write time, not guessed in SQL.

-- active_customers already carries org_id
insert into public.people_organizations (person_id, org_id, source)
select p.id, a.org_id, 'backfill_active_customers'
from public.people p
join public.active_customers a on a.id = p.active_customer_id
where p.active_customer_id is not null and a.org_id is not null
on conflict (person_id, org_id) do nothing;

-- incoming_leads already carries org_id
insert into public.people_organizations (person_id, org_id, source)
select p.id, l.org_id, 'backfill_incoming_leads'
from public.people p
join public.incoming_leads l on l.id = p.incoming_lead_id
where p.incoming_lead_id is not null and l.org_id is not null
on conflict (person_id, org_id) do nothing;

-- ── OBSERVABILITY — run after backfill, before trusting it ──────────────────
-- select count(*) as edges,
--        count(distinct person_id) as people_with_org,
--        (select count(*) from public.people) as people_total,
--        (select count(*) from public.people p
--           where not exists (select 1 from public.people_organizations e
--                              where e.person_id = p.id)) as people_without_org
--   from public.people_organizations;
--
-- People with no edge are EXPECTED, not a failure: ghl_contacts-sourced rows
-- carry no org column. They are visible, countable, and must not be assigned
-- an arbitrary org.

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- drop table if exists public.people_organizations;
-- (people, tenant_slug and every existing table are untouched by this migration)
