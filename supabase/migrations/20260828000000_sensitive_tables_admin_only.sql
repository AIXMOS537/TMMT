-- Sensitive tables are admin-only, with a masked review queue for staff.
--
-- This records schema that is ALREADY LIVE on uapxakmlwnpfsftfeezx. It was applied
-- directly to the database on 2026-08-25 and never written down, so a fresh deploy
-- from this repo would have come up without it. Everything here is idempotent and
-- matches what production is running today.
--
-- Before: any internal_team / team_member account could read all background_checks,
-- customer_payments, documents and insurance rows. Now those four are admin-only at
-- the row level, and staff keep the background-check job through two RPCs that return
-- masked contact details and document-presence flags instead of the underlying
-- licence, paystub and insurance payloads.

-- ── who counts as a platform admin ────────────────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'admin'
  );
$$;

-- ── the four restricted tables ────────────────────────────────────────────────
alter table public.background_checks  enable row level security;
alter table public.customer_payments  enable row level security;
alter table public.documents          enable row level security;
alter table public.insurance          enable row level security;

drop policy if exists background_checks_admin_only on public.background_checks;
create policy background_checks_admin_only on public.background_checks
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists customer_payments_admin_only on public.customer_payments;
create policy customer_payments_admin_only on public.customer_payments
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists documents_admin_only on public.documents;
create policy documents_admin_only on public.documents
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists insurance_admin_only on public.insurance;
create policy insurance_admin_only on public.insurance
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- The public intake form still needs to file a background check. It writes only.
drop policy if exists anon_insert_bg_checks on public.background_checks;
create policy anon_insert_bg_checks on public.background_checks
  as permissive for insert to anon
  with check (true);

-- ── staff review queue (masked) ───────────────────────────────────────────────
-- Returns presence flags, a masked email and the last four phone digits. It never
-- returns the licence, paystub, insurance or screenshot payloads themselves.
create or replace function public.bg_check_queue(
  p_status text default null,
  p_limit  integer default 100
)
returns table (
  id uuid,
  customer_name text,
  email_masked text,
  phone_last4 text,
  created_at timestamptz,
  verification_form_submitted boolean,
  has_license boolean,
  has_insurance_proof boolean,
  has_paystub boolean,
  has_screenshot boolean,
  key_details text,
  eligibility_status text,
  review_notes text,
  date_verified date,
  reviewed_at timestamptz
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
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
$$;

-- ── staff verdict write-back ──────────────────────────────────────────────────
create or replace function public.bg_check_decide(
  p_id       uuid,
  p_decision text,
  p_notes    text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_prev text;
begin
  if v_uid is not null and not (public.is_staff() or public.is_platform_admin()) then
    raise exception 'bg_check_decide: staff or admin only' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in
     ('Eligible','Not Eligible','Need Manager''s Review','out of radius','Not found') then
    raise exception 'bg_check_decide: decision must be one of Eligible | Not Eligible | Need Manager''s Review | out of radius | Not found';
  end if;

  if length(coalesce(p_notes,'')) > 4000 then
    raise exception 'bg_check_decide: notes too long';
  end if;

  select eligibility_status into v_prev from public.background_checks where id = p_id;
  if not found then
    raise exception 'bg_check_decide: background check % not found', p_id;
  end if;

  update public.background_checks
     set eligibility_status = p_decision,
         review_notes       = coalesce(nullif(btrim(coalesce(p_notes,'')),''), review_notes),
         date_verified      = current_date,
         reviewed_by        = v_uid,
         reviewed_at        = now(),
         updated_at         = now()
   where id = p_id;

  return jsonb_build_object(
    'id', p_id, 'from', v_prev, 'to', p_decision, 'reviewed_at', now()
  );
end;
$$;

-- ── grants ────────────────────────────────────────────────────────────────────
-- Both review RPCs are SECURITY DEFINER over an admin-only table, so anon must not
-- hold EXECUTE. Signed-in staff and admins do; the functions gate on role themselves.
revoke all on function public.bg_check_queue(text, integer)        from public, anon;
revoke all on function public.bg_check_decide(uuid, text, text)    from public, anon;
grant execute on function public.bg_check_queue(text, integer)     to authenticated, service_role;
grant execute on function public.bg_check_decide(uuid, text, text) to authenticated, service_role;
grant execute on function public.is_platform_admin()               to authenticated, service_role;
