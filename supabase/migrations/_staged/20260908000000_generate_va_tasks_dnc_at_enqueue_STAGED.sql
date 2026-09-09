-- ===========================================================================
-- TRIAGED 2026-09-09: SUPERSEDED. Its INTENT shipped; its BODY did not.
--
-- The pre-apply diff this file requires was run, and it FAILED its own test.
-- The reconstructed body here differs from the live definition by more than
-- the added opt-out blocks:
--   * live guards `d.phone10 is not null` in all three DNC checks - dropped here
--   * live wraps the phone in coalesce(...,'') - dropped here
--   * live's return carries 'dnc_filtered_at_enqueue' - dropped here, despite
--     this file claiming the return shape is preserved byte-for-byte
--
-- Per this file's own STOP rule, it was reconciled rather than applied: the
-- live body was captured verbatim via pg_get_functiondef and the opt-out
-- filters added to THAT. See supabase/migrations/
-- 20260909212038_generate_va_tasks_v2_optout_at_enqueue.sql, which is what
-- production actually runs. Do not run this file.
-- ===========================================================================

-- 20260908000000_generate_va_tasks_dnc_at_enqueue_STAGED
-- REC-120 — do-not-contact AND opt-out enforced at ENQUEUE, not only at execution.
--
-- ============================ STAGED. NOT APPLIED. ==========================
-- Nothing in this file has run. Apply only under owner approval, and only
-- after the PRE-APPLY DIFF below comes back clean.
-- ===========================================================================
--
-- WHY THIS EXISTS WHEN A DNC FILTER IS ALREADY DEPLOYED
--
-- Migration 20260906150000_generate_va_tasks_v2_dnc_enqueue_filter was applied
-- to production on 2026-09-06 and DOES add a DNC filter at enqueue. Two things
-- are still open, and this migration closes both:
--
--   1. OPT-OUT IS NOT FILTERED AT ENQUEUE.  incoming_leads.opted_out is written
--      by the SMS inbound webhook (src/app/api/agent/sms/inbound/route.ts, STOP
--      handling) and, since commit 8dfb6b7ca, is finally READ there to suppress
--      a reply inside that one conversation. It is not consulted anywhere in
--      task generation. A person who texted STOP is therefore still enqueued as
--      CHUMMO outbound work. `do_not_contact_numbers` and `opted_out` are two
--      separate suppression lists; only the first is honoured at enqueue.
--
--   2. THE DEPLOYED FUNCTION BODY IS NOT IN THE REPO.  The 2026-09-06 migration
--      file is a comment-only reconciliation stub — MCP apply_migration records
--      a version row but writes no file, so the repo carries the rationale and
--      not one line of the SQL. The repo currently cannot rebuild the deployed
--      generator. This file restores that.
--
-- SCOPE — deliberately identical to the deployed 2026-09-06 policy.
--   payment_followup   FILTERED   CHUMMO outbound SMS
--   waitlist_contact   FILTERED   CHUMMO outbound SMS
--   lead_reengagement  FILTERED   CHUMMO outbound SMS
--   bgcheck_review     NOT filtered. VISION internal review, no send. DNC and
--                      opt-out govern CONTACT, not internal work. On 2026-09-06,
--                      120 pending bgcheck rows matched a DNC number and were
--                      deliberately left intact. Filtering this category would
--                      silently drop legitimate manager reviews.
--   ticket_collect     NOT filtered. Inserts subject_phone as NULL — the
--                      aggregate has no single contact number to test.
--
-- MATCHING — the form already used by the DNC gate and the invariants file
-- (vault/02-Needs-You/EXEC-VA-TASKS-INVARIANTS.sql:47):
--     right(regexp_replace(<phone>,'\D','','g'), 10) = d.phone10
--
-- NOT EXISTS, NOT `NOT IN`.  `x NOT IN (subquery)` evaluates to NULL for every
-- row the moment the subquery yields a single NULL, which silently drops the
-- ENTIRE insert rather than the matching rows. do_not_contact_numbers.phone10
-- is not guaranteed NOT NULL. NOT EXISTS is null-safe. The payment_followup
-- OR-chain is parenthesised so AND NOT EXISTS binds to the whole predicate and
-- not merely to the last OR term.
--
-- SIGNATURE — public.generate_va_tasks_v2() takes NO arguments and returns
-- jsonb. There is no p_dry_run parameter on this function; none is added here,
-- because adding one would change the signature the pg_cron job and
-- service_role grant are bound to. Signature, volatility, SECURITY DEFINER,
-- search_path, grants and the return shape are all preserved byte-for-byte.
--
-- SAFETY — changes only which work items are CREATED. Sends nothing, charges
-- nothing, approves nothing, deletes nothing. Writes no lifecycle column
-- (status / handled_at / result). Existing rows are untouched by this file;
-- the pending backlog is handled by the companion DRAIN migration, which must
-- be applied AFTER this one.
--
-- ── PRE-APPLY DIFF (REQUIRED, read-only) ───────────────────────────────────
-- The body below is reconstructed from the verbatim pre-DNC capture at
--   vault/02-Needs-You/rollback/generate_va_tasks_v2.PRE-DNC-FILTER.20260906.sql
-- plus the DNC filter and the new opt-out filter. It has NOT been diffed against
-- the live definition. Before applying, run:
--     select pg_get_functiondef('public.generate_va_tasks_v2()'::regprocedure);
-- and confirm the only differences from this file are the added opt-out
-- NOT EXISTS blocks. If anything else differs, the live function drifted after
-- 2026-09-06 — STOP and reconcile rather than overwriting it.
--
-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- Reverting this file restores the 2026-09-06 deployed state (DNC filter, no
-- opt-out filter). The previous definition is preserved verbatim at
--   vault/02-Needs-You/rollback/generate_va_tasks_v2.PRE-DNC-FILTER.20260906.sql
-- CAUTION: that capture is the PRE-DNC-FILTER body. Running it verbatim reverts
-- BOTH this change AND the 2026-09-06 DNC filter, reopening REC-120 entirely.
-- To revert ONLY this change, take the pg_get_functiondef output captured by the
-- PRE-APPLY DIFF step above and run that instead. Capture it before applying —
-- once this file runs, the 2026-09-06 body exists nowhere.
-- The full previous (pre-DNC) definition is reproduced, commented, at the foot
-- of this file so the repo is self-contained.

