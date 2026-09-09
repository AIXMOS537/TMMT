-- ============================================================================
-- S3-03 · DECISION CONTRACT  (reason categories, reason codes, decision events)
-- Package: S3-03  |  Gate: DESIGN → READY (prepared, NOT applied)
-- Target: Supabase project uapxakmlwnpfsftfeezx, schema public, PostgreSQL 17.6
-- Suggested filename: supabase/migrations/<version>_s3_03_decision_contract.sql
--   (<version> must be assigned by the repo's migration convention; see the
--    2026-09-05 commit about duplicate version prefixes.)
--
-- PRINCIPLES
--   * Additive only. No DROP of any pre-existing object except the replaced
--     function signature of bg_check_decide (its body is preserved in down.sql).
--   * reason_codes is created EMPTY. Business-policy values are NOT seeded.
--     Until the owner confirms the taxonomy, bg_check_decide accepts a null
--     reason (fail-safe), records the free-text explanation, and marks the
--     event rule_version = 'pre-taxonomy'.
--   * reason_categories seeds the eight ARCHITECTURAL categories named in the
--     Stage 3 authorization (not business criteria).
--   * decision_events references the existing canonical person model
--     (public.people) and the existing decision primitive (background_checks).
--   * Snapshot excludes names, phones, emails, attachments.
--
-- TRANSACTION: this file contains NO begin/commit. `supabase db push` and the
--   Supabase apply_migration mechanism each wrap a migration in one transaction;
--   an inner BEGIN would only emit a warning. For raw psql use:
--     psql --single-transaction -v ON_ERROR_STOP=1 -f <this file>
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Reason categories (architectural, fixed)
-- ----------------------------------------------------------------------------
create table if not exists public.reason_categories (
  category      text primary key,
  label         text not null,
  recoverable   boolean not null,          -- can this category ever re-enter eligibility?
  customer_msg  boolean not null,          -- does this category normally produce a customer-facing message?
  sort_order    smallint not null,
  description   text
);

insert into public.reason_categories (category, label, recoverable, customer_msg, sort_order, description) values
  ('DOCUMENT_ADMIN',    'Document / administrative deficiency', true,  true,  10, 'Missing, invalid, or incomplete documentation or application data. Remediable now by the customer or staff.'),
  ('MANUAL_REVIEW',     'Manual review',                        true,  true,  20, 'Requires a human decision before any routing.'),
  ('CREDIT_FINANCIAL',  'Credit / financial remediation',       true,  true,  30, 'Remediable over time through an approved financial or credit pathway, subject to customer authorization.'),
  ('TEMPORARY_PROGRAM', 'Temporary program ineligibility',      true,  true,  40, 'Program prerequisite or waiting period not yet satisfied.'),
  ('RISK_POLICY',       'Risk / policy decline',                false, true,  50, 'Declined under established business policy. Owner override only.'),
  ('DNC_DNR',           'Do-not-contact / do-not-rent',         false, false, 60, 'Hard control. Stops outbound and recovery routing.'),
  ('FRAUD_SECURITY',    'Fraud / security escalation',          false, false, 70, 'Confirmed misrepresentation or security concern. Terminal; owner review.'),
  ('OTHER',             'Other approved category',              true,  false, 90, 'Reserved for owner-approved reasons that fit no category above.')
