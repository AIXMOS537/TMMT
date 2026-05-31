-- Rescue Dispatch — Subproject #1: Dispatch Core
-- Spec: docs/superpowers/specs/2026-05-27-rescue-dispatch-core-design.md
-- Plan: docs/superpowers/plans/2026-05-27-rescue-dispatch-core.md
--
-- Adds: 7 tables (incidents, units, unit_locations, incident_assignments,
--       assignment_overrides, org_responder_links, org_roles), 2 ALTERs
--       (fleet, profiles), 1 view, 4 functions, RLS for all 7 new tables.
--
-- Reuses: public.is_staff() from 20260516120000_workflow_engine.sql.
-- Adds:   public.is_org_dispatcher(p_org_id uuid).

BEGIN;

-- ════════════════════════════════════════════════════
-- New tables
-- ════════════════════════════════════════════════════

CREATE TABLE public.org_roles (
  org_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  role    text NOT NULL CHECK (role IN ('tenant_admin','dispatcher','responder','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id, role)
);
CREATE INDEX org_roles_user_idx ON public.org_roles (user_id);

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ref_code text UNIQUE,
  reported_at timestamptz NOT NULL DEFAULT now(),
  reporter_name text,
  reporter_phone text,
  location_lat double precision,
  location_lng double precision,
  location_text text,
  description text,
  severity smallint CHECK (severity IN (1,2,3)),
  required_capabilities text[] NOT NULL DEFAULT '{}',
  required_class text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN (
    'received','assigning','assigned','en_route','on_scene','cleared','closed','cancelled'
  )),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at timestamptz
);
CREATE INDEX incidents_org_status_idx ON public.incidents (org_id, status);
CREATE INDEX incidents_org_reported_idx ON public.incidents (org_id, reported_at DESC);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fleet_id uuid REFERENCES public.fleet(id) ON DELETE SET NULL,
  responder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  callsign text NOT NULL,
  status text NOT NULL DEFAULT 'off_duty' CHECK (status IN (
    'off_duty','available','assigned','en_route','on_scene','out_of_service'
  )),
  current_lat double precision,
  current_lng double precision,
  last_ping_at timestamptz,
  active_assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, callsign)
);
CREATE INDEX units_org_status_idx ON public.units (org_id, status);

CREATE TABLE public.unit_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading smallint CHECK (heading BETWEEN 0 AND 359),
  speed_mph smallint,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX unit_locations_unit_time_idx ON public.unit_locations (unit_id, recorded_at DESC);

CREATE TABLE public.incident_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  assigned_by_kind text NOT NULL CHECK (assigned_by_kind IN ('system','user')),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_weight numeric NOT NULL DEFAULT 0,
  reasoning_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','locked','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz
);
CREATE INDEX ia_incident_idx ON public.incident_assignments (incident_id);
CREATE INDEX ia_pending_idx ON public.incident_assignments (status, created_at) WHERE status = 'pending';

ALTER TABLE public.units
  ADD CONSTRAINT units_active_assignment_fk
  FOREIGN KEY (active_assignment_id) REFERENCES public.incident_assignments(id) ON DELETE SET NULL;

CREATE TABLE public.assignment_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  original_unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  chosen_unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  reason text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ao_incident_idx ON public.assignment_overrides (incident_id);

CREATE TABLE public.org_responder_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  link_kind text NOT NULL CHECK (link_kind IN ('vendor','operator','client_volunteer','contractor')),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  certs jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, user_id)
);

-- ════════════════════════════════════════════════════
-- Schema extensions on existing tables
-- ════════════════════════════════════════════════════

ALTER TABLE public.fleet
  ADD COLUMN IF NOT EXISTS vehicle_class text
    CHECK (vehicle_class IN ('sport_bike','sport_car','sport_suv','van','truck','helicopter','foot','other')),
  ADD COLUMN IF NOT EXISTS capability_tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS respond_capable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responder_certs jsonb,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- ════════════════════════════════════════════════════
