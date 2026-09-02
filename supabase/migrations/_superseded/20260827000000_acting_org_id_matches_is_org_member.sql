-- acting_org_id() and is_org_member() disagreed about what membership means.
--
-- is_org_member() was widened (20260825_fix_org_isolation, then tightened by
-- org_member_fallback_internal_roles_only) to accept EITHER an org_roles row OR
-- profiles.organization_id for an internal role. acting_org_id() was never
-- updated and still read org_roles alone.
--
-- That asymmetry is a write-path outage for anyone whose membership comes from
-- profiles. They can READ their org's rows, because the RLS USING clause calls
-- is_org_member(). Their INSERTs take the column default
-- coalesce(acting_org_id(), <TMMT house org>); acting_org_id() returns null, so
-- the row is stamped with TMMT's org, and the policy's WITH CHECK then calls
-- is_org_member(TMMT) for a user who is not a TMMT member and rejects it.
--
-- It fails closed, so nothing leaked. But it meant operator number two could
-- read and could not create, which is the whole job.
create or replace function public.acting_org_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (
      select r.org_id
      from public.org_roles r
      where r.user_id = auth.uid()
      order by (r.org_id = '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid) asc
      limit 1
    ),
    (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id is not null
        and p.role::text in ('admin', 'internal_team')
    )
  );
$function$;

comment on function public.acting_org_id() is
  'The org a write belongs to. Mirrors is_org_member(): org_roles first, then profiles.organization_id for internal roles. The two must never disagree.';
