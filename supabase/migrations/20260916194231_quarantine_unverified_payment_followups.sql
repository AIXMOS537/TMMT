-- Quarantine unverified payment follow-ups and stop regenerating them
-- (owner-approved 2026-09-16, decision 4). No contact, no staging, no deletion.
--
-- Evidence (read-only, 2026-09-16): 21 open payment_followup tasks, all created
-- 2026-09-06 by generate_va_tasks_v2 from Airtable-imported customer_payments rows
-- marked 'Overdue', due 145-317 days ago. No receipts, no linked vehicle, the
-- payments table is empty, and every customer_payments row carries the same bulk
-- updated_at. The recorded `amount` is a payment amount, not a verified balance.
-- One destination has GHL DND that the current gate does not read.
-- Nothing in TMMT OS can substantiate these obligations.
--
-- 1. public.payment_obligation_reconciliation: one row per customer_payments row,
--    state 'unverified' until reconciled internally from contracts, bank, processor
--    or receipt records. verified_owed_at is set ONLY when an obligation is
--    confirmed, and only with verified_by + evidence_ref. Other state labels are
--    deliberately not fixed yet. No customer contact to check our own records.
-- 2. The 21 tasks move pending -> quarantined_unverified (status only), prior
--    state kept in exec_va_tasks_quarantine_20260916. Guarded by exact count and
--    id-set md5; a fresh or already-quarantined DB skips.
-- 3. generate_va_tasks_v2: payment_followup tasks are generated only when the
--    obligation is verified (invariant: UNVERIFIED OBLIGATION -> NO COLLECTION
--    CONTACT TASK). Base body = the live body applied 2026-09-09
--    (prosrc md5 3c0a4d751553cf6e710a3ece05f08472, identical to
--    20260909212038_generate_va_tasks_v2_optout_at_enqueue.sql); only that one
--    condition and one return key are added.
--
-- ROLLBACK:
--   update public.exec_va_tasks t set status = q.prev_status
--     from public.exec_va_tasks_quarantine_20260916 q
--    where t.id = q.task_id and t.status = 'quarantined_unverified';
--   then re-apply the function from 20260909212038_generate_va_tasks_v2_optout_at_enqueue.sql
--   (the reconciliation table can stay; nothing else reads it).

do $$
declare
  v_n   int;
  v_md5 text;
