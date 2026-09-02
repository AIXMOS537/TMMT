-- Close the 2 remaining anon-executable SECURITY DEFINER install RPCs.
--
-- Verified safe (no callers): the live device-install flow uses the partner_* RPC
-- family (partner_redeem_install_token, partner license-status RPC) via the anon key,
-- and the app's /api/license/{provision,heartbeat} routes use the SERVICE ROLE on the
-- organization_licenses table. Neither bind_install nor license_heartbeat is called
-- from the app or any script in the repo — they are a duplicate/legacy RPC path that
-- should never be reachable with the public anon key.
--
-- submit_customer_intake is INTENTIONALLY left anon-callable: it backs the public
-- intake form (src/app/workflow-actions.ts → createSSRClient → anon).
--
-- Companion to 20260618_harden_secdef_rpc_revoke_public_anon (applied live 2026-06-18),
-- which locked provision_operator / revoke_license / commissions / triggers etc.

revoke execute on function public.bind_install(uuid, text, text) from public, anon;
revoke execute on function public.license_heartbeat(uuid, text) from public, anon;
