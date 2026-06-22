-- Lead Pool feed + PII masking for the operator UI (Phase 3). Additive.
-- Spec: docs/superpowers/plans/2026-06-22-lead-pool-operator-ui.md
--
-- mask_phone: reveal only the last 4 digits. lead_pool_feed: returns the pool rows
-- the CALLER may see, joined to safe lead fields — contact MASKED until claimed, so
-- operators can't harvest contact info before committing to a lead. Visibility reuses
-- lp_caller_org() so it can't leak across agencies or to siblings.

create or replace function public.mask_phone(p text)
returns text language sql immutable as $fn$
  select case
    when p is null or length(regexp_replace(p, '\D', '', 'g')) < 4 then '•••'
    else '(•••) •••-' || right(regexp_replace(p, '\D', '', 'g'), 4)
  end
$fn$;

create or replace function public.lead_pool_feed(p_scope text)
returns table (
  pool_id      bigint,
  lead_id      uuid,
  vertical     text,
  agency_org_id uuid,
  status       text,
  origin       text,
  created_at   timestamptz,
  claimed_at   timestamptz,
  contact_name text,
  phone        text,
  email        text,
  source       text,
  campaign     text
)
language plpgsql stable security definer set search_path = '' as $fn$
declare v_org uuid;
begin
  v_org := public.lp_caller_org();

  if p_scope = 'mine' then
    -- Leads this org has claimed/assigned (full contact). Staff see all worked leads.
    return query
      select lp.id, lp.lead_id, lp.vertical, lp.agency_org_id, lp.status, lp.origin,
             lp.created_at, lp.claimed_at,
             il.contact_name, il.phone_e164, il.email, il.source, il.source_campaign
      from public.lead_pool lp
      join public.incoming_leads il on il.id = lp.lead_id
      where lp.claimed_by_org_id = v_org
         or (public.is_staff() and lp.status in ('claimed', 'assigned'));
  else
    -- Available leads for the caller's agency (own org or parent). Contact MASKED.
    return query
      select lp.id, lp.lead_id, lp.vertical, lp.agency_org_id, lp.status, lp.origin,
             lp.created_at, lp.claimed_at,
             il.contact_name,
             public.mask_phone(il.phone_e164) as phone,
             null::text as email,
             il.source, il.source_campaign
      from public.lead_pool lp
      join public.incoming_leads il on il.id = lp.lead_id
      where lp.status = 'available'
        and ( public.is_staff()
              or lp.agency_org_id = v_org
              or lp.agency_org_id = (select parent_org_id from public.organizations where id = v_org) );
  end if;
end;
$fn$;

revoke all on function public.mask_phone(text) from public;
revoke all on function public.lead_pool_feed(text) from public;
grant execute on function public.mask_phone(text) to authenticated, service_role;
grant execute on function public.lead_pool_feed(text) to authenticated, service_role;