begin
  if to_regclass('public.customer_payments') is null or to_regclass('public.exec_va_tasks') is null then
    raise notice 'customer_payments / exec_va_tasks not present: quarantine skipped (fresh environment)';
    return;
  end if;

  execute $ddl$
    create table if not exists public.payment_obligation_reconciliation (
      customer_payment_id uuid primary key references public.customer_payments(id) on delete restrict,
      state               text not null default 'unverified' check (length(btrim(state)) > 0),
      verified_owed_at    timestamptz,
      verified_by         text,
      evidence_ref        text,
      reviewer_note       text,
      created_at          timestamptz not null default now(),
      updated_at          timestamptz not null default now(),
      constraint verified_needs_evidence
        check (verified_owed_at is null or (verified_by is not null and evidence_ref is not null))
    )$ddl$;
  execute 'alter table public.payment_obligation_reconciliation enable row level security';
  execute 'revoke all on public.payment_obligation_reconciliation from anon, authenticated';
  execute $c$comment on table public.payment_obligation_reconciliation is
    'Internal reconciliation of historical payment records. unverified = no collection contact task. verified_owed_at only with verified_by + evidence_ref. Never contact a customer to check our own records.'$c$;

  execute 'insert into public.payment_obligation_reconciliation (customer_payment_id)
           select cp.id from public.customer_payments cp
           on conflict (customer_payment_id) do nothing';

  execute $ddl$
    create table if not exists public.exec_va_tasks_quarantine_20260916 (
      task_id            uuid primary key,
      prev_status        text not null,
      prev_handled_at    timestamptz,
      prev_triage        text,
      prev_triage_reason text,
      reason             text not null default 'obligation_unverified',
      quarantined_at     timestamptz not null default now(),
      batch              text not null default 'payment_followup_quarantine_20260916'
    )$ddl$;
  execute 'alter table public.exec_va_tasks_quarantine_20260916 enable row level security';
  execute 'revoke all on public.exec_va_tasks_quarantine_20260916 from anon, authenticated';

  select count(*), md5(string_agg(t.id::text, ',' order by t.id)) into v_n, v_md5
    from public.exec_va_tasks t
   where t.category = 'payment_followup' and t.status = 'pending' and t.handled_at is null
     and t.source_table = 'customer_payments';

  if v_n = 0 then
    raise notice 'no open payment_followup tasks: quarantine data step skipped';
    return;
  end if;
  if v_n <> 21 or v_md5 <> 'fb009017a2d7a18820442c68555ef624' then
    raise exception 'quarantine abort: % open payment_followup tasks (md5 %), expected the verified 21', v_n, v_md5;
  end if;

  execute 'insert into public.exec_va_tasks_quarantine_20260916
             (task_id, prev_status, prev_handled_at, prev_triage, prev_triage_reason)
           select t.id, t.status, t.handled_at, t.triage, t.triage_reason
             from public.exec_va_tasks t
            where t.category = ''payment_followup'' and t.status = ''pending'' and t.handled_at is null
              and t.source_table = ''customer_payments''';

  update public.exec_va_tasks t set status = 'quarantined_unverified'
    from public.exec_va_tasks_quarantine_20260916 q
   where t.id = q.task_id and t.status = 'pending';
  get diagnostics v_n = row_count;
  if v_n <> 21 then
    raise exception 'quarantine abort: updated % rows, expected 21', v_n;
  end if;
end $$;

create or replace function public.generate_va_tasks_v2()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_today date := current_date;
  n_pay int := 0; n_wait int := 0; n_bg int := 0; n_lead int := 0; n_tick int := 0;
begin
  insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, context,
                             source_table, source_id, sweep_date, first_seen_at, last_seen_at)
  select 'payment_followup', 'urgent', 'CHUMMO', cp.customer, cp.customer_phone_number::text,
         jsonb_build_object('amount', cp.amount, 'past_due', cp.amout_past_due,
           'last_payment', cp.last_payment_date, 'next_due', cp.next_payment_due_date,
           'payment_status', cp.payment_status, 'notes', cp.notes),
         'customer_payments', cp.id::text, v_today, now(), now()
  from customer_payments cp
  where (cp.payment_status ilike '%overdue%' or cp.payment_status ilike '%past due%'
     or cp.payment_status ilike '%late%'
     or (cp.next_payment_due_date is not null and cp.next_payment_due_date < current_date))
    and not exists (
      select 1 from do_not_contact_numbers d
      where d.phone10 is not null
        and d.phone10 = right(regexp_replace(coalesce(cp.customer_phone_number::text,''), '\D', '', 'g'), 10)
    )
    and not exists (
      select 1 from incoming_leads ol
      where ol.opted_out
        and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text, ''), '\D', '', 'g'), 10)
            = right(regexp_replace(coalesce(cp.customer_phone_number::text,''), '\D', '', 'g'), 10)
    )
    -- CHANGED 2026-09-16 (G-01 follow-up, owner decision 4): a collection
    -- contact task exists only for an obligation verified from real business
    -- records. Unverified historical balances never generate contact work.
    and exists (
      select 1 from payment_obligation_reconciliation r
      where r.customer_payment_id = cp.id
        and r.verified_owed_at is not null
    )
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_pay = row_count;

  insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context,
                             source_table, source_id, sweep_date, first_seen_at, last_seen_at)
  select 'waitlist_contact', 'high', 'CHUMMO', w.customer_name, w.customer_phone::text, w.customer_email::text,
         jsonb_build_object('days_waiting', (current_date - w.date_added_to_waitlist),
           'vehicle_type', w.vehicle_type, 'make', w.make, 'model', w.model,
           'desired_weekly', w.desired_weekly_payment, 'status', w.status),
         'waitlist', w.id::text, v_today, now(), now()
  from waitlist w
  where w.status not in ('Fulfilled','Cancelled','Converted','Not Interested','Removed')
    and w.date_added_to_waitlist is not null
    and w.date_added_to_waitlist < current_date - 30
    and not exists (
      select 1 from do_not_contact_numbers d
      where d.phone10 is not null
        and d.phone10 = right(regexp_replace(coalesce(w.customer_phone::text,''), '\D', '', 'g'), 10)
    )
    and not exists (
      select 1 from incoming_leads ol
      where ol.opted_out
        and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text, ''), '\D', '', 'g'), 10)
            = right(regexp_replace(coalesce(w.customer_phone::text,''), '\D', '', 'g'), 10)
    )
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_wait = row_count;

  insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context,
                             source_table, source_id, sweep_date, first_seen_at, last_seen_at)
  select 'bgcheck_review', 'high', 'VISION', bc.customer_name, bc.phone_number::text, bc.email::text,
         jsonb_build_object('eligibility_status', bc.eligibility_status,
           'customer_id', bc.customer_id, 'review_notes', bc.review_notes),
         'background_checks', bc.customer_id::text, v_today, now(), now()
  from background_checks bc
  where (bc.eligibility_status = 'Need Manager''s Review' or bc.eligibility_status is null)
    and bc.customer_id is not null
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_bg = row_count;

  -- CHANGED 2026-09-06: LIMIT removed. Every qualifying lead now gets exactly
  -- one durable work item. ORDER BY kept for deterministic insertion order.
  -- CHANGED 2026-09-09: opted_out tested on the lead's OWN row and, defensively,
  -- across any other lead row carrying the same 10-digit number -- the same
  -- person is often several incoming_leads rows and STOP lands on whichever the
  -- webhook matched by phone_e164.
  insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context,
                             source_table, source_id, sweep_date, first_seen_at, last_seen_at)
  select 'lead_reengagement', 'medium', 'CHUMMO', l.contact_name,
         coalesce(l.phone_e164, l.phone::text), l.email,
         jsonb_build_object('created_on', l.created_at,
           'days_old', (current_date - l.created_at::date), 'opportunity', l.opportunity_name),
         'incoming_leads', l.id::text, v_today, now(), now()
  from incoming_leads l
  where (l.status is null or l.status in ('New','New Lead'))
    and l.created_at < now() - interval '30 days'
    and (l.phone is not null or l.phone_e164 is not null)
    and l.email not ilike '%noreply%'
    and coalesce(l.opted_out, false) = false
    and not exists (
      select 1 from do_not_contact_numbers d
      where d.phone10 is not null
        and d.phone10 = right(regexp_replace(coalesce(l.phone_e164, l.phone::text, ''), '\D', '', 'g'), 10)
    )
    and not exists (
      select 1 from incoming_leads ol
      where ol.opted_out
        and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text, ''), '\D', '', 'g'), 10)
            = right(regexp_replace(coalesce(l.phone_e164, l.phone::text, ''), '\D', '', 'g'), 10)
    )
  order by l.created_at asc, l.id asc
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_lead = row_count;

  insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, context,
                             source_table, source_id, sweep_date, first_seen_at, last_seen_at)
  select 'ticket_collect', 'medium', 'CHUMMO', t.requested_by_customer, null,
         jsonb_build_object('ticket_ids', array_agg(t.ticket_id),
           'total_owed', sum(t.amount), 'violation_types', array_agg(distinct t.violation_type)),
         'tickets', t.requested_by_customer, v_today, now(), now()
  from tickets t
  where t.amount > 0
    and (t.status is null or t.status not in ('Closed','Resolved','Done'))
    and t.requested_by_customer is not null
  group by t.requested_by_customer
  having sum(t.amount) >= 50
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_tick = row_count;

  return jsonb_build_object(
    'ok', true, 'version', 'v2', 'sweep_date', v_today,
    'dnc_filtered_at_enqueue', jsonb_build_array('payment_followup','waitlist_contact','lead_reengagement'),
    'optout_filtered_at_enqueue', jsonb_build_array('payment_followup','waitlist_contact','lead_reengagement'),
    'payment_followup_requires_verified_obligation', true,
    'touched', jsonb_build_object('payment_followup', n_pay, 'waitlist_contact', n_wait,
      'bgcheck_review', n_bg, 'lead_reengagement', n_lead, 'ticket_collect', n_tick),
    'total_rows', (select count(*) from exec_va_tasks),
    'open_with_identity', (select count(*) from exec_va_tasks where status='pending' and source_id is not null));
end;
$function$;

-- Grants restated: CREATE OR REPLACE preserves them, but a future CREATE would
-- not, and a SECURITY DEFINER function must never be executable by anon.
revoke all on function public.generate_va_tasks_v2() from public, anon, authenticated;
grant execute on function public.generate_va_tasks_v2() to service_role;

comment on function public.generate_va_tasks_v2() is
  'Idempotent VA task generation. Upserts on (category, source_table, source_id), bumping seen_count instead of inserting a row per sweep. Suppresses do_not_contact_numbers AND incoming_leads.opted_out at ENQUEUE for the three CHUMMO outbound-contact categories (payment_followup, waitlist_contact, lead_reengagement); bgcheck_review (VISION internal review) and ticket_collect (no single phone) are deliberately unfiltered. Writes no lifecycle column and does not schedule itself.';
