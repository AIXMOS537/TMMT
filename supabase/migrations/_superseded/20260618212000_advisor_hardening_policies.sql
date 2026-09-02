-- Advisor hardening: give the 2 "RLS enabled, no policy" tables an explicit policy.
--
-- Today both have RLS on with ZERO policies → reachable only by service_role/postgres
-- (fail-closed, which is safe but means owner/staff can't manage them via the
-- authenticated client). These were intentionally deferred in the core tenancy
-- migration ("need individual review"). Granting staff/owner access is strictly
-- additive — non-staff remain denied. Revisit if either should become org-scoped.
--
-- NOTE (handled outside this migration — see PR description):
--   * Auth "leaked password protection" is an Auth config toggle, not SQL.
--   * Moving pg_net / vector out of the public schema is deferred on purpose: it can
--     break unqualified `vector` type references and pg_net calls. Low-severity WARN;
--     do it deliberately with app verification, not as a drive-by.

-- enforcement_settings: global policy/config — staff/owner managed.
drop policy if exists enforcement_settings_staff_all on public.enforcement_settings;
create policy enforcement_settings_staff_all on public.enforcement_settings
  for all using (public.is_staff()) with check (public.is_staff());

-- operator_va_assignments: staff/owner manage operator↔VA links.
drop policy if exists operator_va_assignments_staff_all on public.operator_va_assignments;
create policy operator_va_assignments_staff_all on public.operator_va_assignments
  for all using (public.is_staff()) with check (public.is_staff());
