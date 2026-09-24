-- Defence in depth on the partner tenancy tables.
--
-- APPLIED to production 2026-09-19 and verified as the anon role itself.
--
-- 20260917040500_partner_tenancy.sql did `REVOKE ALL ... FROM PUBLIC`, which does NOT
-- touch a grant held DIRECTLY by a role. Supabase's default schema privileges had already
-- given anon `arwdxtm` on every table at creation time, so anon carried SELECT/INSERT/
-- UPDATE/DELETE on all five partner tables -- including partner_install_tokens, which
-- holds install-token hashes, and partner_licenses, which holds kill-switch state.
--
-- Nothing was leaking: RLS is enabled on all five; tenants/licenses/install_tokens have
-- NO policy at all, so every non-bypassing role is denied; heartbeats/audit_events carry
-- INSERT-only policies for anon. This is the second lock, not the first. It means a future
-- permissive policy -- the kind someone adds while debugging -- cannot silently become a
-- read of the token table, because the grant will not be there to back it.
--
-- anon keeps exactly what the partner agent needs and nothing else.
-- The two RPCs are SECURITY DEFINER, so they keep working with no table grant at all.
--
-- POSTCONDITION, run as `SET LOCAL ROLE anon`:
--   select ... from partner_install_tokens  -> 42501 permission denied   (refused)
--   select ... from partner_license_status('no-such-tenant','hw')
--                                           -> 0 rows, no error         (still callable)

revoke all on public.partner_tenants        from anon;
revoke all on public.partner_licenses       from anon;
revoke all on public.partner_install_tokens from anon;

revoke all    on public.partner_heartbeats   from anon;
grant  insert on public.partner_heartbeats   to   anon;

revoke all    on public.partner_audit_events from anon;
grant  insert on public.partner_audit_events to   anon;

grant usage, select on sequence public.partner_heartbeats_heartbeat_id_seq to anon;
grant usage, select on sequence public.partner_audit_events_event_id_seq   to anon;