on conflict (category) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Reason codes (EMPTY until the owner confirms the taxonomy)
-- ----------------------------------------------------------------------------
create table if not exists public.reason_codes (
  code                 text primary key,
  category             text not null references public.reason_categories(category),
  label                text not null,
  description          text,
  remediable_by        text not null check (remediable_by in ('customer','staff','time','none')),
  default_requal_days  integer check (default_requal_days is null or default_requal_days >= 0),
  active               boolean not null default true,
  policy_ref           text,                       -- pointer to the owner/counsel decision that approved this code
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists reason_codes_category_idx on public.reason_codes(category) where active;

-- ----------------------------------------------------------------------------
-- 3. Decision events — the canonical qualification-decision contract
--    WHO · WHAT · DECISION · REASON · EXPLANATION · SOURCE · VERSION ·
--    TIMESTAMP · ACTOR · NEXT DESTINATION
-- ----------------------------------------------------------------------------
create table if not exists public.decision_events (
  id                   uuid primary key default gen_random_uuid(),
  seq                  bigint generated always as identity,          -- stable ordering inside one transaction
  org_id               uuid references public.organizations(id),
  -- WHO (canonical person first; concrete records second)
  person_id            uuid references public.people(id),
  background_check_id  uuid references public.background_checks(id),
  lead_id              uuid references public.incoming_leads(id),
  -- WHAT was evaluated
  product_program      text references public.programs(slug),   -- null = generic rental screening
  -- DECISION (mirrors the existing 5 eligibility states + Pending)
  decision             text not null check (decision in
                         ('Eligible','Not Eligible','Need Manager''s Review','out of radius','Not found','Pending')),
  -- REASON + EXPLANATION
  reason_code          text references public.reason_codes(code),
  explanation          text,
  -- SOURCE + VERSION
  source               text not null check (source in
                         ('bg_check','requalification','doc_received','checkpoint','window','staff','product_stepdown','backfill','system')),
  rule_version         text not null default 'pre-taxonomy',
  -- ACTOR
  actor_kind           text not null check (actor_kind in ('system','staff','process')),
  actor_id             uuid,                                       -- profiles.id when staff
  -- NEXT DESTINATION (written by the router in S3-04; null until then)
  next_destination     text,
  routed_at            timestamptz,
  -- Evidence + idempotency
  inputs_snapshot      jsonb not null default '{}'::jsonb,
  dedupe_key           text,
  created_at           timestamptz not null default now(),
  constraint decision_events_subject_chk check (background_check_id is not null or lead_id is not null or person_id is not null),
  constraint decision_events_dedupe_key_key unique (dedupe_key)
);
create unique index if not exists decision_events_seq_key on public.decision_events(seq);
create index if not exists decision_events_bg_idx      on public.decision_events(background_check_id, seq desc);
create index if not exists decision_events_person_idx  on public.decision_events(person_id, created_at desc);
create index if not exists decision_events_lead_idx    on public.decision_events(lead_id, created_at desc);
create index if not exists decision_events_unrouted_idx on public.decision_events(created_at) where routed_at is null;

comment on table public.decision_events is
  'Canonical qualification-decision event. One row per evaluation. Append-only; never update decision/reason after insert. Router (S3-04) fills next_destination/routed_at.';

-- ----------------------------------------------------------------------------
-- 4. Extend background_checks (additive, nullable)
-- ----------------------------------------------------------------------------
alter table public.background_checks
  add column if not exists reason_code            text references public.reason_codes(code),
  add column if not exists last_decision_event_id uuid references public.decision_events(id),
  add column if not exists lead_id                uuid references public.incoming_leads(id),
  add column if not exists lead_match_method      text check (lead_match_method is null or lead_match_method in ('exact_email','exact_phone','manual','fk'));

create index if not exists background_checks_lead_id_idx on public.background_checks(lead_id) where lead_id is not null;

-- ----------------------------------------------------------------------------
-- 5. Row-level security
--    decision_events: staff/admin read; writes ONLY through definer functions.
--    reason_* : staff read; admin write.
-- ----------------------------------------------------------------------------
alter table public.reason_categories enable row level security;
alter table public.reason_codes      enable row level security;
alter table public.decision_events   enable row level security;

drop policy if exists reason_categories_read on public.reason_categories;
create policy reason_categories_read on public.reason_categories for select to authenticated
  using (public.is_staff() or public.is_platform_admin());
drop policy if exists reason_categories_admin on public.reason_categories;
create policy reason_categories_admin on public.reason_categories for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists reason_codes_read on public.reason_codes;
create policy reason_codes_read on public.reason_codes for select to authenticated
  using (public.is_staff() or public.is_platform_admin());
drop policy if exists reason_codes_admin on public.reason_codes;
create policy reason_codes_admin on public.reason_codes for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists decision_events_read on public.decision_events;
create policy decision_events_read on public.decision_events for select to authenticated
  using ((public.is_staff() or public.is_platform_admin())
         and (org_id is null or public.is_org_member(org_id) or public.is_platform_admin()));
-- No insert/update/delete policy for authenticated: writes go through SECURITY DEFINER RPCs only.

revoke all on public.decision_events from anon;
revoke all on public.reason_codes from anon;
revoke all on public.reason_categories from anon;
grant select on public.reason_categories, public.reason_codes, public.decision_events to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Helper: resolve canonical person for a check (read-only; never creates)
-- ----------------------------------------------------------------------------
create or replace function public.resolve_person_id(p_email text, p_phone text)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  with cand as (
    select p.id,
           case when p_email is not null and lower(p.email) = lower(btrim(p_email)) then 1 else 2 end as rank
      from public.people p
     where (p_email is not null and lower(p.email) = lower(btrim(p_email)))
        or (p.phone_digits is not null
            and length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 10
            and right(p.phone_digits, 10) = right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10))
  )
  select id from cand order by rank limit 1;