create or replace function public.generate_va_tasks_v2()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_today date := current_date;
  n_pay int := 0; n_wait int := 0; n_bg int := 0; n_lead int := 0; n_tick int := 0;
begin
  -- NOTE: deliberately NO "already ran today" guard. The upsert IS the
  -- idempotency; a date guard would hide whether it actually works.

  -- 1. payment_followup <- customer_payments.id ------------------------------
  -- OR-chain parenthesised so both suppression checks bind to the whole thing.
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
       where d.phone10 = right(regexp_replace(cp.customer_phone_number::text,'\D','','g'),10))
    and not exists (
      select 1 from incoming_leads ol
       where ol.opted_out
         and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text),'\D','','g'),10)
             = right(regexp_replace(cp.customer_phone_number::text,'\D','','g'),10))
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_pay = row_count;

  -- 2. waitlist_contact <- waitlist.id ---------------------------------------
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
       where d.phone10 = right(regexp_replace(w.customer_phone::text,'\D','','g'),10))
    and not exists (
      select 1 from incoming_leads ol
       where ol.opted_out
         and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text),'\D','','g'),10)
             = right(regexp_replace(w.customer_phone::text,'\D','','g'),10))
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_wait = row_count;

  -- 3. bgcheck_review <- background_checks.customer_id -----------------------
  -- NOT DNC/opt-out filtered, on purpose. VISION internal review, no outbound
  -- send. See SCOPE at the head of this file.
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

  -- 4. lead_reengagement <- incoming_leads.id --------------------------------
  -- opted_out is tested on the lead's OWN row (l.opted_out) and, defensively,
  -- across any other lead row carrying the same 10-digit number: the same
  -- person is frequently present as several incoming_leads rows, and STOP is
  -- recorded on whichever row the webhook matched by phone_e164.
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
       where d.phone10 = right(regexp_replace(coalesce(l.phone_e164, l.phone::text),'\D','','g'),10))
    and not exists (
      select 1 from incoming_leads ol
       where ol.opted_out
         and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text),'\D','','g'),10)
             = right(regexp_replace(coalesce(l.phone_e164, l.phone::text),'\D','','g'),10))
  order by l.created_at asc, l.id asc
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_lead = row_count;

  -- 5. ticket_collect <- the aggregate grouping key --------------------------
  -- NOT filtered: subject_phone is inserted as NULL. Nothing to test.
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
  'Idempotent VA task generation. Upserts on (category, source_table, source_id), bumping seen_count instead of inserting a row per sweep. Suppresses do_not_contact_numbers AND incoming_leads.opted_out at ENQUEUE for the three CHUMMO outbound-contact categories (payment_followup, waitlist_contact, lead_reengagement); bgcheck_review and ticket_collect are deliberately unfiltered. Writes no lifecycle column and does not schedule itself.';

