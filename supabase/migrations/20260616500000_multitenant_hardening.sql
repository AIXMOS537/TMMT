-- Multi-tenant hardening & RPC lock-down — readiness for growth + many users.
--
-- 1. cases.org_id so work is tenant-scoped.
-- 2. rank_work_candidates() only considers candidates in the case's org (or the
--    shared/global pool, org_id IS NULL) — prevents cross-tenant assignment.
-- 3. Revoke anon EXECUTE on the SECURITY DEFINER RPCs (advisor WARN); keep only
--    the roles that actually need them.

-- 1. tenant column on work --------------------------------------------------
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cases_org_idx ON public.cases (org_id);

-- 2. org-scoped ranking ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rank_work_candidates (p_case_id uuid)
RETURNS TABLE (
  candidate_id uuid, candidate_kind text, display_name text,
  score numeric, cap_overlap int, vertical_match boolean, current_load int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  WITH c AS (
    SELECT coalesce(required_capabilities, '{}'::text[]) AS req,
           business_line AS vert, org_id
    FROM public.cases WHERE id = p_case_id
  )
  SELECT
    rc.id, rc.candidate_kind, rc.display_name,
    ( (SELECT count(*) FROM unnest(rc.capability_tags) t WHERE t = ANY (c.req))::numeric * 10
      + (CASE WHEN c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs) THEN 5 ELSE 0 END)
      + rc.priority_weight
      - rc.current_load * 2 ) AS score,
    (SELECT count(*) FROM unnest(rc.capability_tags) t WHERE t = ANY (c.req))::int AS cap_overlap,
    (c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs)) AS vertical_match,
    rc.current_load
  FROM public.routing_candidates rc, c
  WHERE rc.status = 'available'
    AND rc.current_load < rc.max_concurrent
    -- tenant isolation: same org, or the shared/global pool (org_id IS NULL)
    AND (c.org_id IS NULL OR rc.org_id IS NULL OR rc.org_id = c.org_id)
    AND (
      cardinality(c.req) = 0
      OR rc.capability_tags && c.req
      OR (c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs))
    )
  ORDER BY score DESC, rc.current_load ASC
  LIMIT 10;
$$;

-- 3. lock down SECURITY DEFINER RPCs ----------------------------------------
-- Internal/service-role only (called by the server's service-role client).
REVOKE ALL ON FUNCTION public.assign_work(uuid, uuid, text, uuid, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_work(uuid, uuid, text, uuid, numeric, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.rank_work_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rank_work_candidates(uuid) TO service_role;

-- Used by middleware (as the authenticated user) and by RLS policies — keep
-- authenticated + service_role, drop anon.
REVOKE ALL ON FUNCTION public.backend_unlocked_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backend_unlocked_for(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, service_role;
