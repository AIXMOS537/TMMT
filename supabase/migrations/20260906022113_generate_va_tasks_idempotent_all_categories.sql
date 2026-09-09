-- Applied to production 2026-09-06 (version 20260906022113) with owner approval.
-- Statements below are what ran; only comment text differs from the applied copy.
--
-- PROVEN IDEMPOTENT before cron was resumed: ran three times, table went
-- 18,420 -> 18,587 (one-time, for categories with no backfillable identity)
-- -> 18,587 -> 18,587. seen_count distribution {3:167, 4:140} shows rows being
-- re-observed instead of re-inserted. 0 duplicate identities.
--
-- Idempotent VA task generation — all five categories.
--
-- CAUSE: generate_va_tasks() INSERTs the same subjects every sweep. 60 sweeps
-- produced 18,420 rows describing 364 subjects. The daily arithmetic is exact:
--   payment_followup 26 + waitlist_contact 37 + bgcheck_review 136
--   + lead_reengagement 100 (capped) + ticket_collect 8  =  307 rows/day.
--
-- FIX: source row -> stable identity -> one durable work item -> upsert.
--
-- The earlier staged draft covered bgcheck_review only, on the belief that the
-- other categories had no usable source key. That is true when BACKFILLING from
-- an existing row's context, but not when GENERATING: the generator already
-- holds the source row, so it can record the key at insert time. All five
-- source tables have a uuid primary key (verified).
--
-- SAFETY: changes how work items are CREATED. Does not send, charge, approve,
-- execute or delete. Writes no lifecycle column (status/handled_at/result).
-- Leaves all 18,420 existing rows exactly where they are.

-- 1. Identity columns -------------------------------------------------------
alter table public.exec_va_tasks
  add column if not exists source_table   text,
  add column if not exists source_id      text,
  add column if not exists first_seen_at  timestamptz,
  add column if not exists last_seen_at   timestamptz,
  add column if not exists seen_count     integer not null default 1;

comment on column public.exec_va_tasks.source_table is
  'Origin table of the fact behind this task. With source_id it forms the durable identity.';
comment on column public.exec_va_tasks.source_id is
  'Primary key of the origin row as text (ticket_collect: the aggregate grouping key). NEVER a contact detail -- 39% of lead subjects match multiple source rows, so name/phone/email would silently COLLAPSE distinct subjects.';
comment on column public.exec_va_tasks.seen_count is
  'How many sweeps re-observed this same item. Replaces creating a new row per sweep.';

-- One live work item per source row per category. Partial, so the 18k
-- historical rows (source_id null) are untouched and a closed item may recur.
create unique index if not exists exec_va_tasks_source_identity_uidx
  on public.exec_va_tasks (category, source_table, source_id)
  where source_id is not null and status = 'pending';

-- 2. Backfill identity where it can be PROVEN from the existing row ----------
-- Only the newest pending row per subject, and only where context carries a
-- real key. bgcheck: context->>'customer_id' (136/136 distinct, 0 null).
-- ticket_collect: the aggregate key IS subject_name.
-- payment_followup / waitlist_contact / lead_reengagement are deliberately NOT
-- backfilled -- their context holds no source key, and matching on contact
-- details is the exact collapse this design refuses. They acquire identity
-- going forward; their stale pending rows age out via the classifier's
-- superseded_by_later_sweep rule.
with latest as (
  select id, category, context, subject_name, created_at,
         row_number() over (
           partition by category,
             coalesce(subject_name,'~')||'|'||coalesce(subject_phone,'~')||'|'||coalesce(subject_email,'~')
           order by sweep_date desc, created_at desc, id) as rn
  from public.exec_va_tasks
  where status = 'pending'
)
update public.exec_va_tasks t
   set source_table  = v.src_table,
       source_id     = v.src_id,
       first_seen_at = coalesce(t.first_seen_at, t.created_at),
       last_seen_at  = coalesce(t.last_seen_at,  t.created_at)
  from latest l
  cross join lateral (
    select case l.category when 'bgcheck_review' then 'background_checks'
                           when 'ticket_collect' then 'tickets' end,
           case l.category when 'bgcheck_review' then l.context->>'customer_id'
                           when 'ticket_collect' then l.subject_name end
  ) v(src_table, src_id)
 where t.id = l.id and l.rn = 1 and v.src_id is not null;

-- 3. The generator, made idempotent -----------------------------------------
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

  -- 1. payment_followup <- customer_payments.id
  insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, context,
                             source_table, source_id, sweep_date, first_seen_at, last_seen_at)
  select 'payment_followup', 'urgent', 'CHUMMO', cp.customer, cp.customer_phone_number::text,
         jsonb_build_object('amount', cp.amount, 'past_due', cp.amout_past_due,
           'last_payment', cp.last_payment_date, 'next_due', cp.next_payment_due_date,
           'payment_status', cp.payment_status, 'notes', cp.notes),
         'customer_payments', cp.id::text, v_today, now(), now()
  from customer_payments cp
  where cp.payment_status ilike '%overdue%' or cp.payment_status ilike '%past due%'
     or cp.payment_status ilike '%late%'
     or (cp.next_payment_due_date is not null and cp.next_payment_due_date < current_date)
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_pay = row_count;

  -- 2. waitlist_contact <- waitlist.id
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
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_wait = row_count;

  -- 3. bgcheck_review <- background_checks.customer_id
  -- customer_id (not bc.id) so new rows match the section-2 backfill, which can
  -- only recover customer_id from context. Verified unique: 136/136, 0 null.
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

  -- 4. lead_reengagement <- incoming_leads.id
  -- ORDER BY added: the original LIMIT 100 had no ORDER BY. Under an upsert a
  -- nondeterministic cap would mint a different 100 identities every sweep --
  -- idempotency in name only. Oldest-first is stable and matches the intent
  -- (re-engage the most stale leads).
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
  order by l.created_at asc, l.id asc
  limit 100
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set last_seen_at = now(), seen_count = exec_va_tasks.seen_count + 1,
                context = excluded.context, sweep_date = excluded.sweep_date;
  get diagnostics n_lead = row_count;

  -- 5. ticket_collect <- the aggregate grouping key
  -- This category has no single source row: it rolls up every open ticket per
  -- customer. Its identity is therefore the generator's OWN grouping key.
  -- That is not the forbidden contact-detail match -- the grouping already
  -- defines the work item.
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
    'open_with_identity', (select count(*) from exec_va_tasks where status='pending' and source_id is not null)
  );
end;
$function$;

revoke all on function public.generate_va_tasks_v2() from public, anon, authenticated;
grant execute on function public.generate_va_tasks_v2() to service_role;

comment on function public.generate_va_tasks_v2() is
  'Idempotent replacement for generate_va_tasks(). Upserts on (category, source_table, source_id), bumping seen_count instead of inserting a row per sweep. Covers all five categories. Writes no lifecycle column and does not schedule itself.';
