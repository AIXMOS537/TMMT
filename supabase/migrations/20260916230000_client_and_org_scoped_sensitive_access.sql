-- Client self-service + org-scoped staff access to the two sensitive rental tables.
--
-- OWNER DECISIONS, 2026-09-16:
--   1. "A client can see their own background check once it comes back, and their
--      own payments they have made."            -> renter self-service, one record
--   2. "New org members get access to only their own information."
--                                               -> staff reads become org-scoped
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- It does not touch a single RLS policy. background_checks and customer_payments
-- stay admin-only at the row level exactly as 20260828000000 left them on
-- 2026-08-25. Widening those policies would reverse a deliberate hardening and
-- expose raw licences, paystubs and insurance payloads. Every grant below is a
-- narrow, masked, SECURITY DEFINER projection instead -- the established pattern.
--
-- VERIFIED READ-ONLY AGAINST PRODUCTION 2026-09-16 BEFORE WRITING:
--   background_checks  299 rows, 299 with org_id, 0 null   -> org scoping orphans nothing
--   customer_payments   31 rows,  31 with org_id, 0 null   -> same
--   profiles             3 rows: 2 role=admin, 1 role=customer, none internal_team
--     -> narrowing bg_check_queue removes access from nobody who has it today
--   reason_categories    8 seeded rows; 3 carry customer_msg = false

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. bg_check_queue becomes org-scoped.
--
-- Return signature is UNCHANGED, so src/lib/queries.ts:249 needs no edit. Only
-- the WHERE narrows: a platform admin still sees everything (that is how the
-- back office works today and two of three live users are platform admins), and
-- anyone else now sees only rows belonging to an org they are a member of.
--
-- Before: `where (is_staff() or is_platform_admin())` -- is_staff() carries no
-- org predicate, so ANY staff account read EVERY tenant's 299 checks.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bg_check_queue(
  p_status text default null,
  p_limit  integer default 100
)
returns table(
  id uuid, customer_name text, email_masked text, phone_last4 text,
  created_at timestamptz, verification_form_submitted boolean,
  has_license boolean, has_insurance_proof boolean, has_paystub boolean,
  has_screenshot boolean, key_details text, eligibility_status text,
  review_notes text, date_verified date, reviewed_at timestamptz
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
  where (public.is_platform_admin() or public.is_org_member(b.org_id))
    and (p_status is null or b.eligibility_status is not distinct from p_status)
  order by b.created_at desc
  limit greatest(1, least(coalesce(p_limit,100), 500));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. customer_payments gets its first masked read path, org-scoped from birth.
--
-- There has never been a masked route for this table at all. Staff answering
-- "did this renter pay" had to be a platform admin. This is the counterpart to
-- bg_check_queue: same shape, same scoping rule, no raw payload.
--
-- payment_method is reduced to its TYPE (the leading word) so "Cash App ****1234"
-- or "Visa 4111..." can never round-trip an account identifier through this RPC.
-- invoice_receipt_attachment is exposed only as a presence flag.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.customer_payments_queue(
  p_status text default null,
  p_limit  integer default 100
)
returns table(
  id uuid, customer_name text, phone_last4 text,
  amount numeric, payment_status text, payment_method_type text,
  last_payment_date date, next_payment_due_date date,
  amount_past_due text, payment_plan text,
  has_receipt boolean, vehicle_name text, created_at timestamptz
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    p.id,
    coalesce(nullif(btrim(coalesce(p.customer_name,'')),''), p.customer),
    right(regexp_replace(coalesce(p.customer_phone_number,''), '\D', '', 'g'), 4),
    p.amount,
    p.payment_status,
    nullif(split_part(btrim(coalesce(p.payment_method,'')), ' ', 1), ''),
    p.last_payment_date,
    p.next_payment_due_date,
    p.amout_past_due,          -- legacy misspelling, preserved: it is the live column
    p.payment_plan,
    p.invoice_receipt_attachment is not null,
    coalesce(nullif(btrim(coalesce(p.vehicle_name,'')),''), p.vehicle),
    p.created_at
  from public.customer_payments p
  where (public.is_platform_admin() or public.is_org_member(p.org_id))
    and (p_status is null or p.payment_status is not distinct from p_status)
  order by p.last_payment_date desc nulls last, p.created_at desc
  limit greatest(1, least(coalesce(p_limit,100), 500));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. client_bg_status -- the renter's own screening outcome. ONE record.
--
-- Identity: background_checks carries no user_id and no FK to auth.users, because
-- a renter has never had an account. The credential is the staff-minted expiring
-- license_upload_token already used by forms/license-upload-actions.ts. Same
-- trust boundary, same pattern, already in production.
--
-- "ONCE IT COMES BACK" is enforced: a row with no eligibility_status returns
-- status 'pending' and nothing else. No decision, no reason, no dates.
--
-- THE REASON GATE. reason_categories.customer_msg is already decided per category
-- and three of the eight are FALSE: DNC_DNR, FRAUD_SECURITY, OTHER. Returning a
-- reason from one of those would tell a renter they are on a do-not-rent list or
-- under a fraud escalation. The join below makes that structurally impossible --
-- an unmatched or non-customer-facing category yields NULL, never a leak.
--
-- NEVER RETURNED, at any status: background_check_screenshot (the screening
-- vendor's consumer report), key_details_extracted_from_screenshot (derived from
-- it), review_notes (internal staff deliberation), and the raw driver_s_license /
-- paystub / proof_of_insurance payloads.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.client_bg_status(p_token uuid)
returns table(
  status text,
  decided boolean,
  eligibility_status text,
  reason_label text,
  reason_description text,
  recoverable boolean,
  date_verified date,
  has_license boolean,
  has_insurance_proof boolean,
  has_paystub boolean,
  verification_form_submitted boolean
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    case when b.eligibility_status is null then 'pending' else 'decided' end,
    b.eligibility_status is not null,
    -- Nothing about the decision escapes until the decision exists.
    case when b.eligibility_status is null then null else b.eligibility_status end,
    case when b.eligibility_status is null then null
         when rc.customer_msg is true      then rc.label
         else null end,
    case when b.eligibility_status is null then null
         when rc.customer_msg is true      then rc.description
         else null end,
    case when b.eligibility_status is null then null
         when rc.customer_msg is true      then rc.recoverable
         else null end,
    case when b.eligibility_status is null then null else b.date_verified end,
    b.driver_s_license   is not null or b.drivers_license_front_path is not null,
    b.proof_of_insurance is not null,
    b.paystub            is not null,
    coalesce(b.verification_form_submitted, b.verificaton_form_submitted, false)
  from public.background_checks b
  left join public.reason_categories rc
    on rc.category = b.reason_code
  where b.license_upload_token = p_token
    and b.license_upload_token_expires_at > now()
  limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GRANTS -- least privilege.
--
-- The two staff queues are callable by signed-in users; the functions themselves
-- carry the org predicate, so a session with no org membership gets zero rows.
--
-- client_bg_status is NOT granted to anon or authenticated. The token is the
-- credential, and tokens do not belong in a browser-issued PostgREST call where
-- they would land in logs and Referer headers. It is reachable only through the
-- service-role server action, exactly like submitLicenseUpload today.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.bg_check_queue(text, integer)           from public, anon;
revoke all on function public.customer_payments_queue(text, integer)  from public, anon;
revoke all on function public.client_bg_status(uuid)                  from public, anon, authenticated;

grant execute on function public.bg_check_queue(text, integer)          to authenticated;
grant execute on function public.customer_payments_queue(text, integer) to authenticated;
grant execute on function public.client_bg_status(uuid)                 to service_role;

commit;
