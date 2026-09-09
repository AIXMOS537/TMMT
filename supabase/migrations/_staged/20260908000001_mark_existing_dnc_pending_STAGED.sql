-- 20260908000001_mark_existing_dnc_pending_STAGED
-- REC-120 (companion DRAIN) — status-only remediation of the PENDING backlog
-- that the new opt-out enqueue filter (20260908000000) does not retroactively
-- touch. Apply AFTER that migration, never before.
--
-- ============================ STAGED. NOT APPLIED. ==========================
-- Nothing in this file has run. No deletes anywhere in this file.
-- ===========================================================================
--
-- WHY THIS EXISTS ON TOP OF THE 2026-09-06 REMEDIATION
--
-- On 2026-09-06, `public.exec_va_tasks_dnc_remediation_20260906` moved 142
-- PENDING rows matching `do_not_contact_numbers` from status='pending' to
-- status='blocked_dnc' (payment_followup 138, lead_reengagement 4,
-- waitlist_contact 0). bgcheck_review was deliberately excluded (internal
-- VISION review, not outbound contact) and ticket_collect has no
-- subject_phone to test. See vault/07-Ventures/AIXMOS/
-- PART-37-EXEC-VA-TASKS-CORPUS-AUDIT-2026-09-03.md, REV 5.
--
-- That remediation covered `do_not_contact_numbers` only. It did NOT cover
-- `incoming_leads.opted_out` — a person who has since texted STOP may still
-- have a PENDING task from before the 09-08 enqueue-time opt-out filter
-- landed. This migration closes that gap, and is a safe no-op re-run of the
-- DNC half (WHERE status='pending' means already-blocked_dnc rows are
-- untouched either way).
--
-- SCOPE — identical categories to the enqueue filter and the 09-06 remediation:
--   payment_followup, waitlist_contact, lead_reengagement   TARGETED
--   bgcheck_review, ticket_collect                          EXCLUDED (see above)
--
-- SAFETY
--   * No deletes. Only `status` and `handled_at` are written.
--   * Only rows currently status='pending' are touched (won't re-block or
--     disturb rows already handled/blocked/in any other state).
--   * A ledger table (public.exec_va_tasks_optout_remediation_20260908)
--     captures prev_status/prev_handled_at per row so this is fully
--     reversible, mirroring the 09-06 pattern
--     (vault/02-Needs-You/rollback/exec_va_tasks_DNC-BACKLOG-REMEDIATION.20260906.sql).
--   * Single atomic statement per phase; counts are asserted after.
--
-- MATCHING — same normalized-phone form used everywhere else in this system:
--     right(regexp_replace(<phone>,'\D','','g'), 10)
--
-- ── PRE-APPLY CHECK (REQUIRED, read-only) ───────────────────────────────────
-- Run first and eyeball the counts before applying:
--
--   select t.category, count(*)
--     from exec_va_tasks t
--    where t.status = 'pending'
--      and t.subject_phone is not null
--      and t.category in ('payment_followup','waitlist_contact','lead_reengagement')
--      and (
--        exists (select 1 from do_not_contact_numbers d
--                 where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10))
--        or exists (select 1 from incoming_leads ol
--                    where ol.opted_out
--                      and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text),'\D','','g'),10)
--                          = right(regexp_replace(t.subject_phone,'\D','','g'),10))
--      )
--    group by t.category;
--
-- Confirm bgcheck_review is NOT in that result set (it must never be, since
-- the WHERE clause above deliberately omits it).

begin;

create table if not exists public.exec_va_tasks_optout_remediation_20260908 (
  task_id        uuid not null,
  prev_status    text not null,
  prev_handled_at timestamptz,
  category       text not null,
  phone10        text,
  matched_reason text not null,      -- 'do_not_contact_numbers' | 'opted_out'
  remediated_at  timestamptz not null default now(),
  batch          text not null default 'optout_backlog_20260908',
  primary key (task_id, batch)
);

with target as (
  select t.id,
         t.status as prev_status,
         t.handled_at as prev_handled_at,
         t.category,
         right(regexp_replace(t.subject_phone,'\D','','g'),10) as phone10,
         case
           when exists (
             select 1 from do_not_contact_numbers d
              where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10)
           ) then 'do_not_contact_numbers'
           else 'opted_out'
         end as matched_reason
    from exec_va_tasks t
   where t.status = 'pending'
     and t.subject_phone is not null
     and t.category in ('payment_followup','waitlist_contact','lead_reengagement')
     and (
       exists (
         select 1 from do_not_contact_numbers d
          where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10)
       )
       or exists (
         select 1 from incoming_leads ol
          where ol.opted_out
            and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text),'\D','','g'),10)
                = right(regexp_replace(t.subject_phone,'\D','','g'),10)
       )
     )
),
logged as (
  insert into public.exec_va_tasks_optout_remediation_20260908
    (task_id, prev_status, prev_handled_at, category, phone10, matched_reason)
  select id, prev_status, prev_handled_at, category, phone10, matched_reason
    from target
  returning task_id
)
update exec_va_tasks t
   set status = 'blocked_dnc',
       handled_at = now()
  from logged l
 where t.id = l.task_id;

-- ── POST-APPLY VERIFICATION (read-only) ─────────────────────────────────────
-- select count(*) from public.exec_va_tasks_optout_remediation_20260908
--  where batch = 'optout_backlog_20260908';   -- rows this batch touched
--
-- select count(*) filter (where t.status='pending'
--          and t.category in ('payment_followup','waitlist_contact','lead_reengagement')
--          and (exists (select 1 from do_not_contact_numbers d
--                        where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10))
--            or exists (select 1 from incoming_leads ol
--                        where ol.opted_out
--                          and right(regexp_replace(coalesce(ol.phone_e164, ol.phone::text),'\D','','g'),10)
--                              = right(regexp_replace(t.subject_phone,'\D','','g'),10))))
--          as still_eligible_pending  -- expect 0
--   from exec_va_tasks t;
--
-- select count(*) filter (where category='bgcheck_review' and status='pending')
--          as bgcheck_pending_untouched  -- expect unchanged from pre-apply (120 as of 2026-09-06)
--   from exec_va_tasks;

commit;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- Restores ONLY the rows this batch touched, to their exact prior status and
-- handled_at. Does not touch rows that moved on to another state since.
--
-- select count(*) as ledger_rows,
--        count(*) filter (where t.status = 'blocked_dnc') as still_blocked,
--        count(*) filter (where t.status <> 'blocked_dnc') as changed_since_remediation
--   from public.exec_va_tasks_optout_remediation_20260908 r
--   join public.exec_va_tasks t on t.id = r.task_id
--  where r.batch = 'optout_backlog_20260908';
--
-- update public.exec_va_tasks t
--    set status = r.prev_status,
--        handled_at = r.prev_handled_at
--   from public.exec_va_tasks_optout_remediation_20260908 r
--  where t.id = r.task_id
--    and r.batch = 'optout_backlog_20260908'
--    and t.status = 'blocked_dnc';
--
-- drop table if exists public.exec_va_tasks_optout_remediation_20260908;
-- (drop only after the revert is confirmed correct and no longer needed as a record)
