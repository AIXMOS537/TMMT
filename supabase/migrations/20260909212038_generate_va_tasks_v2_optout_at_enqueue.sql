-- REC-120: enforce incoming_leads.opted_out (STOP) at ENQUEUE, alongside the
-- do_not_contact_numbers filter already live since 2026-09-06.
--
-- APPLIED to production 2026-09-09 21:20 UTC (schema_migrations 20260909212038).
--
-- ── RECONCILED, NOT APPLIED AS STAGED ──────────────────────────────────────
-- _staged/20260908000000_generate_va_tasks_dnc_at_enqueue_STAGED.sql requires a
-- pre-apply diff and instructs: STOP if the live body differs by anything other
-- than the added opt-out blocks. It was run, and it failed its own test. The
-- staged body is a RECONSTRUCTION and it differed in three ways beyond opt-out:
--
--   * live guards `d.phone10 is not null` in all three DNC checks; staged dropped it
--   * live wraps the phone in coalesce(...,''); staged dropped that
--   * live's return carries 'dnc_filtered_at_enqueue'; staged dropped the key,
--     while claiming the return shape was preserved byte-for-byte
--
-- So the body below is the LIVE definition captured verbatim via
-- pg_get_functiondef immediately before applying, plus ONLY the opt-out filters.
-- Nothing else moved.
--
-- ── WHAT CHANGED, EXACTLY (this is also the revert recipe) ──────────────────
-- To restore the 2026-09-06 state, remove precisely these and nothing else:
--   1. the `not exists (select 1 from incoming_leads ol where ol.opted_out ...)`
--      block in payment_followup
--   2. the same block in waitlist_contact
--   3. the same block in lead_reengagement
--   4. `and coalesce(l.opted_out, false) = false` in lead_reengagement
--   5. the 'optout_filtered_at_enqueue' key in the returned jsonb
-- The result is byte-equivalent to the pre-2026-09-09 body. Nothing else in this
-- file differs from it, which is why the recipe is safe to trust.
--
-- ── SAFETY ─────────────────────────────────────────────────────────────────
-- Changes only which work items are CREATED. Sends nothing, charges nothing,
-- approves nothing, deletes nothing, writes no lifecycle column (status /
-- handled_at / result). Signature, volatility, SECURITY DEFINER, search_path,
-- grants and the cron binding are preserved. bgcheck_review (VISION internal
-- review, no outbound send) and ticket_collect (inserts subject_phone as NULL,
-- so there is nothing to test) stay unfiltered on purpose.
--
-- Verified after apply: 3 do_not_contact filters still present, 3 opt-out
-- filters added, 6 NOT EXISTS total, 'dnc_filtered_at_enqueue' still returned,
-- SECURITY DEFINER yes, search_path public+pg_temp, returns jsonb, EXECUTE is
-- postgres+service_role only, cron job aixmos_daily_va_sweep still bound to
-- this function, bgcheck_review pending unchanged at 136.

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
