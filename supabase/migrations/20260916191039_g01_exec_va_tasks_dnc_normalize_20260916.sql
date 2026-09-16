-- G-01 (owner-approved 2026-09-16): normalize 71 dismissed lead_reengagement
-- tasks whose phone is now on do_not_contact_numbers from status 'pending' to
-- 'blocked_dnc'. Status only: handled_at, triage_*, result, and all task data
-- are untouched. Per-row prior state is kept in an audit table (no PII copied).
--
-- APPLIED to prod (uapxakmlwnpfsftfeezx) on 2026-09-16 as ledger version
-- 20260916191039. The exact applied body is kept verbatim, as the historical
-- record, in docs/repairs/g01-exec-va-tasks-dnc-normalize.applied.sql.
--
-- This repo form differs from the applied body ONLY so a fresh environment can
-- build (same convention as the other rehearsed repair migrations):
--   * prerequisites missing (exec_va_tasks / do_not_contact_numbers) -> notice, skip, create nothing
--   * no matching pending rows (fresh or already-normalized DB)       -> notice, skip the data step
--   * matching rows that are NOT the verified 71 (id-set md5)         -> abort, exactly as applied
--   * the verified 71                                                  -> same writes as applied
-- Rehearsed by scripts/tests/sql/g01-migration.rehearsal.mjs.
--
-- ROLLBACK (prod):
--   update public.exec_va_tasks t set status = r.prev_status
--     from public.exec_va_tasks_dnc_remediation_20260916 r
--    where t.id = r.task_id and t.status = 'blocked_dnc';

do $$
declare
  v_md5 text;
  v_n   int;
begin
  if to_regclass('public.exec_va_tasks') is null or to_regclass('public.do_not_contact_numbers') is null then
    raise notice 'G-01 skipped: exec_va_tasks / do_not_contact_numbers not present (fresh environment)';
    return;
  end if;

  create table if not exists public.exec_va_tasks_dnc_remediation_20260916 (
    task_id            uuid primary key,
    prev_status        text not null,
    prev_handled_at    timestamptz,
    prev_triage        text,
    prev_triage_reason text,
    remediated_at      timestamptz not null default now(),
    batch              text not null default 'g01_dnc_normalize_20260916'
  );
  alter table public.exec_va_tasks_dnc_remediation_20260916 enable row level security;
  revoke all on public.exec_va_tasks_dnc_remediation_20260916 from anon, authenticated;
  comment on table public.exec_va_tasks_dnc_remediation_20260916 is
    'G-01 audit/rollback ledger. Rollback: update exec_va_tasks t set status=r.prev_status from this r where t.id=r.task_id and t.status=''blocked_dnc''.';

  select count(*), md5(string_agg(t.id::text, ',' order by t.id))
    into v_n, v_md5
    from public.exec_va_tasks t
   where t.status = 'pending'
     and t.subject_phone is not null
     and t.category in ('payment_followup','waitlist_contact','lead_reengagement')
     and exists (select 1 from public.do_not_contact_numbers d
                  where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10));

  if v_n = 0 then
    raise notice 'G-01 data step skipped: no pending DNC-matched tasks (fresh or already normalized)';
    return;
  end if;
  if v_n <> 71 or v_md5 <> '3ba2d5cc037df2385e92fd6e1ab2537d' then
    raise exception 'G-01 abort: target is % rows (md5 %), expected the verified 71', v_n, v_md5;
  end if;

  insert into public.exec_va_tasks_dnc_remediation_20260916
    (task_id, prev_status, prev_handled_at, prev_triage, prev_triage_reason)
  select t.id, t.status, t.handled_at, t.triage, t.triage_reason
    from public.exec_va_tasks t
   where t.status = 'pending'
     and t.subject_phone is not null
     and t.category in ('payment_followup','waitlist_contact','lead_reengagement')
     and exists (select 1 from public.do_not_contact_numbers d
                  where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10));

  update public.exec_va_tasks t
     set status = 'blocked_dnc'
    from public.exec_va_tasks_dnc_remediation_20260916 r
   where t.id = r.task_id
     and t.status = 'pending';
  get diagnostics v_n = row_count;
  if v_n <> 71 then
    raise exception 'G-01 abort: updated % rows, expected 71', v_n;
  end if;
end $$;
