-- Work Routing — Phase 3d: full-pool evaluate / plan / assign
-- Spec: docs/superpowers/specs/2026-06-16-quo-support-dispatch-design.md
--
-- A vertical-agnostic routing layer that ranks and assigns ANY unit of work
-- (a `cases` row) across the FULL candidate pool — employees, agents, vendors,
-- and units — by capability + vertical + availability + load. Built to scale as
-- new business verticals are registered (just add rows; no code change).
--
-- Reuses is_staff() for RLS. Deterministic ranking is the fail-open baseline;
-- an agent (CAPTAIN) can refine on top later without schema change.

-- ---------------------------------------------------------------------------
-- 1. verticals — the business lines that "will be set up soon"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verticals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id          uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  slug            text NOT NULL UNIQUE,
  name            text,
  capability_tags text[] NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. routing_candidates — the unified pool (employee | agent | vendor | unit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.routing_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id          uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  candidate_kind  text NOT NULL CHECK (candidate_kind IN ('employee', 'agent', 'vendor', 'unit')),
  ref_kind        text,                       -- source table, e.g. 'vendors'
  ref_id          text,                       -- source id (text: uuid or bigint)
  display_name    text NOT NULL,
  capability_tags text[] NOT NULL DEFAULT '{}',
  vertical_slugs  text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'busy', 'off', 'inactive')),
  max_concurrent  int NOT NULL DEFAULT 3,
  current_load    int NOT NULL DEFAULT 0,
  priority_weight numeric NOT NULL DEFAULT 0,
  contact_phone   text,
  contact_email   text,
  location_lat    double precision,
  location_lng    double precision,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_kind, ref_id)
);
CREATE INDEX IF NOT EXISTS routing_candidates_status_idx ON public.routing_candidates (status);
CREATE INDEX IF NOT EXISTS routing_candidates_caps_idx ON public.routing_candidates USING gin (capability_tags);
CREATE INDEX IF NOT EXISTS routing_candidates_verts_idx ON public.routing_candidates USING gin (vertical_slugs);

