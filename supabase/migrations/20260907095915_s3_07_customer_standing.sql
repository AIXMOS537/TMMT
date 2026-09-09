-- Exported from production migration history (20260907095915).
-- Source of truth: supabase_migrations.schema_migrations.
-- Do not edit by hand — re-run scripts/migrations-pull.mjs instead.

-- S3-07 · CUSTOMER STANDING SOURCE OF TRUTH
-- Rehearsed locally 10/10 (PG16) on 2026-09-07. Rollback: S3-07_down.sql (restores original function verbatim).
-- Re-points compute_good_standing(p_email) from the never-fed bookings/rental_ledger model
-- to the live operational tables via v_customer_standing. Signature/qualifiers unchanged.

create or replace view public.v_customer_standing
with (security_invoker = true) as
with ac as (
  select
    a.id                                   as active_customer_id,
    a.org_id,
    lower(btrim(a.contact_email))          as customer_key,
    a.customer_name,
    right(regexp_replace(coalesce(a.contact_phone,''), '\D', '', 'g'), 10) as phone10,
    a.status,
    a.rental_start_date
  from public.active_customers a
  where coalesce(a.contact_email,'') <> ''
),
pay as (
  select
    lower(btrim(coalesce(nullif(p.customer_name,''), p.customer))) as name_key,
    right(regexp_replace(coalesce(p.customer_phone_number,''), '\D', '', 'g'), 10) as phone10,
    bool_or(
      p.payment_status ilike '%overdue%'
      or (p.next_payment_due_date is not null
          and p.next_payment_due_date < current_date
          and coalesce(p.payment_status,'') not ilike '%paid%')
    ) as any_overdue
  from public.customer_payments p
  group by 1, 2
),
pipe as (
  select lower(btrim(r.customer_email)) as customer_key,
         bool_or(r.canonical_stage::text in ('escalation','closed_lost')) as escalated
  from public.crm_sync_records r
  where r.sync_status = 'verified' and coalesce(r.customer_email,'') <> ''
  group by 1
),
blocked as (
  select lower(btrim(c.customer_email)) as customer_key, true as has_blocked
  from public.cases c
  where c.status = 'blocked' and coalesce(c.customer_email,'') <> ''
  group by 1
)
select
  ac.customer_key,
  ac.active_customer_id,
  ac.org_id,
  ac.rental_start_date,
  (ac.status = 'Active')                                     as has_active_relationship,
  coalesce(pay.any_overdue, false)                           as has_overdue_payment,
  coalesce(pipe.escalated, false)                            as is_escalated,
  coalesce(blocked.has_blocked, false)                       as has_blocked_case,
  (ac.status = 'Active'
     and not coalesce(pay.any_overdue, false)
     and not coalesce(pipe.escalated, false)
     and not coalesce(blocked.has_blocked, false))           as in_good_standing,
  'operational_v1'::text                                     as source_model
from ac
left join pay     on (pay.phone10 = ac.phone10 and length(ac.phone10) = 10)
                  or (pay.name_key = lower(btrim(ac.customer_name)))
left join pipe    on pipe.customer_key = ac.customer_key
left join blocked on blocked.customer_key = ac.customer_key;

comment on view public.v_customer_standing is
  'Business concept "customer standing" as four facts. source_model tells which operational tables back it. compute_good_standing() reads this view; change the view body, not the function, when the booking model goes live.';

grant select on public.v_customer_standing to authenticated;
revoke all on public.v_customer_standing from anon;

create or replace function public.compute_good_standing(p_email text)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(btrim(p_email));
  v_ok    boolean;
begin
  if v_email is null or v_email = '' then return false; end if;
  select bool_and(in_good_standing) into v_ok
    from public.v_customer_standing
   where customer_key = v_email;
  return coalesce(v_ok, false);
end;
$function$;

notify pgrst, 'reload schema';