-- ── POST-APPLY VERIFICATION (read-only, run after applying) ────────────────
-- 1. Idempotency must survive the change — run twice, expect 0 net inserts:
--      select count(*) from exec_va_tasks;  select generate_va_tasks_v2();
--      select generate_va_tasks_v2();       select count(*) from exec_va_tasks;
-- 2. The gate must actually be reachable — expect 0 on both counts:
--      select count(*) filter (where status='pending' and subject_phone is not null
--               and category in ('payment_followup','waitlist_contact','lead_reengagement')
--               and right(regexp_replace(subject_phone,'\D','','g'),10)
--                   in (select phone10 from do_not_contact_numbers)) as pending_dnc,
--             count(*) filter (where status='pending' and subject_phone is not null
--               and category in ('payment_followup','waitlist_contact','lead_reengagement')
--               and right(regexp_replace(subject_phone,'\D','','g'),10) in (
--                     select right(regexp_replace(coalesce(phone_e164,phone::text),'\D','','g'),10)
--                       from incoming_leads where opted_out)) as pending_opted_out
--        from exec_va_tasks;
--    Both are only 0 once the companion DRAIN migration has also been applied.
-- 3. bgcheck_review must be UNCHANGED — its DNC-matching pending rows still
--    exist (120 as of 2026-09-06). A drop here means the scope leaked.

