-- ============================================================================
-- STAGED — NOT APPLIED. Chain of Trust: stage never sign.
--
-- The durable fix: idempotent work generation.
--
-- The classifier (20260904000000) treats a symptom. THIS treats the cause.
-- Today `generate_va_tasks()` INSERTs the same subjects every day. 58 sweeps
-- produced 17,806 rows describing 364 subjects — a 49x duplication factor, and
-- it grows ~300 rows/day forever. No classifier can fix that; it can only
-- reconstruct reality afterwards.
--
-- Target:   source row -> stable identity -> one durable work item -> upsert
-- Current:  source row -> daily INSERT -> daily INSERT -> ...
--
-- SAFETY: this migration changes how work items are CREATED. It does not send,
-- charge, approve, execute or delete. It does not activate or reschedule cron.
-- Existing rows are left exactly where they are.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. WHY NOT `UNIQUE (category, subject_key)`
--
-- The obvious key is a composite of name|phone|email. Measured against
-- production 2026-09-03, that key is NOT stable for leads:
--
--   latest lead_reengagement subjects            163
--   ...matching MORE THAN ONE incoming_leads row  64   <-- 39%
--
-- One email maps to several distinct lead rows. A unique constraint on the
-- composite would silently COLLAPSE distinct leads into one work item, which is
-- worse than duplicating them: duplication is visible, collapse is not.
--
-- So identity comes from the SOURCE ROW, not from the person's contact details.
-- ---------------------------------------------------------------------------
alter table public.exec_va_tasks
  add column if not exists source_table text,
  add column if not exists source_id    text,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at  timestamptz,
  add column if not exists seen_count    integer not null default 1;

comment on column public.exec_va_tasks.source_table is
  'Origin table of the fact that created this task. With source_id it forms the durable identity.';
comment on column public.exec_va_tasks.source_id is
  'Primary key of the origin row, as text. NOT a contact detail -- name/phone/email are not unique (39% of lead subjects match multiple source rows).';
comment on column public.exec_va_tasks.seen_count is
  'How many sweeps have re-observed this same work item. Replaces creating a new row per sweep.';

-- Partial unique index: one live work item per source row per category.
-- Partial, so historical rows (source_id null) are untouched and closed items
-- can legitimately recur later.
create unique index if not exists exec_va_tasks_source_identity_uidx
  on public.exec_va_tasks (category, source_table, source_id)
  where source_id is not null and status = 'pending';


-- ---------------------------------------------------------------------------
-- 2. Backfill identity for the CURRENT open items only.
--
-- Deliberately scoped to the latest sweep per (category, subject). The 17,397
-- superseded rows keep source_id NULL and stay exactly as they are -- they are
-- history, and the partial index ignores them.
--
-- lead_reengagement is EXCLUDED from backfill: its subject cannot be resolved
-- to a single source row (see section 1). Those get identity going forward,
-- when the generator records it at insert time.
-- ---------------------------------------------------------------------------
with keyed as (
  select t.id, t.category, t.sweep_date, t.created_at, t.context, t.subject_phone, t.subject_name,
         coalesce(t.subject_name,'~')||'|'||coalesce(t.subject_phone,'~')||'|'||coalesce(t.subject_email,'~') as sk
  from public.exec_va_tasks t
  where t.status = 'pending'
),
latest as (
  select * from (
    select k.*, row_number() over (partition by k.category, k.sk
                                   order by k.sweep_date desc, k.created_at desc, k.id) rn
    from keyed k) z where rn = 1
)
update public.exec_va_tasks t
   set source_table = v.src_table,
       source_id    = v.src_id,
       first_seen_at = coalesce(t.first_seen_at, t.created_at),
       last_seen_at  = coalesce(t.last_seen_at, t.created_at)
  from latest l
  cross join lateral (
    select case when l.category = 'bgcheck_review' then 'background_checks' end as src_table,
           case when l.category = 'bgcheck_review' then (l.context->>'customer_id') end as src_id
  ) v
 where t.id = l.id
   and v.src_id is not null;


