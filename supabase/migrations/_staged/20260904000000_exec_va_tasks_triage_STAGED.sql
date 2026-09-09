-- ===========================================================================
-- TRIAGED 2026-09-09: NOT APPLIED. Superseded, exactly as its header says.
-- Verified in production: public.exec_va_tasks.triage exists and
-- classify_va_tasks(p_dry_run, p_ruleset) is live and cron-bound
-- (aixmos_daily_va_classify, 12:15 daily). The authoritative copies are
-- 20260903193844 and 20260903194001. Do not run.
-- ===========================================================================

-- ============================================================================
-- ⚠️ SUPERSEDED DRAFT — DO NOT RUN.
--
-- APPLIED to production 2026-09-03 with owner approval, but NOT as written
-- here: the `keyed` CTE below omitted subject_name, which the ticket_collect
-- source predicate joins on. The first execution of the wrapper failed with
-- "column r.subject_name does not exist". (Fixed in this file afterwards, but
-- the authoritative copies are the applied ones.)
--
-- Applied versions, matching production exactly:
--     20260903193844_exec_va_tasks_triage_schema.sql
--     20260903194001_classify_va_tasks_fn.sql
--
-- Verified in production: dry run reconciles 17,806/17,806, persist wrote
-- 17,806, second pass wrote 0 (idempotent), lifecycle unchanged, provenance
-- complete, anon/authenticated revoked. Kept as the record of what was
-- proposed. See _staged/README.md.
--
-- exec_va_tasks triage control plane.
--
-- SAFETY BOUNDARY (structural, not aspirational):
--   Classification can RECOMMEND authority. It cannot EXERCISE authority.
--   'auto' means "eligible for future automation", NOT "execute now".
--
-- This migration and its function:
--   * write ONLY the five triage_* columns
--   * never touch status, handled_at, result, or any lifecycle state
--   * never send, never charge, never approve, never delete a row
--   * never schedule or activate a cron job
--
-- Dry-run measured against production 2026-09-03 (read-only). Distribution and
-- reconciliation are recorded at the bottom of this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Triage dimension. Deliberately SEPARATE from lifecycle `status`.
--
-- `status` answers "where is this task in its life?" (pending -> handled).
-- `triage` answers "who is allowed to act on it?" (auto / needs_approval /
-- ignore). Collapsing them is what makes a queue unreadable: you can no longer
-- ask "how many things need Muhammad?" without parsing a state machine.
-- ---------------------------------------------------------------------------
alter table public.exec_va_tasks
  add column if not exists triage             text,
  add column if not exists triage_reason      text,
  add column if not exists triage_confidence  numeric(3,2),
  add column if not exists triaged_at         timestamptz,
  add column if not exists triaged_by         text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exec_va_tasks_triage_chk') then
    alter table public.exec_va_tasks
      add constraint exec_va_tasks_triage_chk
      check (triage is null or triage in ('auto','needs_approval','ignore'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exec_va_tasks_triage_conf_chk') then
    alter table public.exec_va_tasks
      add constraint exec_va_tasks_triage_conf_chk
      check (triage_confidence is null or (triage_confidence >= 0 and triage_confidence <= 1));
  end if;
end $$;

-- The CEO decision queue is one index scan: triage='needs_approval'.
create index if not exists exec_va_tasks_needs_approval_idx
  on public.exec_va_tasks (category, priority, sweep_date desc)
  where triage = 'needs_approval';

create index if not exists exec_va_tasks_triage_idx
  on public.exec_va_tasks (triage, category)
  where triage is not null;

comment on column public.exec_va_tasks.triage is
  'Authority recommendation, independent of lifecycle status. auto = eligible for future automation (NOT execute-now); needs_approval = owner gate; ignore = no action. Written only by classify_va_tasks().';
comment on column public.exec_va_tasks.triage_reason is
  'Which rule fired. Stable identifier, safe to group by.';
comment on column public.exec_va_tasks.triage_confidence is
  '0..1. Below 0.90 means the rule leaned on a fuzzy match and deserves a human look.';
comment on column public.exec_va_tasks.triaged_by is
  'Provenance: ruleset identifier, e.g. "ruleset/v1". Not a person.';


-- ---------------------------------------------------------------------------
-- 2. The classifier. Deterministic SQL, not a model — so it is reproducible,
-- diffable, and explainable. Idempotent: re-running changes nothing unless the
-- underlying facts changed, and it reports exactly what moved.
--
-- SECURITY INVOKER on purpose: service_role bypasses RLS, so no SECURITY
-- DEFINER is needed and we add zero new advisor warnings (see
-- docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md).
--
-- RULE PRECEDENCE (first match wins):
--   1 dnc_blocked                          ignore          1.00  TCPA opt-out, never contact
--   2 already_handled                      ignore          1.00  terminal
--   3 superseded_by_later_sweep            ignore          1.00  older copy of the same subject
--   4 source_condition_resolved_close_only auto            0.95  SOURCE cleared; close only
--   5 no_contact_method                    needs_approval  0.90  no phone AND no email
--   6 money_contact_owner_gate             needs_approval  0.98  money movement
--   7 outbound_contact_tcpa_gate           needs_approval  0.98  outbound message to a person
--   8 source_data_incomplete               needs_approval  0.85  source row has no status at all
--   9 human_decision_required              needs_approval  0.98  a manager must decide
--  10 unclassified_default_safe            needs_approval  0.50  fail safe, never fail open
--
-- AUTHORITY IS DERIVED, NOT DECLARED. Rule 4 is evaluated for EVERY category
-- and is checked BEFORE any category rule, so any category can reach 'auto' the
-- moment its source state clears. Rules 6-9 are the fallback for work that is
-- still outstanding -- they are not a statement that those categories are
-- permanently an approval queue. If tomorrow a source row resolves, rule 4
-- fires and the orchestration model does not change.
-- ---------------------------------------------------------------------------
create or replace function public.classify_va_tasks(
  p_dry_run boolean default true,
  p_ruleset text    default 'ruleset/v1'
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_result  jsonb;
  v_written integer := 0;
  v_now     timestamptz := now();
begin
  create temporary table _tri on commit drop as
  with keyed as (
    -- subject_name is REQUIRED here: the ticket_collect source predicate joins
    -- on it. Omitting it from this projection is what broke the first execution
    -- of this function -- the read-only prototype used `r.*` off the base table
    -- and never surfaced the gap.
    select t.id, t.category, t.status, t.handled_at, t.sweep_date, t.created_at,
           t.subject_name, t.subject_phone, t.subject_email, t.context,
           t.triage as old_triage, t.triage_reason as old_reason,
           coalesce(t.subject_name,'~')||'|'||coalesce(t.subject_phone,'~')||'|'||coalesce(t.subject_email,'~') as sk
    from public.exec_va_tasks t
  ),
  ranked as (
    select k.*, row_number() over (
             partition by k.category, k.sk
             order by k.sweep_date desc, k.created_at desc, k.id
           ) as rn
    from keyed k
  ),
  -- SOURCE STATE, evaluated per category against the live source table.
  --
  -- NOT EXISTS, never JOIN. The joins fan out badly (waitlist 35 subjects ->
  -- 38 matched rows, leads 163 -> 227) and a fan-out would DUPLICATE rows in
  -- the classifier, breaking the "0 silently duplicated" invariant. NOT EXISTS
  -- is cardinality-safe: one row in, one row out.
  --
  -- Semantics are deliberately conservative: resolved means NO outstanding
  -- source row remains. If any matching source row is still open, the work is
  -- not done. Measured 2026-09-03: 6 lead subjects had one resolved and one
  -- unresolved lead under the same email; all 6 correctly stay needs_approval.
  state as (
    select r.*,
      case
        when r.rn > 1 then null   -- superseded rows are never source-evaluated
        when r.category = 'payment_followup' then not exists (
          select 1 from public.customer_payments cp
           where cp.customer_phone_number::text = r.subject_phone
             and (cp.payment_status ~* 'overdue|past due|late'
               or (cp.next_payment_due_date is not null and cp.next_payment_due_date < current_date)))
        when r.category = 'waitlist_contact' then not exists (
          select 1 from public.waitlist w
           where w.customer_phone::text = r.subject_phone
             and w.status not in ('Fulfilled','Cancelled','Converted','Not Interested','Removed'))
        when r.category = 'lead_reengagement' then not exists (
          select 1 from public.incoming_leads il
           where il.email = r.subject_email
             and (il.status is null or il.status in ('New','New Lead')))
        when r.category = 'bgcheck_review' then not exists (
          select 1 from public.background_checks bc
           where bc.customer_id::text = (r.context->>'customer_id')
             and (bc.eligibility_status is null or bc.eligibility_status = 'Need Manager''s Review'))
        when r.category = 'ticket_collect' then not exists (
          select 1 from public.tickets t2
           where t2.requested_by_customer = r.subject_name
             and t2.amount > 0
             and (t2.status is null or t2.status not in ('Closed','Resolved','Done')))
        else null
      end as source_resolved,
      -- bgcheck only: distinguishes "a manager must decide" from "the source
      -- row has no status at all", which is data repair, not deliberation.
      exists (select 1 from public.background_checks bc
                where bc.customer_id::text = (r.context->>'customer_id')
                  and bc.eligibility_status is null) as bg_status_missing
    from ranked r
  )
  select s.id, s.old_triage, s.old_reason,
    -- AUTHORITY IS DERIVED, NOT DECLARED.
    -- Order: terminal states, then dedupe, then SOURCE STATE, then action class.
    -- Source state is checked BEFORE category so that any category can reach
    -- 'auto' the moment its source clears. Nothing here encodes "this category
    -- is permanently an approval queue".
    case
      when s.status = 'blocked_dnc' then 'ignore'
      when s.handled_at is not null then 'ignore'
      when s.rn > 1                 then 'ignore'
      when s.source_resolved        then 'auto'
      else 'needs_approval'
    end as triage,
    case
      when s.status = 'blocked_dnc' then 'dnc_blocked'
      when s.handled_at is not null then 'already_handled'
      when s.rn > 1                 then 'superseded_by_later_sweep'
      when s.source_resolved        then 'source_condition_resolved_close_only'
      when s.subject_phone is null and s.subject_email is null then 'no_contact_method'
      when s.category in ('payment_followup','ticket_collect')   then 'money_contact_owner_gate'
      when s.category in ('waitlist_contact','lead_reengagement') then 'outbound_contact_tcpa_gate'
      when s.category = 'bgcheck_review' and s.bg_status_missing then 'source_data_incomplete'
      when s.category = 'bgcheck_review'                         then 'human_decision_required'
      else 'unclassified_default_safe'
    end as reason,
    case
      when s.status = 'blocked_dnc' then 1.00
      when s.handled_at is not null then 1.00
      when s.rn > 1 then 1.00
      when s.source_resolved then 0.95
      when s.subject_phone is null and s.subject_email is null then 0.90
      when s.category in ('payment_followup','ticket_collect') then 0.98
      when s.category in ('waitlist_contact','lead_reengagement') then 0.98
      when s.category = 'bgcheck_review' and s.bg_status_missing then 0.85
      when s.category = 'bgcheck_review' then 0.98
      else 0.50
    end::numeric(3,2) as confidence
  from state s;

  -- Audit: what WOULD change, before anything is written.
  select jsonb_build_object(
    'ruleset',        p_ruleset,
    'dry_run',        p_dry_run,
    'evaluated_at',   v_now,
    'source_rows',    (select count(*) from public.exec_va_tasks),
    'classified',     (select count(*) from _tri),
    'reconciles',     (select count(*) from _tri) = (select count(*) from public.exec_va_tasks),
    'distribution',   (select jsonb_object_agg(k, n) from (
                        select triage||'/'||reason as k, count(*) as n from _tri group by 1) d),
    'by_triage',      (select jsonb_object_agg(triage, n) from (
                        select triage, count(*) as n from _tri group by 1) d2),
    'unchanged',      (select count(*) from _tri where old_triage is not distinct from triage
                                                   and old_reason is not distinct from reason),
    'newly_set',      (select count(*) from _tri where old_triage is null),
    'reclassified',   (select count(*) from _tri where old_triage is not null
                                                   and (old_triage is distinct from triage
                                                     or old_reason is distinct from reason))
  ) into v_result;

  if p_dry_run then
    return v_result || jsonb_build_object('written', 0);
  end if;

  -- Idempotent write. Only the five triage columns. Only rows that differ.
  with upd as (
    update public.exec_va_tasks t
       set triage            = x.triage,
           triage_reason     = x.reason,
           triage_confidence = x.confidence,
           triaged_at        = v_now,
           triaged_by        = p_ruleset
      from _tri x
     where t.id = x.id
       and (t.triage is distinct from x.triage or t.triage_reason is distinct from x.reason)
    returning 1
  )
  select count(*) into v_written from upd;

  return v_result || jsonb_build_object('written', v_written);
end;
$function$;

-- Guard: this function reads PII-adjacent rows and writes authority hints.
-- service_role only. It is invoked deliberately, never from the browser.
revoke all on function public.classify_va_tasks(boolean, text) from public;
revoke all on function public.classify_va_tasks(boolean, text) from anon;
revoke all on function public.classify_va_tasks(boolean, text) from authenticated;
grant execute on function public.classify_va_tasks(boolean, text) to service_role;

comment on function public.classify_va_tasks(boolean, text) is
  'Deterministic triage classifier for exec_va_tasks. Dry-run by default. Writes ONLY triage_* columns; never status, handled_at or result. Classification recommends authority, it does not exercise it. service_role only.';


-- ============================================================================
-- POSTCONDITIONS — run these after applying. Do not trust "success".
-- ============================================================================
--
-- a) dry run first, and confirm reconciles = true
--    select public.classify_va_tasks(true);
--
-- b) apply
--    select public.classify_va_tasks(false);
--
-- c) every source row accounted for, nothing dropped or duplicated
--    select (select count(*) from exec_va_tasks)                    as source,
--           (select count(*) from exec_va_tasks where triage is not null) as classified,
--           (select count(*) from exec_va_tasks where triage is null)     as unclassified;
--    -- expect unclassified = 0 and source = classified
--
-- d) distribution reconciles to total
--    select triage, triage_reason, count(*)
--      from exec_va_tasks group by 1,2 order by 3 desc;
--
-- e) provenance present on every classified row
--    select count(*) from exec_va_tasks
--     where triage is not null and (triaged_at is null or triaged_by is null);
--    -- expect 0
--
-- f) lifecycle untouched (compare to the pre-apply numbers below)
--    select status, count(*) from exec_va_tasks group by 1;
--    -- expect pending 17761, blocked_dnc 45
--
-- g) idempotency: a second pass must write 0
--    select public.classify_va_tasks(false);   -- expect "written": 0
--
-- h) advisors clean for the new objects
--    (no new SECURITY DEFINER function, no new RLS-enabled-no-policy table)
--
-- ============================================================================
-- DRY RUN measured 2026-09-03 against uapxakmlwnpfsftfeezx (read-only)
-- ============================================================================
--   triage          reason                                rows
--   ignore          superseded_by_later_sweep           17,397
--   needs_approval  outbound_contact_tcpa_gate             198
--   needs_approval  human_decision_required                 64
--   needs_approval  source_data_incomplete                  64
--   ignore          dnc_blocked                             45
--   needs_approval  money_contact_owner_gate                26
--   needs_approval  no_contact_method                       12
--                                                       -------
--   TOTAL                                                17,806  == source rows OK
--
--   by triage:  ignore 17,442 | needs_approval 364 | auto 0
--
-- READ THIS: 17,806 rows are 364 distinct subjects across 58 daily sweeps.
-- ~98% of the corpus is the same people re-listed every day. The real backlog
-- is 364 items. needs_approval (364) == the independently counted distinct
-- subject cardinality, which is an EXTERNAL check on the dedupe rule: rule 3
-- removed exactly the duplicates and nothing else.
--
-- SOURCE-STATE JOINS, all verified against production, all 100% matched:
--   bgcheck_review    132/132 on context->>'customer_id'
--   payment_followup   26/26  on subject_phone
--   waitlist_contact   38/38  on subject_phone   (35 subjects -> 38 rows: FAN-OUT)
--   lead_reengagement 227/227 on subject_email   (163 subjects -> 227 rows: FAN-OUT)
-- The fan-out is why this uses NOT EXISTS and not JOIN. A join would have
-- duplicated 64 lead rows and 3 waitlist rows into the classifier output and
-- silently broken the reconciliation invariant.
--
-- 'auto' is 0 today, and that is the honest answer. A first pass using a JOIN
-- appeared to find 6 automatable lead tasks. It was WRONG -- an artifact of the
-- fan-out. Checked directly: of 163 lead subjects, 64 match multiple source
-- rows, 6 have at least one resolved lead, and 0 have ALL their leads resolved.
-- Under cardinality-safe semantics every one correctly stays needs_approval.
--
-- Rule 4 is live, not dead code: every category's source predicate is evaluated
-- on every pass, and all four joins match 100% of rows. It fires the instant a
-- source row clears.
-- ============================================================================
