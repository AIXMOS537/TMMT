# Rollback paths — applied 2026-09-07 (project uapxakmlwnpfsftfeezx)

Order to undo everything (reverse of apply):

1. S3-07b: `select cron.unschedule('aixmos_nightly_journey_recompute'); drop function public.recompute_all_journeys();`
2. S3-03b: `drop index if exists decision_events_org_idx, decision_events_reason_idx, decision_events_program_idx, background_checks_last_event_idx, background_checks_reason_idx, exec_va_tasks_live_queue_idx; grant execute on function public.resolve_person_id(text,text) to authenticated;`
3. S3-07: run `S3-07_down.sql` (restores original compute_good_standing verbatim, drops v_customer_standing). Note: S3-07b must be removed first (its function reads the view).
4. R-01: `update public.exec_va_tasks set status = result->>'previous_status', handled_at = null, result = result - 'archived_by' - 'archived_at' - 'previous_status' - 'reason' where status='archived_legacy' and result->>'archived_by'='R-01';`
5. S3-03: run `S3-03_down.sql` (archives decision_events, drops new objects, recreates bg_check_decide(uuid,text,text) verbatim).

Then delete the corresponding rows from supabase_migrations.schema_migrations (versions 20260907*) so `supabase db push` stays consistent.

# Repo sync (do this before the next `supabase db push`)
Copy the three .sql files in this folder into `supabase/migrations/` with these exact filenames, plus a file for s3_03b (version from `select version from supabase_migrations.schema_migrations where name='s3_03b_hardening_indexes'`). Otherwise the CLI will report remote migrations missing locally.

## 2026-09-07 sync

DONE in this commit. `supabase/migrations/` now holds all four files with their PROD version numbers
(`20260907035109`, `20260907095915`, `20260907100002`, `20260907100043`). Their bodies were pulled from
`supabase_migrations.schema_migrations.statements` and md5-verified against production; they are NOT copies
of the annotated `.sql` files in this folder (those are the prepared packages, whose header comments differ
from what was actually applied). `supabase/schema/live-ledger-2026-09-07.tsv` records all 240 applied versions.
