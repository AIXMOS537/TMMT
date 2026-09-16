-- VERBATIM body applied to prod (uapxakmlwnpfsftfeezx) on 2026-09-16 as ledger
-- version 20260916191039 g01_exec_va_tasks_dnc_normalize_20260916, owner-approved.
-- Identical to supabase_migrations.schema_migrations.statements for that version,
-- apart from its leading comment lines. Historical record only: do NOT run.
-- The re-runnable, fresh-environment-safe form lives in supabase/migrations/.

create table public.exec_va_tasks_dnc_remediation_20260916 (
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

do $$
declare
  v_md5 text;
  v_n   int;
begin
  select count(*), md5(string_agg(t.id::text, ',' order by t.id))
    into v_n, v_md5
    from public.exec_va_tasks t
   where t.status = 'pending'
     and t.subject_phone is not null
     and t.category in ('payment_followup','waitlist_contact','lead_reengagement')
     and exists (select 1 from public.do_not_contact_numbers d
                  where d.phone10 = right(regexp_replace(t.subject_phone,'\D','','g'),10));
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
