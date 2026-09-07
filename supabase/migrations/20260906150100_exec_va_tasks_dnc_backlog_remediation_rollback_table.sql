-- 20260906150100_exec_va_tasks_dnc_backlog_remediation_rollback_table
-- APPLIED TO PRODUCTION 2026-09-06 via MCP apply_migration. Repo reconciliation.
create table if not exists public.exec_va_tasks_dnc_remediation_20260906 (
  task_id           uuid primary key,
  prev_status       text        not null,
  prev_handled_at   timestamptz,
  category          text        not null,
  phone10           text        not null,
  remediated_at     timestamptz not null default now(),
  batch             text        not null default 'dnc_backlog_20260906'
);
comment on table public.exec_va_tasks_dnc_remediation_20260906 is
  'Rollback ledger: rows moved pending -> blocked_dnc by the 2026-09-06 DNC backlog remediation. Scope mirrors generate_va_tasks_v2 enqueue policy (payment_followup, waitlist_contact, lead_reengagement only). bgcheck_review deliberately excluded.';
alter table public.exec_va_tasks_dnc_remediation_20260906 enable row level security;
-- DATA MUTATION performed separately (142 rows pending -> blocked_dnc), NOT in
-- this migration. Rollback: vault/02-Needs-You/rollback/exec_va_tasks_DNC-BACKLOG-REMEDIATION.20260906.sql
