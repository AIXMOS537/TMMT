-- ============================================================================
-- is_staff() — FAIL CLOSED (security hardening)
-- ============================================================================
-- Today public.is_staff() coalesces a BLANK / missing JWT app_metadata.role to
-- 'admin' — i.e. a token with no role is silently treated as staff (fail-OPEN).
-- That's acceptable only while every human has an explicit role; one
-- misconfigured or blank token otherwise lands as admin.
--
-- This migration makes it fail CLOSED: no explicit 'admin'/'va' role => not staff.
--
--   ┌────────────────────────────────────────────────────────────────────────┐
--   │  ⚠ PREREQUISITE — DO NOT APPLY UNTIL THIS IS DONE, OR YOU LOCK YOURSELF  │
--   │  OUT of every staff table:                                              │
--   │                                                                          │
--   │   1. Set an explicit role on the OWNER and EVERY VA, e.g.:               │
--   │        npm run set-admin-role -- owner@yourdomain.com                    │
--   │        npm run set-admin-role -- va@yourdomain.com                       │
--   │   2. Confirm in Supabase that each human's app_metadata.role is          │
--   │      'admin' (or 'va'), and that they have re-logged in so the new JWT   │
--   │      carries the role.                                                   │
--   │   3. THEN apply this migration (SQL editor or migration run).            │
--   └────────────────────────────────────────────────────────────────────────┘
--
-- NOT auto-applied — reviewable for owner approval (same posture as
-- 20260621020000_tenant_scope_rls_policies.sql). After applying, a blank-role
-- token has NO staff access; partners still reach data only via get_partner_fleet().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_staff ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Fail CLOSED: only an explicit 'admin' or 'va' role is staff. A blank /
  -- missing role is NOT staff (previously defaulted to 'admin').
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')) IN ('admin', 'va');
$$;