-- ---------------------------------------------------------------------------
-- 3. work_assignments — generalized assignment record (any case → any candidate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id          uuid REFERENCES public.cases (id) ON DELETE CASCADE,
  candidate_id     uuid REFERENCES public.routing_candidates (id) ON DELETE SET NULL,
  assigned_by_kind text NOT NULL DEFAULT 'system' CHECK (assigned_by_kind IN ('system', 'user')),
  assigned_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  score            numeric,
  reasoning        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'assigned'
                     CHECK (status IN ('proposed', 'assigned', 'accepted', 'completed', 'cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_assignments_case_idx ON public.work_assignments (case_id);
CREATE INDEX IF NOT EXISTS work_assignments_candidate_idx ON public.work_assignments (candidate_id);

-- cases: explicit required capabilities for clean array-overlap ranking.
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS required_capabilities text[];

-- ---------------------------------------------------------------------------
-- 4. RLS (staff full access; service role bypasses for the router)
-- ---------------------------------------------------------------------------
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_verticals" ON public.verticals
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_routing_candidates" ON public.routing_candidates
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_work_assignments" ON public.work_assignments
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- ---------------------------------------------------------------------------
-- 5. updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at_generic ()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_routing_candidates_updated_at ON public.routing_candidates;
CREATE TRIGGER trg_routing_candidates_updated_at
  BEFORE UPDATE ON public.routing_candidates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic ();
DROP TRIGGER IF EXISTS trg_work_assignments_updated_at ON public.work_assignments;
CREATE TRIGGER trg_work_assignments_updated_at
  BEFORE UPDATE ON public.work_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic ();

-- ---------------------------------------------------------------------------
-- 6. Ranking — deterministic best-candidate scoring for a case
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rank_work_candidates (p_case_id uuid)
RETURNS TABLE (
  candidate_id uuid, candidate_kind text, display_name text,
  score numeric, cap_overlap int, vertical_match boolean, current_load int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  WITH c AS (
    SELECT coalesce(required_capabilities, '{}'::text[]) AS req, business_line AS vert
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
    AND (
      cardinality(c.req) = 0
      OR rc.capability_tags && c.req
      OR (c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs))
    )
  ORDER BY score DESC, rc.current_load ASC
  LIMIT 10;
$$;

-- ---------------------------------------------------------------------------
-- 7. Assignment — atomic: record assignment, bump load, advance the case
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_work (
  p_case_id uuid, p_candidate_id uuid,
  p_by_kind text DEFAULT 'system', p_by_user uuid DEFAULT NULL,
  p_score numeric DEFAULT NULL, p_reasoning jsonb DEFAULT '{}'::jsonb
)
RETURNS public.work_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_row public.work_assignments;
BEGIN
  INSERT INTO public.work_assignments
    (case_id, candidate_id, assigned_by_kind, assigned_by, score, reasoning, status)
  VALUES
    (p_case_id, p_candidate_id, p_by_kind, p_by_user, p_score, coalesce(p_reasoning, '{}'::jsonb), 'assigned')
  RETURNING * INTO v_row;

  UPDATE public.routing_candidates
    SET current_load = current_load + 1,
        status = CASE WHEN current_load + 1 >= max_concurrent THEN 'busy' ELSE status END,
        updated_at = now()
  WHERE id = p_candidate_id;

  UPDATE public.cases
    SET routing_status = 'assigned', assigned_at = now(), updated_at = now()
  WHERE id = p_case_id;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Seed the pool from existing sources (idempotent via UNIQUE(kind, ref_id))
-- ---------------------------------------------------------------------------
-- Vendors → vendor candidates (service_verticals are both caps and verticals).
INSERT INTO public.routing_candidates
  (candidate_kind, ref_kind, ref_id, display_name, capability_tags, vertical_slugs, status, contact_phone, contact_email)
SELECT 'vendor', 'vendors', v.id::text, coalesce(v.name, 'Vendor'),
       coalesce(v.service_verticals, '{}'::text[]),
       coalesce(v.service_verticals, '{}'::text[]),
       CASE WHEN coalesce(v.active, true) AND coalesce(v.agreement_status, 'active') IN ('active', 'trial')
            THEN 'available' ELSE 'inactive' END,
       v.phone, v.email
FROM public.vendors v
ON CONFLICT (candidate_kind, ref_id) DO NOTHING;

-- Staff / respond-capable profiles → employee candidates (generic 'support' cap
-- plus their department as a vertical tag).
INSERT INTO public.routing_candidates
  (org_id, candidate_kind, ref_kind, ref_id, display_name, capability_tags, vertical_slugs, status, contact_phone, contact_email)
SELECT p.organization_id, 'employee', 'profiles', p.id::text,
       coalesce(p.full_name, p.email, 'Employee'),
       array_remove(ARRAY['support', p.team_department], NULL),
       array_remove(ARRAY[p.team_department], NULL),
       'available', p.phone, p.email
FROM public.profiles p
WHERE coalesce(p.respond_capable, false) = true
   OR p.role IN ('admin', 'internal_team')
ON CONFLICT (candidate_kind, ref_id) DO NOTHING;

-- Units → unit candidates.
INSERT INTO public.routing_candidates
  (org_id, candidate_kind, ref_kind, ref_id, display_name, status, location_lat, location_lng)
SELECT u.org_id, 'unit', 'units', u.id::text, coalesce(u.callsign, 'Unit'),
       CASE WHEN u.status = 'available' THEN 'available' ELSE 'off' END,
       u.current_lat, u.current_lng
FROM public.units u
ON CONFLICT (candidate_kind, ref_id) DO NOTHING;

COMMENT ON TABLE public.routing_candidates IS 'Work Routing: unified candidate pool (employee/agent/vendor/unit) ranked by capability+vertical+load. Seed/refresh from source tables.';
COMMENT ON FUNCTION public.rank_work_candidates(uuid) IS 'Deterministic best-candidate ranking for a case; fail-open baseline beneath any agent refinement.';
