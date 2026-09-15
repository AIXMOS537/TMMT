-- Fix: operator_training_progress is readable AND writable across every tenant.
--
-- Found 2026-09-15 by reading pg_policies directly, not from an advisor.
-- The live policy is:
--
--   operator_training_progress_rw  FOR ALL  TO authenticated
--     USING      ( profile_id = auth.uid()
--                  OR EXISTS (SELECT 1 FROM org_roles r WHERE r.user_id = auth.uid()) )
--     WITH CHECK ( same )
--
-- The second clause never mentions the row being checked. It asks only "does
-- the caller hold any org role at all", which for anyone holding one is
-- identical to USING (true). So a single operator at one client can read every
-- other operator's training record at every other client, and — because this
-- is FOR ALL, not FOR SELECT — can also UPDATE and DELETE them.
--
-- This is the same shape as every silent bleed we have caught: it looks like a
-- scoping rule because it contains a subquery, and it scopes nothing.
--
-- The fix splits the one FOR ALL policy into intent:
--   * a learner reads and writes their OWN rows, and only their own
--   * staff, and members of the org that the operator actually belongs to,
--     may READ — correlated through operator_profiles, which is where the
--     operator ↔ org relationship lives (this table has no org column)
--   * nobody but the service role may write somebody else's row
--
-- ⚠️ NOT FIXED HERE, because it is a product decision and not mine to make:
-- a learner can still legitimately write percent_complete = 100 and
-- completed_at = now() on their own rows, and operator_self_certify() trusts
-- those rows. So certification remains self-attested — after this migration a
-- learner can still certify themselves without doing the work; they just can
-- no longer do it to, or read it from, anyone else. See the note at the end.

begin;

alter table public.operator_training_progress enable row level security;

drop policy if exists operator_training_progress_rw on public.operator_training_progress;

-- A learner owns their own progress: read and write, their rows only.
create policy operator_training_progress_own
  on public.operator_training_progress
  for all
  to authenticated
  using      (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Staff, and members of the operator's OWN org, may read. Correlated to the
-- row via operator_profiles.profile_id — that correlation is the whole point,
-- and its absence is what made the old policy meaningless.
create policy operator_training_progress_org_read
  on public.operator_training_progress
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.operator_profiles op
      where op.profile_id = public.operator_training_progress.profile_id
        and op.org_id is not null
        and public.is_org_member(op.org_id)
    )
  );

commit;

-- Rollback (restores the hole — only for an emergency, and say so out loud):
--
--   begin;
--   drop policy if exists operator_training_progress_own      on public.operator_training_progress;
--   drop policy if exists operator_training_progress_org_read on public.operator_training_progress;
--   create policy operator_training_progress_rw
--     on public.operator_training_progress for all to authenticated
--     using      (profile_id = auth.uid() or exists (select 1 from org_roles r where r.user_id = auth.uid()))
--     with check (profile_id = auth.uid() or exists (select 1 from org_roles r where r.user_id = auth.uid()));
--   commit;
--
-- Verify after applying (expect exactly two rows, and no policy whose
-- expression mentions org_roles without correlating to the row):
--
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname='public' and tablename='operator_training_progress';
--
-- THE REMAINING QUESTION — TAHA'S CALL, ONE LINE EITHER WAY:
--
-- Certification is currently self-attested end to end. A learner writes their
-- own progress and operator_self_certify() believes it. The 15-module cert
-- path is a product we sell, so "certified" should mean something. Two ways:
--
--   (a) Progress becomes server-written only: drop INSERT/UPDATE for
--       authenticated on this table and have the lesson endpoint write it with
--       the service role after it sees the lesson actually finish. Strongest,
--       and it needs the lesson UI to call an endpoint rather than the table.
--
--   (b) Keep self-reported progress for the learner's own benefit, but make
--       certification require a human: operator_self_certify() stops setting
--       certified_at and instead raises a review row for staff to sign off.
--
-- Say which and I will build it. Until then the honest word on the page is
-- "completed the course", not "certified by us".
