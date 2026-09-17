-- ROLLBACK for 20260916230000_client_and_org_scoped_sensitive_access.sql
-- Captured verbatim from production (pg_get_functiondef) immediately BEFORE applying,
-- 2026-09-16, under prod baton. Restores the pre-change global-staff behaviour.
--
-- Running this REOPENS the leak it was applied to close: is_staff() carries no org
-- predicate, so any staff account reads every tenant's background checks. Use only to
-- recover from a regression, and re-apply the forward migration afterwards.
--
-- The other two functions (customer_payments_queue, client_bg_status) are NEW, so their
-- rollback is simply:
--   drop function if exists public.customer_payments_queue(text, integer);
--   drop function if exists public.client_bg_status(uuid);

CREATE OR REPLACE FUNCTION public.bg_check_queue(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, customer_name text, email_masked text, phone_last4 text, created_at timestamp with time zone, verification_form_submitted boolean, has_license boolean, has_insurance_proof boolean, has_paystub boolean, has_screenshot boolean, key_details text, eligibility_status text, review_notes text, date_verified date, reviewed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    b.id,
    b.customer_name,
    case when nullif(btrim(coalesce(b.email,'')),'') is null then null
         else left(b.email,1)||'***'||substring(b.email from position('@' in b.email)) end,
    right(regexp_replace(coalesce(b.phone_number,''), '\D', '', 'g'), 4),
    b.created_at,
    coalesce(b.verification_form_submitted, b.verificaton_form_submitted),
    b.driver_s_license            is not null or b.drivers_license_front_path is not null,
    b.proof_of_insurance          is not null,
    b.paystub                     is not null,
    b.background_check_screenshot is not null,
    b.key_details_extracted_from_screenshot,
    b.eligibility_status,
    b.review_notes,
    b.date_verified,
    b.reviewed_at
  from public.background_checks b
  where (public.is_staff() or public.is_platform_admin())
    and (p_status is null or b.eligibility_status is not distinct from p_status)
  order by b.created_at desc
  limit greatest(1, least(coalesce(p_limit,100), 500));
$function$;
