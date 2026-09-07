-- Exported from production migration history (20260907100043).
-- Source of truth: supabase_migrations.schema_migrations.
-- Do not edit by hand — re-run scripts/migrations-pull.mjs instead.

-- S3-03b · post-advisor hardening for the S3-03 objects
-- resolve_person_id is only called from record_decision_event (SECURITY DEFINER); no RPC caller needs it.
revoke execute on function public.resolve_person_id(text, text) from authenticated;
-- Index the remaining FKs on the new tables/columns (cheap now; tables are empty/small).
create index if not exists decision_events_org_idx        on public.decision_events(org_id);
create index if not exists decision_events_reason_idx     on public.decision_events(reason_code) where reason_code is not null;
create index if not exists decision_events_program_idx    on public.decision_events(product_program) where product_program is not null;
create index if not exists background_checks_last_event_idx on public.background_checks(last_decision_event_id) where last_decision_event_id is not null;
create index if not exists background_checks_reason_idx   on public.background_checks(reason_code) where reason_code is not null;
-- Legacy VA rows are now archived_legacy; keep the hot queue scans tight.
create index if not exists exec_va_tasks_live_queue_idx   on public.exec_va_tasks(status, sweep_date desc) where status in ('pending','blocked_dnc');
