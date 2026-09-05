-- ============================================================================
-- Adversarial test harness for the triage control plane.
--
-- NOT a migration. Nothing here runs in production. Intended for a Supabase
-- BRANCH (or local `supabase start`), where fixtures can be inserted freely.
--
-- Purpose: prove the classifier survives the failure classes this work has
-- ALREADY produced, rather than merely reproducing today's distribution. Each
-- case below corresponds to a real mistake made on 2026-09-03, not a
-- hypothetical.
--
-- Run:  psql "$BRANCH_DB_URL" -f TRIAGE_ADVERSARIAL_TESTS.sql
-- Every case raises an exception on failure, so a clean run means all passed.
-- ============================================================================

begin;

do $$
declare
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_before bigint;
  v_after  bigint;
  v_res    jsonb;
  v_n      bigint;
begin

-- ---------------------------------------------------------------------------
-- CASE 1 — JOIN FAILURE must not look like "nothing to automate".
--
-- Origin: `auto = 0` and a silently-failing join are indistinguishable in the
-- output. The bgcheck join was verified separately at 132/132 for this reason.
-- Assertion: for every latest bgcheck task, the source lookup MUST resolve.
-- A source-key change that breaks the join has to fail loudly here.
-- ---------------------------------------------------------------------------
select count(*) into v_n
from exec_va_tasks t
where t.category = 'bgcheck_review'
  and t.triage is not null
  and t.triage_reason <> 'superseded_by_later_sweep'
  and not exists (select 1 from background_checks bc
                   where bc.customer_id::text = (t.context->>'customer_id'));
if v_n > 0 then
  raise exception 'CASE 1 FAILED: % bgcheck tasks have no resolvable source row. The join is broken, and auto=0 would be meaningless.', v_n;
end if;

-- ---------------------------------------------------------------------------
-- CASE 2 — FAN-OUT must not change row cardinality.
--
-- Origin: a JOIN inflated waitlist 35->38 and leads 163->227 while producing an
-- internally consistent total. Reconciliation alone did NOT catch it.
-- Assertion: classified rows == source rows, exactly. This is the invariant the
-- fan-out would have silently violated.
-- ---------------------------------------------------------------------------
select count(*) into v_before from exec_va_tasks;
select count(*) into v_after  from exec_va_tasks where triage is not null;
if v_before <> v_after then
  raise exception 'CASE 2 FAILED: % source rows but % classified. Cardinality changed — suspect a JOIN where NOT EXISTS was required.', v_before, v_after;
end if;

-- ---------------------------------------------------------------------------
-- CASE 3 — MIXED SOURCE STATE must not read as resolved.
--
-- Origin: 6 lead subjects had one resolved and one unresolved lead under the
-- same email. A JOIN made them look automatable. They are not.
-- Assertion: no task is 'auto' while ANY matching source row is still open.
-- ---------------------------------------------------------------------------
select count(*) into v_n
from exec_va_tasks t
where t.triage = 'auto'
  and t.category = 'lead_reengagement'
  and exists (select 1 from incoming_leads il
               where il.email = t.subject_email
                 and (il.status is null or il.status in ('New','New Lead')));
if v_n > 0 then
  raise exception 'CASE 3 FAILED: % lead tasks marked auto while an unresolved source lead still exists. Mixed state was treated as resolved.', v_n;
end if;

-- ---------------------------------------------------------------------------
-- CASE 4 — MISSING SOURCE STATE is data repair, never automation.
--
-- Origin: 64 bgcheck rows sit in the queue because eligibility_status is NULL,
-- not because a manager is deliberating. A null must never satisfy "resolved".
-- ---------------------------------------------------------------------------
select count(*) into v_n
from exec_va_tasks t
where t.triage = 'auto'
  and exists (select 1 from background_checks bc
               where bc.customer_id::text = (t.context->>'customer_id')
                 and bc.eligibility_status is null);
if v_n > 0 then
  raise exception 'CASE 4 FAILED: % tasks marked auto with a NULL source status. Missing != resolved.', v_n;