-- ---------------------------------------------------------------------------
-- 3. The generator, made idempotent.
--
-- Change in one sentence: INSERT ... ON CONFLICT DO UPDATE, keyed on source
-- identity, bumping last_seen_at/seen_count instead of creating a new row.
--
-- Only bgcheck_review is converted here, because it is the only category whose
-- source row can be identified today (context carries customer_id, join proven
-- 132/132). The other four still INSERT as before, and are marked TODO -- they
-- need their source primary key threaded through first. Converting them without
-- a real key is what would cause silent collapse.
--
-- This is deliberately a PARTIAL fix. A partial fix that is honest about its
-- boundary beats a complete one that guesses at identity.
-- ---------------------------------------------------------------------------
create or replace function public.generate_va_tasks_v2()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_today date := current_date;
  v_upserted int := 0;
begin
  -- bgcheck_review: identity = background_checks.customer_id
  insert into exec_va_tasks
    (category, priority, agent, subject_name, subject_phone, subject_email, context,
     source_table, source_id, sweep_date, first_seen_at, last_seen_at, seen_count)
  select 'bgcheck_review', 'high', 'VISION',
         bc.customer_name, bc.phone_number::text, bc.email::text,
         jsonb_build_object('eligibility_status', bc.eligibility_status,
                            'customer_id', bc.customer_id,
                            'review_notes', bc.review_notes),
         'background_checks', bc.customer_id::text, v_today, now(), now(), 1
  from background_checks bc
  where bc.eligibility_status = 'Need Manager''s Review'
     or bc.eligibility_status is null
  on conflict (category, source_table, source_id) where (source_id is not null and status = 'pending')
  do update set
     last_seen_at = now(),
     seen_count   = exec_va_tasks.seen_count + 1,
     context      = excluded.context,      -- refresh the source snapshot
     sweep_date   = excluded.sweep_date;
  get diagnostics v_upserted = row_count;

  -- TODO: payment_followup, waitlist_contact, lead_reengagement, ticket_collect
  -- still need their source primary key carried into source_id before they can
  -- be converted. Until then they are NOT generated here -- v2 is additive and
  -- deliberately incomplete rather than wrong.

  return jsonb_build_object(
    'ok', true,
    'version', 'v2',
    'sweep_date', v_today,
    'categories_converted', jsonb_build_array('bgcheck_review'),
    'upserted', v_upserted,
    'open_items', (select count(*) from exec_va_tasks where status='pending' and source_id is not null)
  );
end;
$function$;

revoke all on function public.generate_va_tasks_v2() from public, anon, authenticated;
grant execute on function public.generate_va_tasks_v2() to service_role;

comment on function public.generate_va_tasks_v2() is
  'Idempotent replacement for generate_va_tasks(). Upserts on (category, source_table, source_id) and bumps seen_count instead of inserting a new row per sweep. Covers bgcheck_review only; the other four categories need a real source key first. Does not schedule itself.';


-- ============================================================================
-- POSTCONDITIONS — the state, not the return value.
-- ============================================================================
-- a) identity backfilled only for open bgcheck items, history untouched
--    select category, count(*) filter (where source_id is not null) as with_identity,
--           count(*) filter (where source_id is null) as history
--      from exec_va_tasks group by 1;
--    -- expect: only bgcheck_review has with_identity > 0; history ~17,442 unchanged
--
-- b) the unique index actually prevents a duplicate
--    select public.generate_va_tasks_v2();   -- run twice
--    select public.generate_va_tasks_v2();   -- second call must NOT grow the table
--    select count(*) from exec_va_tasks;     -- compare before/after: equal
--
-- c) seen_count is incrementing rather than rows accumulating
--    select max(seen_count), count(*) from exec_va_tasks where source_id is not null;
--
-- d) lifecycle and triage untouched by generation
--    select status, count(*) from exec_va_tasks group by 1;
--
-- e) cron NOT changed -- job 2 still calls the OLD generate_va_tasks().
--    Cutting over is a separate, explicit owner decision:
--      select cron.unschedule(2);
--      select cron.schedule('generate_va_tasks_v2','0 12 * * *',
--                           'select public.generate_va_tasks_v2();');
--    Do NOT do this until (b) has been observed twice.
--
-- f) advisors: v2 is SECURITY DEFINER (it must read background_checks under
--    cron), so it WILL appear in the definer list. It is revoked from
--    public/anon/authenticated and granted only to service_role -- confirm:
--    select has_function_privilege('anon','public.generate_va_tasks_v2()','EXECUTE');
--    -- expect false
-- ============================================================================
