-- ============================================================================
-- S3-07 · CUSTOMER STANDING SOURCE OF TRUTH
-- Package: S3-07  |  Gate: DESIGN → READY (prepared, NOT applied)
-- Target: Supabase project uapxakmlwnpfsftfeezx, schema public, PostgreSQL 17.6
-- Suggested filename: supabase/migrations/<version>_s3_07_customer_standing.sql
--
-- WHAT THIS DOES
--   * Introduces public.v_customer_standing — the business concept "customer
--     standing" expressed as four facts, implemented today over the VERIFIED live
--     operational tables (active_customers, customer_payments, crm_sync_records,
--     cases). When the booking model goes live, only this view's body changes.
--   * Minimally re-points compute_good_standing(p_email) to read the view.
--     Signature, volatility (STABLE), SECURITY DEFINER, search_path: unchanged.
--   * Does NOT touch compute_lto_eligible(), recompute_journey(), client_journey,
--     journey_checkpoints, or bookings/rental_ledger.
--   * Does NOT schedule anything. The nightly recompute is a SEPARATE file
--     (S3-07b_cron.sql) requiring its own authorization, because scheduling is
--     behavior.
--
-- SEMANTICS PRESERVED FROM THE ORIGINAL FUNCTION (four facts, same polarity):
--   1. has an active rental relationship        (was: bookings.status in confirmed/active)
--   2. has NO overdue payment                    (was: rental_ledger payment past due_at)
--   3. pipeline stage is NOT escalation/closed   (was: client_renter_status)
--   4. has NO blocked case                       (was: cases.status = 'blocked')
--
-- KNOWN DATA-QUALITY CAVEAT (flagged, not fixed here): 26 of 31 customer_payments
--   rows carry payment_status = 'Overdue' because the daily sweep marks due≤today
--   and nothing marks Paid. Until S3-08 unifies the ledger, most active customers
--   will read as NOT in good standing. That is the truth of the data as it stands;
--   this package does not paper over it.
--
-- TRANSACTION: no begin/commit here (tooling wraps). Raw psql: --single-transaction.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The standing view
-- ----------------------------------------------------------------------------
create or replace view public.v_customer_standing
with (security_invoker = true) as
with ac as (
  select
    a.id                                   as active_customer_id,
    a.org_id,
    lower(btrim(a.contact_email))          as customer_key,        -- canonical key today: email
    a.customer_name,
    right(regexp_replace(coalesce(a.contact_phone,''), '\D', '', 'g'), 10) as phone10,
    a.status,
    a.rental_start_date
  from public.active_customers a
  where coalesce(a.contact_email,'') <> ''
),
pay as (
  -- mirrors v_collections_truth's notion of "overdue" without depending on it
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

-- ----------------------------------------------------------------------------
-- 2. Minimal re-point of compute_good_standing (same signature, same qualifiers)
-- ----------------------------------------------------------------------------
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
  -- One customer_key can appear more than once only if active_customers holds
  -- duplicate emails; require EVERY row to be in good standing (conservative).
  select bool_and(in_good_standing) into v_ok
    from public.v_customer_standing
   where customer_key = v_email;
  return coalesce(v_ok, false);   -- no row => not in standing (matches original: no booking => false)
end;
$function$;

-- grants unchanged from production (definer, callable by authenticated/service_role);
-- no GRANT statement here so existing privileges are preserved by CREATE OR REPLACE.

notify pgrst, 'reload schema';
