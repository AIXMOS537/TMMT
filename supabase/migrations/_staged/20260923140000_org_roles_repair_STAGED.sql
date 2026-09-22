-- STAGED — NOT APPLIED. org_roles policy repair (C3-005 / C3-006).
--
-- Owner-gated production change: prod write baton required
-- (docs/ops/PROD-WRITE-BATON.md). Rehearsed against the production catalog shape by
-- scripts/tests/sql/org-roles-repair.rehearsal.mjs (with mutations).
--
-- WHAT IS WRONG TODAY (read from prod pg_policies, 2026-09-21)
--   org_roles.tenant_admin_write  FOR ALL TO public
--     USING / CHECK ( is_staff() OR EXISTS (SELECT 1 FROM org_roles r
--                     WHERE r.org_id = org_roles.org_id AND r.user_id = auth.uid()
--                       AND r.role = 'tenant_admin') )
--   The subquery reads org_roles from inside an org_roles policy, so EVERY non-bypass
--   query on org_roles raises 42P17 "infinite recursion detected in policy". That
--   breaks /dispatch for tenant members (layout.tsx:16, actions.ts requireOrgAccess,
--   dispatch-queries.ts:84) and every read of operator_training_progress.
--   anon also holds SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER on org_roles.
--
-- WHY THIS MIGRATION ALSO FIXES operator_training_progress
--   Its policy operator_training_progress_rw is the ONLY other policy on prod that
--   reads org_roles directly, and its EXISTS is uncorrelated ("caller holds any org
--   role anywhere") — i.e. cross-tenant read AND write of all 120 rows. Today the
--   recursion error hides that hole. Repairing org_roles alone would switch the hole
--   ON. So the two fixes ship in one transaction and cannot be applied out of order.
--   (Same fix as _staged/20260915120000_operator_progress_tenant_scope_STAGED.sql,
--   idempotent, so applying either first is harmless.)
--
-- WHAT THIS DOES
--   1. is_org_tenant_admin(org) — SECURITY DEFINER, so policies stop recursing.
--   2. org_roles policies, split by intent:
--        read   : own rows; staff; tenant admins of that org
--        write  : staff (any role), or a tenant admin of that org managing
--                 dispatcher / responder / viewer ONLY — never tenant_admin, and
--                 never a row for themselves (no self-assignment, no self-promotion)
--   3. anon: no access at all. authenticated: no TRUNCATE / REFERENCES / TRIGGER.
--   4. operator_training_progress: own rows read/write; staff + members of the
--      operator's own org read; nobody else.
--
-- ROLLBACK (restores the recursion — and the training-progress hole's cover)
--   begin;
--   drop policy if exists org_roles_read on public.org_roles;
--   drop policy if exists org_roles_insert on public.org_roles;
--   drop policy if exists org_roles_update on public.org_roles;
--   drop policy if exists org_roles_delete on public.org_roles;
--   create policy self_read on public.org_roles as permissive for select to public using (((user_id = auth.uid()) OR is_staff()));
--   create policy tenant_admin_write on public.org_roles as permissive for all to public using ((is_staff() OR (EXISTS ( SELECT 1 FROM org_roles r WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text)))))) with check ((is_staff() OR (EXISTS ( SELECT 1 FROM org_roles r WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))));
--   grant select, insert, update, delete, references, trigger on public.org_roles to anon, authenticated;
--   drop function if exists public.is_org_tenant_admin(uuid);
--   commit;
--   (operator_training_progress is deliberately NOT rolled back here; see the
--    20260915 staged file for its own emergency rollback.)

begin;

create or replace function public.is_org_tenant_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p_org is not null and auth.uid() is not null and exists (
    select 1 from public.org_roles r
    where r.org_id = p_org and r.user_id = auth.uid() and r.role = 'tenant_admin'
  )
$$;
revoke all on function public.is_org_tenant_admin(uuid) from public, anon;
grant execute on function public.is_org_tenant_admin(uuid) to authenticated, service_role;

drop policy if exists tenant_admin_write on public.org_roles;
drop policy if exists self_read on public.org_roles;

drop policy if exists org_roles_read on public.org_roles;
create policy org_roles_read on public.org_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff() or public.is_org_tenant_admin(org_id));

-- A tenant admin manages the working roles of their own org, for OTHER people.
-- Granting tenant_admin, or anything to yourself, is staff-only.
drop policy if exists org_roles_insert on public.org_roles;
create policy org_roles_insert on public.org_roles
  for insert to authenticated
  with check (
    public.is_staff()
    or (public.is_org_tenant_admin(org_id)
        and role in ('dispatcher', 'responder', 'viewer')
        and user_id <> auth.uid())
  );

drop policy if exists org_roles_update on public.org_roles;
create policy org_roles_update on public.org_roles
  for update to authenticated
  using (
    public.is_staff()
    or (public.is_org_tenant_admin(org_id) and role in ('dispatcher', 'responder', 'viewer') and user_id <> auth.uid())
  )
  with check (
    public.is_staff()
    or (public.is_org_tenant_admin(org_id) and role in ('dispatcher', 'responder', 'viewer') and user_id <> auth.uid())
  );

drop policy if exists org_roles_delete on public.org_roles;
create policy org_roles_delete on public.org_roles
  for delete to authenticated
  using (
    public.is_staff()
    or (public.is_org_tenant_admin(org_id) and role in ('dispatcher', 'responder', 'viewer') and user_id <> auth.uid())
  );

revoke all on public.org_roles from anon;
revoke truncate, references, trigger on public.org_roles from authenticated;

-- operator_training_progress: close the cross-tenant hole BEFORE it can go live.
alter table public.operator_training_progress enable row level security;
drop policy if exists operator_training_progress_rw on public.operator_training_progress;
drop policy if exists operator_training_progress_own on public.operator_training_progress;
create policy operator_training_progress_own
  on public.operator_training_progress for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
drop policy if exists operator_training_progress_org_read on public.operator_training_progress;
create policy operator_training_progress_org_read
  on public.operator_training_progress for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.operator_profiles op
      where op.profile_id = public.operator_training_progress.profile_id
        and op.org_id is not null
        and public.is_org_member(op.org_id)
    )
  );
revoke all on public.operator_training_progress from anon;
revoke truncate, references, trigger on public.operator_training_progress from authenticated;

commit;
