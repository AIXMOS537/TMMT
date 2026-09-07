-- CRON_EXECUTION_EVIDENCE.sql — READ-ONLY companion to the measurement packet.
--
-- ⚠ DELIBERATELY A SEPARATE FILE.
--   OWNER_MEASUREMENT_PACKET_20260906.sql is pinned at SHA-256
--   b61cae59e3bb7d984d524cce5a4831e92c458a66674d5bacd2b64fddffe3642d.
--   Adding these queries to that file would change its hash and BREAK the
--   integrity gate. Never edit the packet. Run this alongside it.
--
-- PURPOSE: distinguish the four states the closure report must separate.
--   1. cron scheduled      2. cron actually executed
--   3. execution succeeded 4. resulting data stayed idempotent
-- An unchanged row count proves NOTHING unless (2) and (3) are established.

-- ── C1 · was the job scheduled, and is it still pointing at v2? ─────────────
select 'C1 schedule' as q, jobid, jobname, schedule, active,
       left(command, 60) as command
from cron.job
where jobname = 'aixmos_daily_va_sweep';
-- Expect: schedule '0 12 * * *', active true, command generate_va_tasks_v2().
-- If command still names the OLD generate_va_tasks(), the cutover regressed.

-- ── C2 · did it actually RUN, and did it SUCCEED? ──────────────────────────
select 'C2 runs' as q, jobid, status, start_time, end_time,
       end_time - start_time as duration,
       left(coalesce(return_message,''), 80) as return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'aixmos_daily_va_sweep')
  and start_time >= date '2026-09-06'
order by start_time desc
limit 10;
-- NO ROW for 2026-09-07 12:00 UTC  => the sweep did NOT run. An unchanged row
--   count is then meaningless as idempotency evidence — it means nothing tried.
-- status 'failed'                  => investigate return_message before any
--   idempotency conclusion. A failed sweep also leaves the count unchanged.
-- status 'succeeded'               => (2) and (3) established; only then does
--   the row count carry evidential weight.

-- ── C3 · what did the sweep actually do to the table? ──────────────────────
select 'C3 table state' as q,
       count(*)                                             as total_rows,
       max(sweep_date)                                      as max_sweep_date,
       count(*) filter (where sweep_date = date '2026-09-07') as rows_stamped_0907,
       count(*) filter (where sweep_date = date '2026-09-06') as rows_stamped_0906,
       max(created_at)                                      as newest_row,
       max(last_seen_at)                                    as newest_last_seen
from exec_va_tasks;
-- The DISCRIMINATOR between "idempotent" and "did not run":
--   idempotent v2 does ON CONFLICT DO UPDATE, which BUMPS last_seen_at and
--   seen_count and REWRITES sweep_date WITHOUT inserting.
--   So a successful idempotent sweep shows:
--     total_rows unchanged (~19,097)
--     AND max_sweep_date = 2026-09-07
--     AND newest_last_seen on 2026-09-07
--   Whereas a sweep that never ran shows:
--     total_rows unchanged AND max_sweep_date still 2026-09-06.
--   Same row count, opposite meaning. This is the check that separates them.

-- ── C4 · seen_count corroboration ──────────────────────────────────────────
select 'C4 seen_count' as q,
       count(*) filter (where seen_count > 1) as rows_seen_more_than_once,
       max(seen_count)                        as max_seen_count,
       count(*) filter (where source_id is not null) as rows_with_identity
from exec_va_tasks;
-- Rising seen_count on identity-bearing rows is positive evidence the upsert
-- path ran and updated rather than inserted.
