-- ============================================================================
-- S3-07 · ROLLBACK — restores the ORIGINAL compute_good_standing (verbatim,
-- captured from production 2026-09-07) and drops the standing view.
-- ============================================================================
begin;

create or replace function public.compute_good_standing(p_email text)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$ declare v_email text := lower(trim(p_email)); v_ok boolean := false; begin if v_email is null or v_email = '' then return false; end if; select exists (select 1 from public.bookings b where lower(b.customer_email) = v_email and b.status in ('confirmed', 'active')) into v_ok; if not v_ok then return false; end if; if exists (select 1 from public.rental_ledger rl where lower(rl.customer_email) = v_email and rl.entry_type = 'payment' and rl.status not in ('completed', 'cancelled') and rl.due_at is not null and rl.due_at < now()) then return false; end if; if exists (select 1 from public.client_renter_status crs where lower(crs.customer_email) = v_email and crs.canonical_stage in ('escalation', 'closed_lost')) then return false; end if; if exists (select 1 from public.cases c where lower(c.customer_email) = v_email and c.status = 'blocked') then return false; end if; return true; end; $function$;

drop view if exists public.v_customer_standing;

commit;
