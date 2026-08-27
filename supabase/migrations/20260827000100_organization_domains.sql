-- One multi-tenant app, one deploy, each operator on their own domain.
--
-- A table rather than a column on organizations, because an org realistically
-- carries several hostnames at once: the apex, www, a staging host, and the
-- legacy name it used before it moved. A single column forces a choice between
-- them and breaks the moment someone visits the other one.
create table if not exists public.organization_domains (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  hostname    text not null,
  is_primary  boolean not null default false,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint organization_domains_hostname_lower
    check (hostname = lower(hostname) and hostname not like '%:%' and hostname <> '')
);

-- A hostname resolves to exactly one org. This is the whole safety property of
-- host-based tenancy: without it two orgs could claim one domain, and which
-- tenant a visitor lands in becomes a race.
create unique index if not exists organization_domains_hostname_key
  on public.organization_domains (hostname);
create index if not exists organization_domains_org_idx
  on public.organization_domains (org_id);
create unique index if not exists organization_domains_one_primary
  on public.organization_domains (org_id) where is_primary;

alter table public.organization_domains enable row level security;

create policy organization_domains_org_all on public.organization_domains
  for all to authenticated
  using      (public.is_platform_admin() or public.is_org_member(org_id))
  with check (public.is_platform_admin() or public.is_org_member(org_id));

-- Resolution runs BEFORE anyone is authenticated: a visitor arriving at an
-- operator's domain has no session yet. SECURITY DEFINER so it reads past RLS,
-- returning only the org id - no branding, nothing that would let an
-- unauthenticated caller enumerate tenants.
create or replace function public.org_id_for_host(p_host text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select d.org_id
  from public.organization_domains d
  where d.hostname = lower(split_part(coalesce(p_host, ''), ':', 1))
    and d.verified_at is not null
  limit 1;
$function$;

comment on function public.org_id_for_host(text) is
  'Hostname -> org id for host-based tenancy. Verified domains only; an unverified row is a claim, not a grant.';

revoke execute on function public.org_id_for_host(text) from public;
grant execute on function public.org_id_for_host(text) to anon, authenticated, service_role;

-- Seed what is already true. ops.allinonemanagementsolutions.com is the host
-- site-domains.ts actually names; left unverified because its DNS record does
-- not exist yet, which is exactly what verified_at exists to express.
insert into public.organization_domains (org_id, hostname, is_primary, verified_at)
values
  ('8e651b25-e7c8-4356-af64-1716a82053b0', 'ops.allinonemanagementsolutions.com', true, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'allinonemanagementsolutions.com',     true, null)
on conflict (hostname) do nothing;