$$;
revoke all on function public.resolve_person_id(text, text) from public, anon;
grant execute on function public.resolve_person_id(text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Core: record_decision_event  (single write path; called by bg_check_decide)
-- ----------------------------------------------------------------------------
create or replace function public.record_decision_event(
  p_background_check_id uuid,
  p_decision            text,
  p_reason_code         text default null,
  p_explanation         text default null,
  p_source              text default 'bg_check',
  p_actor_kind          text default 'staff',
  p_actor_id            uuid default null,
  p_product_program     text default null,
  p_dedupe_key          text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bc        public.background_checks%rowtype;
  v_event_id  uuid;
  v_person    uuid;
  v_lead      uuid;
  v_lead_how  text;
  v_codes     boolean;
  v_version   text;
  v_snapshot  jsonb;
begin
  -- Idempotency: same dedupe_key => return the existing event, do nothing else.
  if p_dedupe_key is not null then
    select id into v_event_id from public.decision_events where dedupe_key = p_dedupe_key;
    if v_event_id is not null then return v_event_id; end if;
  end if;

  select * into v_bc from public.background_checks where id = p_background_check_id;
  if not found then
    raise exception 'record_decision_event: background check % not found', p_background_check_id;
  end if;

  -- Reason discipline (fail-safe until the taxonomy is confirmed):
  --   * codes table empty  -> null reason allowed on every decision, rule_version 'pre-taxonomy'
  --   * codes table seeded -> non-Eligible decisions MUST carry an active code
  select exists (select 1 from public.reason_codes where active) into v_codes;
  if p_reason_code is not null then
    if not exists (select 1 from public.reason_codes where code = p_reason_code and active) then
      raise exception 'record_decision_event: reason_code % is not an active reason code', p_reason_code;
    end if;
    if p_decision = 'Eligible' then
      raise exception 'record_decision_event: an Eligible decision must not carry a reason code';
    end if;
  elsif v_codes and p_decision = 'Not Eligible' then
    -- Only a hard decline requires a structured reason. Review / pending / radius / not-found
    -- are states whose meaning IS the reason; a code may be added but is not forced, so the
    -- original 3-argument callers keep working after the taxonomy is seeded.
    raise exception 'record_decision_event: reason_code is required for decision % once the taxonomy is active', p_decision
      using hint = 'Pick an active code from public.reason_codes';
  end if;
  v_version := case when v_codes then 'taxonomy-v1' else 'pre-taxonomy' end;

  -- WHO: canonical person (never created here) and best-effort lead link.
  v_person := coalesce(
    (select d.person_id from public.decision_events d where d.background_check_id = p_background_check_id and d.person_id is not null order by d.seq desc limit 1),
    public.resolve_person_id(v_bc.email, v_bc.phone_number)
  );

  if v_bc.lead_id is not null then
    v_lead := v_bc.lead_id; v_lead_how := 'fk';
  else
    -- exactly-one-match rule: ambiguous matches are left null for a human.
    select l.id into v_lead from public.incoming_leads l
     where v_bc.email is not null and lower(l.email) = lower(btrim(v_bc.email));
    if found then
      if (select count(*) from public.incoming_leads l where lower(l.email) = lower(btrim(v_bc.email))) = 1 then
        v_lead_how := 'exact_email';
      else v_lead := null; end if;
    end if;
    if v_lead is null and length(regexp_replace(coalesce(v_bc.phone_number,''), '\D','','g')) >= 10 then
      select l.id into v_lead from public.incoming_leads l
       where right(regexp_replace(coalesce(l.phone_e164, l.phone_text, l.phone::text, ''), '\D','','g'), 10)
           = right(regexp_replace(v_bc.phone_number, '\D','','g'), 10);
      if found then
        if (select count(*) from public.incoming_leads l
             where right(regexp_replace(coalesce(l.phone_e164, l.phone_text, l.phone::text, ''), '\D','','g'), 10)
                 = right(regexp_replace(v_bc.phone_number, '\D','','g'), 10)) = 1 then
          v_lead_how := 'exact_phone';
        else v_lead := null; v_lead_how := null; end if;
      end if;
    end if;
  end if;

  -- Snapshot: decision-relevant state only. No names, phones, emails, attachments.
  v_snapshot := jsonb_build_object(
    'eligibility_status_before',    v_bc.eligibility_status,
    'background_check_status',      v_bc.background_check_status,
    'insurance_check_status',       v_bc.insurance_check_status,
    'earnings_verification_status', v_bc.earnings_verification_status,
    'own_insurance',                v_bc.own_insurance,
    'verification_form_submitted',  coalesce(v_bc.verification_form_submitted, v_bc.verificaton_form_submitted),
    'has_license_doc',              (v_bc.driver_s_license is not null or v_bc.drivers_license_front_path is not null),
    'has_insurance_doc',            (v_bc.proof_of_insurance is not null),
    'has_earnings_doc',             (v_bc.paystub is not null),
    'date_verified_before',         v_bc.date_verified,
    'lead_match_method',            v_lead_how
  );

  insert into public.decision_events
    (org_id, person_id, background_check_id, lead_id, product_program, decision, reason_code, explanation,
     source, rule_version, actor_kind, actor_id, inputs_snapshot, dedupe_key)
  values
    (v_bc.org_id, v_person, p_background_check_id, v_lead, p_product_program, p_decision, p_reason_code,
     nullif(btrim(coalesce(p_explanation,'')),''), p_source, v_version, p_actor_kind, p_actor_id, v_snapshot, p_dedupe_key)
  returning id into v_event_id;

  update public.background_checks
     set last_decision_event_id = v_event_id,
         reason_code            = p_reason_code,
         lead_id                = coalesce(lead_id, v_lead),
         lead_match_method      = coalesce(lead_match_method, v_lead_how)
   where id = p_background_check_id;

  return v_event_id;
end;
$$;
revoke all on function public.record_decision_event(uuid,text,text,text,text,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_decision_event(uuid,text,text,text,text,text,uuid,text,text) to service_role;
-- authenticated callers must go through bg_check_decide (which enforces the staff gate).

-- ----------------------------------------------------------------------------
-- 8. Extend bg_check_decide — backward-compatible signature
--    Old 3-arg calls keep working. New optional args: reason, explanation, program, dedupe.
--    The old 3-arg function is dropped because Postgres cannot host both the
--    3-arg and the defaulted 7-arg overloads without call ambiguity.
-- ----------------------------------------------------------------------------
drop function if exists public.bg_check_decide(uuid, text, text);

create or replace function public.bg_check_decide(
  p_id              uuid,
  p_decision        text,
  p_notes           text default null,
  p_reason_code     text default null,
  p_explanation     text default null,
  p_product_program text default null,
  p_dedupe_key      text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_prev  text;
  v_event uuid;
begin
  -- === unchanged from the verified original ===
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

  -- === new: write the decision event FIRST so a reason violation aborts the whole call ===
  v_event := public.record_decision_event(
    p_background_check_id := p_id,
    p_decision            := p_decision,
    p_reason_code         := p_reason_code,
    p_explanation         := coalesce(p_explanation, p_notes),
    p_source              := 'bg_check',
    p_actor_kind          := case when v_uid is null then 'process' else 'staff' end,
    p_actor_id            := v_uid,
    p_product_program     := p_product_program,
    p_dedupe_key          := p_dedupe_key
  );

  -- === unchanged from the verified original ===
  update public.background_checks
     set eligibility_status = p_decision,
         review_notes       = coalesce(nullif(btrim(coalesce(p_notes,'')),''), review_notes),
         date_verified      = current_date,
         reviewed_by        = v_uid,
         reviewed_at        = now(),
         updated_at         = now()
   where id = p_id;

  return jsonb_build_object(
    'id', p_id, 'from', v_prev, 'to', p_decision, 'reviewed_at', now(),
    'decision_event_id', v_event, 'reason_code', p_reason_code
  );
end;
$$;
revoke all on function public.bg_check_decide(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.bg_check_decide(uuid,text,text,text,text,text,text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Observability: "why is this customer where they are?"
--    Invoker view over staff-readable tables only (no background_checks columns,
--    which are admin-only under RLS).
-- ----------------------------------------------------------------------------
create or replace view public.v_decision_trail
with (security_invoker = true) as
select
  d.id                  as decision_event_id,
  d.seq,
  d.created_at,
  d.person_id,
  d.background_check_id,
  d.lead_id,
  d.product_program,
  d.decision,
  d.reason_code,
  rc.category           as reason_category,
  rcat.recoverable,
  d.explanation,
  d.source,
  d.rule_version,
  d.actor_kind,
  d.actor_id,
  d.next_destination,
  d.routed_at,
  d.inputs_snapshot,
  lag(d.decision) over (partition by coalesce(d.person_id::text, d.background_check_id::text, d.lead_id::text) order by d.seq) as previous_decision
from public.decision_events d
left join public.reason_codes      rc   on rc.code = d.reason_code
left join public.reason_categories rcat on rcat.category = rc.category;

grant select on public.v_decision_trail to authenticated;
revoke all on public.v_decision_trail from anon;

-- ----------------------------------------------------------------------------
-- 10. PostgREST schema reload (Supabase's pgrst_ddl_watch event trigger normally
--     does this on DDL; the explicit NOTIFY is a harmless belt-and-braces so the
--     new bg_check_decide signature is visible to RPC callers immediately).
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
