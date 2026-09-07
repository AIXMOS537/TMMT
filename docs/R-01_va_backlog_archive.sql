-- ============================================================================
-- R-01 · VA TASK BACKLOG — LEGACY ROW ARCHIVE (P0 remediation track)
-- Status: PREPARED, NOT APPLIED. Requires "AUTHORIZED: R-01 — <option> — production".
-- Target: public.exec_va_tasks, Supabase project uapxakmlwnpfsftfeezx
--
-- ROOT CAUSE (VERIFIED 2026-09-07)
--   The pre-Sep-5 task generator wrote rows with source_id = NULL. The dedupe
--   index exec_va_tasks_source_identity_uidx is partial:
--     UNIQUE (category, source_table, source_id) WHERE source_id IS NOT NULL AND status='pending'
--   so NULL-source rows were never deduplicated and accumulated on every sweep.
--   generate_va_tasks_v2 (Sep 5+) writes a source_id; its 817 rows dedupe correctly.
--
-- CURRENT STATE (VERIFIED 2026-09-07)
--   source_id NULL     status pending      18,100   created 2026-06-22 .. 2026-09-05   <- legacy noise
--   source_id NULL     status blocked_dnc     180   created 2026-06-22 .. 2026-09-05   <- legacy noise
--   source_id NOT NULL status pending         810   created 2026-09-05 .. 2026-09-06   <- live, keep
--   source_id NOT NULL status blocked_dnc       7   created 2026-09-06                 <- live, keep
--
-- BLAST RADIUS (VERIFIED): no foreign keys reference exec_va_tasks; no views or
--   triggers depend on it; one RLS policy (service_role_all). Only consumers are
--   the VA queue screens/functions that filter on status/triage.
--
-- PREDICATE (identical in every option; never touches keyed rows):
--   source_id IS NULL AND status IN ('pending','blocked_dnc')
--
-- OPTION A (RECOMMENDED — no rows leave the table, no DELETE anywhere)
--   Flip legacy rows to status 'archived_legacy' and stamp result with why.
--   The status index makes pending queries skip them immediately.
--   Reversible with a single UPDATE (see ROLLBACK A).
--
-- OPTION B (physical move — only if the owner wants the table small)
--   Copy legacy rows into exec_va_tasks_archive_legacy, then remove them from the
--   live table in the same transaction. Reversible by re-inserting (ROLLBACK B).
--   This IS a delete from the live table; choose it only with explicit authorization.
--
-- Both options run in ONE transaction and print before/after counts.
-- Run with:  psql --single-transaction -v ON_ERROR_STOP=1 -f R-01_va_backlog_archive.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Pre-flight (SELECT-only; run alone first and compare to the numbers above)
-- ---------------------------------------------------------------------------
select (source_id is null) as null_source, status, count(*) as n
  from public.exec_va_tasks group by 1,2 order by 1,2;

-- ---------------------------------------------------------------------------
-- OPTION A — status flip (default). Comment out if using Option B.
-- ---------------------------------------------------------------------------
update public.exec_va_tasks
   set status     = 'archived_legacy',
       handled_at = coalesce(handled_at, now()),
       result     = coalesce(result, '{}'::jsonb)
                    || jsonb_build_object(
                         'archived_by',     'R-01',
                         'archived_at',     now(),
                         'previous_status', status,
                         'reason',          'legacy generator row (source_id null) — superseded by generate_va_tasks_v2')
 where source_id is null
   and status in ('pending','blocked_dnc');

-- Post-check: expect 18,280 archived_legacy; pending should now be 810, blocked_dnc 7.
select status, count(*) from public.exec_va_tasks group by 1 order by 1;

-- ROLLBACK A (run inside a transaction):
--   update public.exec_va_tasks
--      set status = result->>'previous_status',
--          handled_at = null,
--          result = result - 'archived_by' - 'archived_at' - 'previous_status' - 'reason'
--    where status = 'archived_legacy' and result->>'archived_by' = 'R-01';

-- ---------------------------------------------------------------------------
-- OPTION B — physical move (ONLY with explicit authorization; do not run with A)
-- ---------------------------------------------------------------------------
-- create table if not exists public.exec_va_tasks_archive_legacy
--   (like public.exec_va_tasks including defaults including constraints);
-- alter table public.exec_va_tasks_archive_legacy enable row level security;
-- with moved as (
--   delete from public.exec_va_tasks
--    where source_id is null and status in ('pending','blocked_dnc')
--    returning *)
-- insert into public.exec_va_tasks_archive_legacy select * from moved;
-- select (select count(*) from public.exec_va_tasks_archive_legacy) as archived,
--        (select count(*) from public.exec_va_tasks) as remaining;   -- expect 18280 / 817
--
-- ROLLBACK B:
--   insert into public.exec_va_tasks select * from public.exec_va_tasks_archive_legacy;
--   drop table public.exec_va_tasks_archive_legacy;

-- ---------------------------------------------------------------------------
-- PREVENTION (separate package; not part of R-01):
--   Make source_id NOT NULL for new rows once generate_va_tasks_v2 is the only
--   writer, or add a second partial unique index covering the NULL case via
--   coalesce(source_id, subject_phone||'/'||subject_email). BUSINESS DECISION:
--   which identity should dedupe a task when the generator has no source row?
-- ---------------------------------------------------------------------------