end if;

-- ---------------------------------------------------------------------------
-- CASE 5 — DUPLICATE SOURCE IDENTITY must be impossible for open work.
--
-- Origin: name|phone|email is NOT a key — 64 of 163 lead subjects map to
-- multiple source rows. This is why identity is (category, source_table,
-- source_id) and why the constraint is partial.
-- ---------------------------------------------------------------------------
select count(*) into v_n from (
  select category, source_table, source_id
  from exec_va_tasks
  where source_id is not null and status = 'pending'
  group by 1,2,3 having count(*) > 1
) d;
if v_n > 0 then
  raise exception 'CASE 5 FAILED: % duplicate (category, source_table, source_id) groups among pending work. The partial unique index is not holding.', v_n;
end if;

-- ---------------------------------------------------------------------------
-- CASE 6 — SECOND-PASS IDEMPOTENCY. Both the classifier and the generator.
--
-- Origin: the whole reason this control plane exists. A second pass that writes
-- rows means the system re-manufactures work instead of recognising it.
-- ---------------------------------------------------------------------------
perform public.classify_va_tasks(false);            -- settle
select public.classify_va_tasks(false) into v_res;  -- second pass
if (v_res->>'written')::int <> 0 then
  raise exception 'CASE 6a FAILED: classifier second pass wrote % rows; expected 0.', v_res->>'written';
end if;

select count(*) into v_before from exec_va_tasks;
perform public.generate_va_tasks_v2();
perform public.generate_va_tasks_v2();
select count(*) into v_after from exec_va_tasks;
if v_before <> v_after then
  raise exception 'CASE 6b FAILED: generator grew the table from % to % across two runs. Not idempotent.', v_before, v_after;
end if;

-- ---------------------------------------------------------------------------
-- CASE 7 — AUTHORITY BOUNDARY. Classification must not exercise authority.
--
-- The classifier may only write triage_*. If a pass ever changes status,
-- handled_at or result, the safety boundary has been breached.
-- ---------------------------------------------------------------------------
create temporary table _lifecycle_before as
  select id, status, handled_at, result from exec_va_tasks;
perform public.classify_va_tasks(false);
select count(*) into v_n
from exec_va_tasks t join _lifecycle_before b using (id)
where t.status is distinct from b.status
   or t.handled_at is distinct from b.handled_at
   or t.result is distinct from b.result;
if v_n > 0 then
  raise exception 'CASE 7 FAILED: classifier mutated lifecycle state on % rows. Classification exercised authority.', v_n;
end if;

-- ---------------------------------------------------------------------------
-- CASE 8 — FAIL SAFE, NEVER FAIL OPEN.
--
-- An unrecognised task must land in needs_approval, never auto. Mirrors the
-- do_not_contact_numbers lesson: a gate with no matching rule must deny.
-- ---------------------------------------------------------------------------
insert into exec_va_tasks (category, priority, agent, subject_name, subject_phone, context, sweep_date)
values ('__unknown_category__','medium','VISION','Adversarial Fixture','+15550000000','{}'::jsonb, current_date);
perform public.classify_va_tasks(false);
select triage into v_res from (
  select to_jsonb(triage) as triage from exec_va_tasks where category='__unknown_category__' limit 1) z;
if v_res#>>'{}' is distinct from 'needs_approval' then
  raise exception 'CASE 8 FAILED: unknown category classified as %; expected needs_approval.', v_res#>>'{}';
end if;

raise notice 'ALL ADVERSARIAL CASES PASSED';
end $$;

rollback;  -- fixtures are never persisted

-- ============================================================================
-- Coverage map — failure class -> case
--   join failure ................ 1
--   fan-out ..................... 2
--   mixed source state .......... 3
--   missing source state ........ 4
--   duplicate source identity ... 5
--   second-pass idempotency ..... 6a (classifier), 6b (generator)
--   authority boundary .......... 7
--   fail-open .................... 8
-- ============================================================================