-- ===========================================================================
-- ROLLBACK — previous definition (PRE-DNC-FILTER, captured 2026-09-06 from
-- pg_get_functiondef). Reproduced so the repo is self-contained. Running this
-- reverts BOTH this migration AND the 2026-09-06 DNC filter — see the ROLLBACK
-- note at the head of the file before using it.
-- ===========================================================================
-- create or replace function public.generate_va_tasks_v2()
--  returns jsonb
--  language plpgsql
--  security definer
--  set search_path to 'public', 'pg_temp'
-- as $function$
-- declare
--   v_today date := current_date;
--   n_pay int := 0; n_wait int := 0; n_bg int := 0; n_lead int := 0; n_tick int := 0;
-- begin
--   insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, context,
--                              source_table, source_id, sweep_date, first_seen_at, last_seen_at)
--   select 'payment_followup', 'urgent', 'CHUMMO', cp.customer, cp.customer_phone_number::text,
--          jsonb_build_object('amount', cp.amount, 'past_due', cp.amout_past_due,
--            'last_payment', cp.last_payment_date, 'next_due', cp.next_payment_due_date,
--            'payment_status', cp.payment_status, 'notes', cp.notes),
--          'customer_payments', cp.id::text, v_today, now(), now()
--   from customer_payments cp
--   where cp.payment_status ilike '%overdue%' or cp.payment_status ilike '%past due%'
--      or cp.payment_status ilike '%late%'
--      or (cp.next_payment_due_date is not null and cp.next_payment_due_date < current_date)
--   on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
--   do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
--                 context = excluded.context, sweep_date = excluded.sweep_date;
--   get diagnostics n_pay = row_count;
--
--   insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context,
--                              source_table, source_id, sweep_date, first_seen_at, last_seen_at)
--   select 'waitlist_contact', 'high', 'CHUMMO', w.customer_name, w.customer_phone::text, w.customer_email::text,
--          jsonb_build_object('days_waiting', (current_date - w.date_added_to_waitlist),
--            'vehicle_type', w.vehicle_type, 'make', w.make, 'model', w.model,
--            'desired_weekly', w.desired_weekly_payment, 'status', w.status),
--          'waitlist', w.id::text, v_today, now(), now()
--   from waitlist w
--   where w.status not in ('Fulfilled','Cancelled','Converted','Not Interested','Removed')
--     and w.date_added_to_waitlist is not null
--     and w.date_added_to_waitlist < current_date - 30
--   on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
--   do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
--                 context = excluded.context, sweep_date = excluded.sweep_date;
--   get diagnostics n_wait = row_count;
--
--   insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context,
--                              source_table, source_id, sweep_date, first_seen_at, last_seen_at)
--   select 'bgcheck_review', 'high', 'VISION', bc.customer_name, bc.phone_number::text, bc.email::text,
--          jsonb_build_object('eligibility_status', bc.eligibility_status,
--            'customer_id', bc.customer_id, 'review_notes', bc.review_notes),
--          'background_checks', bc.customer_id::text, v_today, now(), now()
--   from background_checks bc
--   where (bc.eligibility_status = 'Need Manager''s Review' or bc.eligibility_status is null)
--     and bc.customer_id is not null
--   on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
--   do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
--                 context = excluded.context, sweep_date = excluded.sweep_date;
--   get diagnostics n_bg = row_count;
--
--   insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context,
--                              source_table, source_id, sweep_date, first_seen_at, last_seen_at)
--   select 'lead_reengagement', 'medium', 'CHUMMO', l.contact_name,
--          coalesce(l.phone_e164, l.phone::text), l.email,
--          jsonb_build_object('created_on', l.created_at,
--            'days_old', (current_date - l.created_at::date), 'opportunity', l.opportunity_name),
--          'incoming_leads', l.id::text, v_today, now(), now()
--   from incoming_leads l
--   where (l.status is null or l.status in ('New','New Lead'))
--     and l.created_at < now() - interval '30 days'
--     and (l.phone is not null or l.phone_e164 is not null)
--     and l.email not ilike '%noreply%'
--   order by l.created_at asc, l.id asc
--   on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
--   do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
--                 context = excluded.context, sweep_date = excluded.sweep_date;
--   get diagnostics n_lead = row_count;
--
--   insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, context,
--                              source_table, source_id, sweep_date, first_seen_at, last_seen_at)
--   select 'ticket_collect', 'medium', 'CHUMMO', t.requested_by_customer, null,
--          jsonb_build_object('ticket_ids', array_agg(t.ticket_id),
--            'total_owed', sum(t.amount), 'violation_types', array_agg(distinct t.violation_type)),
--          'tickets', t.requested_by_customer, v_today, now(), now()
--   from tickets t
--   where t.amount > 0
--     and (t.status is null or t.status not in ('Closed','Resolved','Done'))
--     and t.requested_by_customer is not null
--   group by t.requested_by_customer
--   having sum(t.amount) >= 50
--   on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
--   do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
--                 context = excluded.context, sweep_date = excluded.sweep_date;
--   get diagnostics n_tick = row_count;
--
--   return jsonb_build_object(
--     'ok', true, 'version', 'v2', 'sweep_date', v_today,
--     'touched', jsonb_build_object('payment_followup', n_pay, 'waitlist_contact', n_wait,
--       'bgcheck_review', n_bg, 'lead_reengagement', n_lead, 'ticket_collect', n_tick),
--     'total_rows', (select count(*) from exec_va_tasks),
--     'open_with_identity', (select count(*) from exec_va_tasks where status='pending' and source_id is not null));
-- end;
-- $function$;
