-- Security hardening (pre-launch audit): lock SECURITY DEFINER RPCs away from
-- the anon role. Supabase grants EXECUTE to anon/authenticated DIRECTLY on
-- public functions, so an earlier `REVOKE ... FROM PUBLIC` did not remove it —
-- this revokes the role grants explicitly.
--
-- assign_work / rank_work_candidates: internal routing — service_role ONLY
--   (closes an unauthenticated write path via assign_work).
-- backend_unlocked_for / is_owner: keep `authenticated` (middleware gate + RLS
--   policies evaluate them as the authenticated user); drop anon.
--
-- NOTE: the broader set of anon-executable SECURITY DEFINER functions in this
-- project is intentional in places (e.g. submit_customer_intake for public
-- forms) — do NOT mass-revoke; that needs the owner's deliberate hit list.

REVOKE EXECUTE ON FUNCTION public.assign_work(uuid, uuid, text, uuid, numeric, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rank_work_candidates(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backend_unlocked_for(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;

GRANT EXECUTE ON FUNCTION public.assign_work(uuid, uuid, text, uuid, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rank_work_candidates(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.backend_unlocked_for(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, service_role;
