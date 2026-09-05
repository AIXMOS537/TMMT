-- Applied to production 2026-09-03 (version 20260903193844) with owner approval.
--
-- Triage dimension for exec_va_tasks. Deliberately SEPARATE from lifecycle `status`.
--   status = where is this task in its life?   (pending -> handled)
--   triage = who is allowed to act on it?      (auto | needs_approval | ignore)
--
-- Collapsing them is what makes a queue unreadable: you cannot ask "how many
-- things need the owner?" without parsing a state machine.
--
-- Additive only: nullable columns, partial indexes, check constraints. No data
-- written by this migration.
--
-- Evidence and rationale: SYSTEM_AUDIT_2026/40_AIXMOS_TRIAGE_CONTROL_PLANE.md

alter table public.exec_va_tasks
  add column if not exists triage             text,
  add column if not exists triage_reason      text,
  add column if not exists triage_confidence  numeric(3,2),
  add column if not exists triaged_at         timestamptz,
  add column if not exists triaged_by         text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exec_va_tasks_triage_chk') then
    alter table public.exec_va_tasks
      add constraint exec_va_tasks_triage_chk
      check (triage is null or triage in ('auto','needs_approval','ignore'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exec_va_tasks_triage_conf_chk') then
    alter table public.exec_va_tasks
      add constraint exec_va_tasks_triage_conf_chk
      check (triage_confidence is null or (triage_confidence >= 0 and triage_confidence <= 1));
  end if;
end $$;

-- The CEO decision queue is one index scan: triage='needs_approval'.
create index if not exists exec_va_tasks_needs_approval_idx
  on public.exec_va_tasks (category, priority, sweep_date desc)
  where triage = 'needs_approval';

create index if not exists exec_va_tasks_triage_idx
  on public.exec_va_tasks (triage, category)
  where triage is not null;

comment on column public.exec_va_tasks.triage is
  'Authority recommendation, independent of lifecycle status. auto = eligible for future automation (NOT execute-now); needs_approval = owner gate; ignore = no action. Written only by classify_va_tasks().';
comment on column public.exec_va_tasks.triage_reason is
  'Which rule fired. Stable identifier, safe to group by.';
comment on column public.exec_va_tasks.triage_confidence is
  '0..1. Below 0.90 means the rule leaned on a fuzzy match and deserves a human look.';
comment on column public.exec_va_tasks.triaged_by is
  'Provenance: ruleset identifier, e.g. "ruleset/v1". Not a person.';