-- Helpers + ref code + lock-expiry mechanics
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_org_dispatcher(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_roles
    WHERE org_id  = p_org_id
      AND user_id = auth.uid()
      AND role IN ('tenant_admin','dispatcher')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_roles
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.next_dsp_ref_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.incidents;
  RETURN 'DSP-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
END;
$$;

-- View that materializes "effective_status": pending rows older than 30s
-- are reported as 'locked' even before the persisted row catches up.
CREATE OR REPLACE VIEW public.incident_assignments_v AS
SELECT
  ia.*,
  CASE
    WHEN ia.status = 'pending' AND ia.created_at < (now() - interval '30 seconds')
      THEN 'locked'
    ELSE ia.status
  END AS effective_status
FROM public.incident_assignments ia;

-- Idempotent tick. Called by the cockpit page on mount + any state change.
CREATE OR REPLACE FUNCTION public.lock_expired_assignments(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT (public.is_org_dispatcher(p_org_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH locked AS (
    UPDATE public.incident_assignments
       SET status = 'locked', locked_at = now()
     WHERE org_id = p_org_id
       AND status = 'pending'
       AND created_at < (now() - interval '30 seconds')
    RETURNING 1
  )
  SELECT count(*) INTO n FROM locked;
  RETURN n;
END;
$$;

-- ════════════════════════════════════════════════════
-- Assignment engine
-- ════════════════════════════════════════════════════

-- Deterministic ranking. <50ms target. Returns top 5 candidates.
CREATE OR REPLACE FUNCTION public.find_best_unit(p_incident_id uuid)
RETURNS TABLE (
  unit_id uuid,
  callsign text,
  distance_km numeric,
  capability_match_score smallint,
  eta_seconds integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_lat double precision;
  v_lng double precision;
  v_caps text[];
  v_class text;
BEGIN
  SELECT i.org_id, i.location_lat, i.location_lng, i.required_capabilities, i.required_class
    INTO v_org_id, v_lat, v_lng, v_caps, v_class
  FROM public.incidents i
  WHERE i.id = p_incident_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'incident not found';
  END IF;

  IF NOT (public.is_org_member(v_org_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.callsign,
    ROUND(
      (6371 * 2 * asin(sqrt(
        sin(radians((u.current_lat - v_lat) / 2)) ^ 2
        + cos(radians(v_lat)) * cos(radians(u.current_lat))
          * sin(radians((u.current_lng - v_lng) / 2)) ^ 2
      )))::numeric, 2)                                                AS distance_km,
    COALESCE(cardinality(
      ARRAY(SELECT unnest(v_caps) INTERSECT SELECT unnest(f.capability_tags))
    ), 0)::smallint                                                   AS capability_match_score,
    GREATEST(
      30,
      (ROUND(
        (6371 * 2 * asin(sqrt(
          sin(radians((u.current_lat - v_lat) / 2)) ^ 2
          + cos(radians(v_lat)) * cos(radians(u.current_lat))
            * sin(radians((u.current_lng - v_lng) / 2)) ^ 2
        ))) / 56 * 3600)::integer
      )
    )                                                                 AS eta_seconds
  FROM public.units u
  LEFT JOIN public.fleet f ON f.id = u.fleet_id
  WHERE u.org_id = v_org_id
    AND u.status = 'available'
    AND u.current_lat IS NOT NULL AND u.current_lng IS NOT NULL
    AND (v_class IS NULL OR f.vehicle_class = v_class)
    AND (coalesce(cardinality(v_caps),0) = 0
         OR (f.capability_tags IS NOT NULL AND f.capability_tags @> v_caps))
  ORDER BY capability_match_score DESC, distance_km ASC
  LIMIT 5;
END;
$$;

-- Atomic assignment. Sets incident.status='assigning', writes the assignment row,
-- flips the unit to 'assigned' + active_assignment_id.
CREATE OR REPLACE FUNCTION public.assign_unit(
  p_incident_id uuid,
  p_unit_id     uuid,
  p_by_kind     text,
  p_by_user     uuid,
  p_weight      numeric,
  p_reasoning   jsonb
)
RETURNS public.incident_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_assignment public.incident_assignments;
BEGIN
  SELECT org_id INTO v_org_id FROM public.incidents WHERE id = p_incident_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'incident not found'; END IF;
  IF NOT (public.is_org_dispatcher(v_org_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.incident_assignments (
    org_id, incident_id, unit_id, assigned_by_kind, assigned_by,
    override_weight, reasoning_json, status
  )
  VALUES (
    v_org_id, p_incident_id, p_unit_id, p_by_kind, p_by_user,
    p_weight, COALESCE(p_reasoning, '{}'::jsonb), 'pending'
  )
  RETURNING * INTO v_assignment;

  UPDATE public.units
     SET status = 'assigned', active_assignment_id = v_assignment.id
   WHERE id = p_unit_id;

  UPDATE public.incidents
     SET status = 'assigned'
   WHERE id = p_incident_id;

  RETURN v_assignment;
END;
$$;

-- ════════════════════════════════════════════════════
-- Enable RLS + policies
-- ════════════════════════════════════════════════════

ALTER TABLE public.org_roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_overrides     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_responder_links      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_read"        ON public.org_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "tenant_admin_write" ON public.org_roles FOR ALL
  USING (
    public.is_staff()
    OR EXISTS (SELECT 1 FROM public.org_roles r
                WHERE r.org_id = org_roles.org_id AND r.user_id = auth.uid() AND r.role = 'tenant_admin')
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (SELECT 1 FROM public.org_roles r
                WHERE r.org_id = org_roles.org_id AND r.user_id = auth.uid() AND r.role = 'tenant_admin')
  );

CREATE POLICY "tenant_read"      ON public.incidents FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_staff());
CREATE POLICY "dispatcher_write" ON public.incidents FOR ALL
  USING (public.is_org_dispatcher(org_id) OR public.is_staff())
  WITH CHECK (public.is_org_dispatcher(org_id) OR public.is_staff());

CREATE POLICY "tenant_read"      ON public.units FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_staff());
CREATE POLICY "dispatcher_write" ON public.units FOR ALL
  USING (public.is_org_dispatcher(org_id) OR public.is_staff())
  WITH CHECK (public.is_org_dispatcher(org_id) OR public.is_staff());

CREATE POLICY "tenant_read"      ON public.unit_locations FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_staff());
CREATE POLICY "dispatcher_write" ON public.unit_locations FOR ALL
  USING (public.is_org_dispatcher(org_id) OR public.is_staff())
  WITH CHECK (public.is_org_dispatcher(org_id) OR public.is_staff());

CREATE POLICY "tenant_read"      ON public.incident_assignments FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_staff());
CREATE POLICY "dispatcher_write" ON public.incident_assignments FOR ALL
  USING (public.is_org_dispatcher(org_id) OR public.is_staff())
  WITH CHECK (public.is_org_dispatcher(org_id) OR public.is_staff());

CREATE POLICY "tenant_read"      ON public.assignment_overrides FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_staff());
CREATE POLICY "dispatcher_write" ON public.assignment_overrides FOR ALL
  USING (public.is_org_dispatcher(org_id) OR public.is_staff())
  WITH CHECK (public.is_org_dispatcher(org_id) OR public.is_staff());

CREATE POLICY "tenant_read"      ON public.org_responder_links FOR SELECT
  USING (public.is_org_member(org_id) OR public.is_staff());
CREATE POLICY "dispatcher_write" ON public.org_responder_links FOR ALL
  USING (public.is_org_dispatcher(org_id) OR public.is_staff())
  WITH CHECK (public.is_org_dispatcher(org_id) OR public.is_staff());

CREATE POLICY "responder_self_assignment" ON public.incident_assignments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.units u
             WHERE u.id = incident_assignments.unit_id
               AND u.responder_id = auth.uid())
  );

CREATE POLICY "responder_parent_incident" ON public.incidents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.incident_assignments ia
              JOIN public.units u ON u.id = ia.unit_id
             WHERE ia.incident_id = incidents.id
               AND u.responder_id = auth.uid())
  );

GRANT SELECT ON public.incident_assignments_v TO authenticated;

-- ════════════════════════════════════════════════════
-- Seed: TMMT Rentals as Tenant #1 with the owner as tenant_admin + dispatcher.
-- Idempotent: re-running the migration is a no-op for these inserts.
-- ════════════════════════════════════════════════════

INSERT INTO public.org_roles (org_id, user_id, role)
SELECT o.id, p.id, 'tenant_admin'
FROM public.organizations o
JOIN public.profiles p ON p.organization_id = o.id
WHERE o.name = 'TMMT Rentals' AND p.role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.org_roles (org_id, user_id, role)
SELECT o.id, p.id, 'dispatcher'
FROM public.organizations o
JOIN public.profiles p ON p.organization_id = o.id
WHERE o.name = 'TMMT Rentals' AND p.role = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
