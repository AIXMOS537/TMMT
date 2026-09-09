-- Rollback candidate: restores the audited prior classifier. No lifecycle/data changes.
begin;
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
    -- subject_name is REQUIRED: the ticket_collect predicate joins on it.
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
      -- distinguishes "a manager must decide" from "the source row has no
      -- status at all", which is data repair, not deliberation.
      exists (select 1 from public.background_checks bc
                where bc.customer_id::text = (r.context->>'customer_id')
                  and bc.eligibility_status is null) as bg_status_missing
    from ranked r
  )
  select s.id, s.old_triage, s.old_reason,
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

revoke all on function public.classify_va_tasks(boolean, text) from public;
revoke all on function public.classify_va_tasks(boolean, text) from anon;
revoke all on function public.classify_va_tasks(boolean, text) from authenticated;
grant execute on function public.classify_va_tasks(boolean, text) to service_role;

comment on function public.classify_va_tasks(boolean, text) is
  'Deterministic triage classifier for exec_va_tasks. Dry-run by default. Writes ONLY triage_* columns; never status, handled_at or result. Classification recommends authority, it does not exercise it. service_role only.';


commit;
