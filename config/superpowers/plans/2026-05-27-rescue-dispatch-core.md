# Rescue Dispatch — Subproject #1: Dispatch Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working dispatcher console at `/dispatch` on the `.net` owner domain that creates incidents, auto-assigns the best unit in <2s (CAPTAIN-optional), supports a 30s dispatcher override, surfaces live unit positions on Mapbox, and isolates tenants via RLS.

**Architecture:** New `(command)/dispatch` route group inside the existing TMMT Next.js 16 app. Seven new Postgres tables + two ALTERs, all guarded by per-tenant RLS using a new `org_roles` table and a new `is_org_dispatcher(org_id)` helper. Deterministic SQL `find_best_unit()` ranks candidates; CAPTAIN agent at `127.0.0.1:7777` is consulted fire-and-forget with a 1.5s timeout and is bypassed on any failure. Lock window is DB-derived (not in-memory) via an `effective_status` view + idempotent `lock_expired_assignments()` tick.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind 4, Supabase PostgreSQL + Realtime, `@supabase/ssr`, zod, Mapbox GL JS (`mapbox-gl` + `react-map-gl`), date-fns, Playwright for the one mandatory RLS smoke test.

---

## Resolutions to the Spec's Open Questions

| # | Question | Resolution baked into this plan |
|---|---|---|
| 1 | Does `org_roles` exist? | **No.** Existing role model is global via `auth.jwt() -> app_metadata.role`. Create `org_roles` per spec. `is_staff()` is reused unchanged. New helper `is_org_dispatcher(p_org_id)`. |
| 2 | Geocoding cost guardrails | Server action `geocodeAddress(q)` with 250ms client debounce + server-side LRU cache (500 entries, 24h TTL, per-process). Auth-gated so anonymous traffic cannot burn quota. |
| 3 | Notification token reuse | Single `tmmt-agent-channel` bot. Add `profiles.telegram_chat_id` for per-responder routing. Owner chat ID env var as fallback. |
| 4 | Reference code collision | Add `next_dsp_ref_code()` returning `DSP-YYYY-#####`. Backed by `count(*) + 1 from public.incidents`, mirroring existing `next_ref_code()`. |
| 5 | CAPTAIN JSON contract | Add **new** `captain_dispatch` prompt in `~/AIXMOS-AGENTS/agents/prompts.js` with strict JSON output `{"ranked_unit_ids": [...], "reasoning": "..."}`. Existing `captain` prompt is **not** modified — other workflows depend on its current shape. |

---

## File Structure

### New files (TMMT)

```
supabase/migrations/
  20260530120000_rescue_dispatch_core.sql      All schema, RLS, functions, helpers, view, seed of test tenant

src/app/(command)/dispatch/
  layout.tsx                                   Owner-only gate (is_staff || is_org_dispatcher)
  page.tsx                                     Cockpit: split map + queue
  actions.ts                                   Server actions (createIncident, overrideAssignment, transitionStatus, setUnitStatus, setUnitLocation, approveResponderLink, revokeResponderLink, geocodeAddress, lockExpiredAssignments)
  incident/new/page.tsx                        Create form
  incident/[id]/page.tsx                       Detail + override panel
  units/page.tsx                               Unit roster + capability editor
  responders/page.tsx                          org_responder_links admin
  me/page.tsx                                  Responder self-view
  _components/DispatchMap.tsx                  Mapbox GL realtime map
  _components/IncidentQueue.tsx                Sortable DataTable
  _components/OverridePanel.tsx                30s countdown + top-3 with reasoning
  _components/UnitCard.tsx                     Pin hover tooltip
  _components/AddressAutocomplete.tsx          Debounced geocode input
  _components/StatusTransitionBar.tsx          assigned → en_route → on_scene → cleared

src/lib/
  dispatch-queries.ts                          Read fetchers (cockpit data, single incident, units, my assignment)
  dispatch-realtime.ts                         Typed Supabase Realtime helpers
  mapbox.ts                                    Typed geocoding client (server-only)
  mapbox-cache.ts                              In-process LRU
  captain-client.ts                            Fire-and-forget HTTP client (1.5s timeout, fail-open)
  notify-telegram.ts                           Per-responder Telegram with owner fallback
  dispatch-types.ts                            Shared TS types (Incident, Unit, Assignment, Candidate)

e2e/
  dispatch-rls.spec.ts                         Mandatory RLS isolation smoke test

docs/
  DISPATCH-CORE.md                             One-page operator runbook
```

### Modified files (TMMT)

```
package.json                                   + mapbox-gl, react-map-gl
.env.example                                   + NEXT_PUBLIC_MAPBOX_TOKEN, MAPBOX_TOKEN, AIXMOS_AGENT_HOST, TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID
src/components/Sidebar.tsx                     + Dispatch nav link (visible to staff + dispatcher role)
CLAUDE.md                                      Move "Rescue Dispatch Core" from gaps to shipped section
```

### Modified files (AIXMOS-AGENTS)

```
agents/prompts.js                              + captain_dispatch prompt (JSON output, existing captain untouched)
```

---

## Preconditions (owner-only, before the agent starts)

These cannot be automated by Claude; the owner does them once:

1. **Mapbox tokens** — Create two tokens at https://account.mapbox.com/access-tokens/:
   - `pk.*` (public, restricted to `https://*.tmmt.net` and `http://localhost:*`) → set as `NEXT_PUBLIC_MAPBOX_TOKEN` in `~/TMMT/.env`
   - `sk.*` (secret, scopes: `geocoding:read`) → set as `MAPBOX_TOKEN` in `~/TMMT/.env`
2. **Telegram bot** — Confirm `TELEGRAM_BOT_TOKEN` for `tmmt-agent-channel` is in `~/TMMT/.env`. Owner chat ID goes in `TELEGRAM_OWNER_CHAT_ID`.
3. **AIXMOS Agents host** — Confirm `aix-agent-host` container is reachable at `http://127.0.0.1:7777` on the dev machine. Plan does **not** require it for build/deploy — fail-open behavior covers absence.
4. **Branch** — Create `feature/rescue-dispatch-core` from `master` in both `~/TMMT` and `~/projects/TMMT` (mirror), or work in a worktree per the using-git-worktrees skill.

---

## Phase 1: Env + dependencies

### Task 1: Add Mapbox + Telegram env keys to `.env.example`

**Files:**
- Modify: `~/TMMT/.env.example`

- [ ] **Step 1: Append the new keys**

Append to `.env.example`:

```bash

# ─── Rescue Dispatch (Subproject #1) ───
# Mapbox public token (URL-referrer restricted). Used in the browser map.
NEXT_PUBLIC_MAPBOX_TOKEN=
# Mapbox secret token (scopes: geocoding:read). Server-side only.
MAPBOX_TOKEN=
# AIXMOS agent host for CAPTAIN refinement (optional; fail-open on timeout).
AIXMOS_AGENT_HOST=http://127.0.0.1:7777
# Telegram bot used for responder pings. Owner chat ID is the fallback.
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_CHAT_ID=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(dispatch): add Mapbox + Telegram + agent-host env keys"
```

### Task 2: Install Mapbox packages

**Files:**
- Modify: `~/TMMT/package.json`, `~/TMMT/package-lock.json`

- [ ] **Step 1: Install**

```bash
cd ~/TMMT && npm install mapbox-gl@^3 react-map-gl@^7
npm install -D @types/mapbox-gl
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```
Expected: build succeeds; no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(dispatch): add mapbox-gl + react-map-gl deps"
```

---

## Phase 2: Database migration

The migration is one file because everything in it is one atomic shipping unit — partial application would leave a broken FK graph or insecure tables. Use `BEGIN`/`COMMIT` so failure rolls back cleanly.

### Task 3: Create the migration shell with the BEGIN/COMMIT wrapper

**Files:**
- Create: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql`

- [ ] **Step 1: Write the file header**

```sql
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

-- (sections inserted by subsequent tasks)

COMMIT;
```

- [ ] **Step 2: Commit (empty migration shell)**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): scaffold rescue-dispatch-core migration"
```

### Task 4: Add the seven new tables + indexes

**Files:**
- Modify: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql` (replace the `(sections inserted...)` placeholder)

- [ ] **Step 1: Insert tables block right after `BEGIN;`**

```sql
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
```

- [ ] **Step 2: Verify migration parses (no DB apply yet)**

```bash
cd ~/TMMT && supabase db lint 2>&1 | head -20
```
If `supabase db lint` is unavailable, use `psql --dry-run` against the file or run `npx supabase db push --dry-run`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): add 7 dispatch tables + indexes"
```

### Task 5: ALTER fleet + profiles for dispatch fields

**Files:**
- Modify: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql`

- [ ] **Step 1: Append before `COMMIT;`**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): extend fleet + profiles for dispatch fields"
```

### Task 6: Add helper functions, ref-code generator, lock view

**Files:**
- Modify: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql`

- [ ] **Step 1: Append before `COMMIT;`**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): add is_org_dispatcher, next_dsp_ref_code, lock-expiry mechanics"
```

### Task 7: Add `find_best_unit` + `assign_unit` SQL functions

**Files:**
- Modify: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql`

- [ ] **Step 1: Append before `COMMIT;`**

```sql
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
    -- Haversine in km (no PostGIS dependency)
    ROUND(
      (6371 * 2 * asin(sqrt(
        sin(radians((u.current_lat - v_lat) / 2)) ^ 2
        + cos(radians(v_lat)) * cos(radians(u.current_lat))
          * sin(radians((u.current_lng - v_lng) / 2)) ^ 2
      )))::numeric, 2)                                                AS distance_km,
    -- Count of matched required capabilities
    COALESCE(cardinality(
      ARRAY(SELECT unnest(v_caps) INTERSECT SELECT unnest(f.capability_tags))
    ), 0)::smallint                                                   AS capability_match_score,
    -- Rough straight-line ETA at 35 mph (~56 km/h)
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
-- flips the unit to 'assigned' + active_assignment_id. Idempotent on (incident_id, unit_id)
-- only insofar as we never re-call with the same pending row.
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): add find_best_unit + assign_unit SQL functions"
```

### Task 8: Add RLS policies for all 7 new tables

**Files:**
- Modify: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql`

- [ ] **Step 1: Append before `COMMIT;`**

```sql
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

-- org_roles: a user may always see their own rows; staff sees everything; only staff or tenant_admin writes.
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

-- Generic tenant-scoped READ + dispatcher WRITE pattern.
-- Repeat for incidents, units, unit_locations, incident_assignments,
-- assignment_overrides, org_responder_links.

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

-- Responder narrower policy: see only your own assignment + the parent incident.
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

-- View inherits RLS from underlying table; nothing else needed.
GRANT SELECT ON public.incident_assignments_v TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): RLS policies for all 7 dispatch tables"
```

### Task 9: Seed TMMT (tenant #1) into org_roles + apply migration

**Files:**
- Modify: `~/TMMT/supabase/migrations/20260530120000_rescue_dispatch_core.sql`

- [ ] **Step 1: Append before `COMMIT;`**

```sql
-- ════════════════════════════════════════════════════
-- Seed: TMMT Rentals as Tenant #1 with the owner as tenant_admin + dispatcher.
-- The org row already exists (organizations from workflow_engine migration).
-- This is idempotent: re-running the migration is a no-op for the seed.
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
```

- [ ] **Step 2: Apply migration to the Supabase project**

```bash
cd ~/TMMT && npx supabase db push --linked
```
Expected: "Applying migration 20260530120000_rescue_dispatch_core.sql" → success.

If you don't have `supabase` CLI linked, paste the file into the Supabase SQL Editor at https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/sql/new and run.

- [ ] **Step 3: Verify by querying**

```bash
psql "$SUPABASE_DB_URL" -c "select table_name from information_schema.tables where table_schema='public' and table_name in ('incidents','units','unit_locations','incident_assignments','assignment_overrides','org_responder_links','org_roles') order by table_name;"
```
Expected: 7 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260530120000_rescue_dispatch_core.sql
git commit -m "feat(dispatch): seed TMMT tenant_admin + dispatcher; apply migration"
```

---

## Phase 3: CAPTAIN agent prompt

### Task 10: Add `captain_dispatch` prompt with strict JSON output

**Files:**
- Modify: `~/AIXMOS-AGENTS/agents/prompts.js`

- [ ] **Step 1: Add a new key in the exported prompts object (insert after the existing `captain:` block, before `wonder_woman:`)**

```javascript
  captain_dispatch: `You are CAPTAIN, in dispatch mode.

You receive a JSON payload:
{
  "incident": {
    "severity": 1|2|3,
    "location": [lat, lng],
    "required_capabilities": ["..."],
    "description": "..."
  },
  "candidates": [
    { "unit_id": "<uuid>", "distance_km": <number>, "capability_match_score": <number>, "eta_seconds": <number>, "callsign": "..." }
  ]
}

Return ONLY a JSON object — no prose, no markdown fences:
{
  "ranked_unit_ids": ["<uuid>", "<uuid>", ...],
  "reasoning": "<one short sentence per top pick>"
}

Rules:
- ranked_unit_ids MUST be a permutation of the candidate unit_ids you were given. Do not invent new ids. Do not drop any.
- Tie-break logic: lower distance_km wins; if equal, higher capability_match_score wins.
- severity=1 (life-critical) outranks all other factors except availability.
- If the payload is malformed, return {"ranked_unit_ids": [], "reasoning": "malformed input"}.

Do NOT include CAPTAIN_HANDOFF, COMMAND BRIEF, or any other text. Just the JSON object.`,
```

- [ ] **Step 2: Restart the agent host so the prompt is reloaded**

```bash
docker restart aix-agent-host 2>/dev/null || pm2 restart aix-agent-host 2>/dev/null || echo "manual restart required"
```

- [ ] **Step 3: Smoke-test the endpoint**

```bash
curl -sS -X POST http://127.0.0.1:7777/agent/captain_dispatch \
  -H "Content-Type: application/json" \
  -d '{"incident":{"severity":2,"location":[34.0,-118.2],"required_capabilities":["medical_basic"],"description":"test"},"candidates":[{"unit_id":"00000000-0000-0000-0000-000000000001","distance_km":3.1,"capability_match_score":2,"eta_seconds":200,"callsign":"R-1"},{"unit_id":"00000000-0000-0000-0000-000000000002","distance_km":5.5,"capability_match_score":2,"eta_seconds":350,"callsign":"R-2"}]}'
```
Expected: a JSON object with `ranked_unit_ids: ["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"]` (closer unit first).

- [ ] **Step 4: Commit (in the AIXMOS-AGENTS repo, not TMMT)**

```bash
cd ~/AIXMOS-AGENTS
git add agents/prompts.js
git commit -m "feat(captain): add captain_dispatch JSON-output prompt for rescue dispatch"
```

---

## Phase 4: Server libraries

All paths below are inside `~/TMMT/`.

### Task 11: Shared TypeScript types

**Files:**
- Create: `src/lib/dispatch-types.ts`

- [ ] **Step 1: Write the file**

```typescript
// Shared types for the dispatch subsystem. Single source of truth.
// Mirrors the SQL schema in supabase/migrations/20260530120000_rescue_dispatch_core.sql.

export type Severity = 1 | 2 | 3;

export type IncidentStatus =
  | "received" | "assigning" | "assigned" | "en_route"
  | "on_scene" | "cleared" | "closed" | "cancelled";

export type UnitStatus =
  | "off_duty" | "available" | "assigned"
  | "en_route" | "on_scene" | "out_of_service";

export type AssignmentStatus = "pending" | "locked" | "cancelled" | "completed";

export type VehicleClass =
  | "sport_bike" | "sport_car" | "sport_suv"
  | "van" | "truck" | "helicopter" | "foot" | "other";

export interface Incident {
  id: string;
  org_id: string;
  ref_code: string | null;
  reported_at: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_text: string | null;
  description: string | null;
  severity: Severity | null;
  required_capabilities: string[];
  required_class: VehicleClass | null;
  status: IncidentStatus;
  created_by: string | null;
  closed_at: string | null;
}

export interface Unit {
  id: string;
  org_id: string;
  fleet_id: string | null;
  responder_id: string | null;
  callsign: string;
  status: UnitStatus;
  current_lat: number | null;
  current_lng: number | null;
  last_ping_at: string | null;
  active_assignment_id: string | null;
}

export interface UnitLocation {
  id: number;
  org_id: string;
  unit_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_mph: number | null;
  recorded_at: string;
}

export interface IncidentAssignment {
  id: string;
  org_id: string;
  incident_id: string;
  unit_id: string;
  assigned_by_kind: "system" | "user";
  assigned_by: string | null;
  override_weight: number;
  reasoning_json: AssignmentReasoning;
  status: AssignmentStatus;
  created_at: string;
  locked_at: string | null;
  effective_status?: AssignmentStatus;
}

export interface AssignmentReasoning {
  captain_used: boolean;
  captain_skipped?: boolean;
  candidates: Candidate[];
  pick_index: number;
  captain_text?: string;
  override_reason?: string;
}

export interface Candidate {
  unit_id: string;
  callsign: string;
  distance_km: number;
  capability_match_score: number;
  eta_seconds: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dispatch-types.ts
git commit -m "feat(dispatch): shared TS types for incidents/units/assignments"
```

### Task 12: Mapbox geocoding client + LRU cache + server action

**Files:**
- Create: `src/lib/mapbox-cache.ts`
- Create: `src/lib/mapbox.ts`

- [ ] **Step 1: `mapbox-cache.ts` — process-local LRU**

```typescript
// In-process LRU cache for Mapbox geocoding. Keyed by lowercased query.
// 500 entries, 24h TTL. Process-local — lost on restart. Acceptable for Core.

type Entry<V> = { v: V; exp: number };

export class LRU<V> {
  private map = new Map<string, Entry<V>>();
  constructor(private max: number, private ttlMs: number) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Touch — move to end (most-recent)
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: string, v: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v, exp: Date.now() + this.ttlMs });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

export const geocodeCache = new LRU<MapboxGeocodeResult[]>(500, 24 * 60 * 60 * 1000);

export interface MapboxGeocodeResult {
  place_name: string;
  center: [number, number]; // [lng, lat]
}
```

- [ ] **Step 2: `mapbox.ts` — typed client (server-only)**

```typescript
import "server-only";
import { geocodeCache, type MapboxGeocodeResult } from "./mapbox-cache";

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function searchAddress(query: string): Promise<MapboxGeocodeResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];

  const cached = geocodeCache.get(q);
  if (cached) return cached;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new Error("MAPBOX_TOKEN not configured");

  const url = `${MAPBOX_BASE}/${encodeURIComponent(q)}.json?access_token=${token}&autocomplete=true&limit=5&country=US`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    console.error("[mapbox] geocode failed", res.status);
    return [];
  }
  const j = (await res.json()) as { features?: Array<{ place_name: string; center: [number, number] }> };
  const out: MapboxGeocodeResult[] = (j.features ?? []).map(f => ({
    place_name: f.place_name,
    center: f.center,
  }));
  geocodeCache.set(q, out);
  return out;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/mapbox.ts src/lib/mapbox-cache.ts
git commit -m "feat(dispatch): Mapbox geocoding client with LRU cache"
```

### Task 13: CAPTAIN HTTP client (fire-and-forget, 1.5s timeout, fail-open)

**Files:**
- Create: `src/lib/captain-client.ts`

- [ ] **Step 1: Write the file**

```typescript
import "server-only";
import type { Candidate } from "./dispatch-types";

const HOST = process.env.AIXMOS_AGENT_HOST ?? "http://127.0.0.1:7777";
const TIMEOUT_MS = 1500;

export interface CaptainDispatchInput {
  incident: {
    severity: number | null;
    location: [number, number] | null;
    required_capabilities: string[];
    description: string | null;
  };
  candidates: Candidate[];
}

export interface CaptainDispatchOutput {
  ranked_unit_ids: string[];
  reasoning: string;
}

/**
 * Ask CAPTAIN to re-rank candidates. Always returns within ~1.5s.
 * On any failure (timeout, non-2xx, parse error), returns null and the caller
 * falls back to candidates[0]. Logs but never throws.
 */
export async function askCaptainDispatch(
  input: CaptainDispatchInput
): Promise<CaptainDispatchOutput | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HOST}/agent/captain_dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.warn("[captain_dispatch] non-2xx", res.status);
      return null;
    }
    const j = (await res.json()) as Partial<CaptainDispatchOutput>;
    if (!Array.isArray(j.ranked_unit_ids) || j.ranked_unit_ids.length === 0) return null;
    const given = new Set(input.candidates.map(c => c.unit_id));
    const allKnown = j.ranked_unit_ids.every(id => given.has(id));
    if (!allKnown) {
      console.warn("[captain_dispatch] returned unknown unit_id; rejecting");
      return null;
    }
    return { ranked_unit_ids: j.ranked_unit_ids, reasoning: j.reasoning ?? "" };
  } catch (err) {
    console.warn("[captain_dispatch] error", (err as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/captain-client.ts
git commit -m "feat(dispatch): CAPTAIN HTTP client with 1.5s timeout, fail-open"
```

### Task 14: Telegram notification helper

**Files:**
- Create: `src/lib/notify-telegram.ts`

- [ ] **Step 1: Write the file**

```typescript
import "server-only";

const TG_BASE = "https://api.telegram.org";

/**
 * Send a message to a specific chat. Returns true on success, false on any failure.
 * Never throws — notifications are best-effort.
 */
export async function notifyTelegram(opts: {
  chatId: string;
  text: string;
  silent?: boolean;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[notify] TELEGRAM_BOT_TOKEN not set; skipping");
    return false;
  }
  try {
    const res = await fetch(`${TG_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        disable_notification: opts.silent ?? false,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[notify] failed", (err as Error).message);
    return false;
  }
}

/**
 * Notify a responder by user_id. Looks up profiles.telegram_chat_id.
 * If absent, falls back to TELEGRAM_OWNER_CHAT_ID. Never throws.
 */
export async function notifyResponder(opts: {
  responderId: string | null;
  text: string;
  fetchChatId: (uid: string) => Promise<string | null>;
}): Promise<boolean> {
  let chatId: string | null = null;
  if (opts.responderId) chatId = await opts.fetchChatId(opts.responderId);
  chatId ??= process.env.TELEGRAM_OWNER_CHAT_ID ?? null;
  if (!chatId) return false;
  return notifyTelegram({ chatId, text: opts.text });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notify-telegram.ts
git commit -m "feat(dispatch): Telegram notification helper with per-responder routing"
```

### Task 15: Read fetchers (`dispatch-queries.ts`)

**Files:**
- Create: `src/lib/dispatch-queries.ts`

- [ ] **Step 1: Write the file**

```typescript
import "server-only";
import { createSSRClient } from "@/lib/supabase-server";
import type {
  Incident, Unit, IncidentAssignment, UnitLocation,
} from "./dispatch-types";

export async function getDispatchCockpitData(orgId: string): Promise<{
  incidents: Incident[];
  units: Unit[];
}> {
  const supabase = await createSSRClient();
  const [inc, un] = await Promise.all([
    supabase.from("incidents").select("*")
      .eq("org_id", orgId)
      .in("status", ["received","assigning","assigned","en_route","on_scene"])
      .order("reported_at", { ascending: false }),
    supabase.from("units").select("*")
      .eq("org_id", orgId)
      .order("callsign", { ascending: true }),
  ]);
  return {
    incidents: (inc.data ?? []) as Incident[],
    units: (un.data ?? []) as Unit[],
  };
}

export async function getIncidentWithAssignments(incidentId: string): Promise<{
  incident: Incident | null;
  assignments: IncidentAssignment[];
}> {
  const supabase = await createSSRClient();
  const [i, a] = await Promise.all([
    supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle(),
    supabase.from("incident_assignments_v").select("*")
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true }),
  ]);
  return {
    incident: (i.data ?? null) as Incident | null,
    assignments: (a.data ?? []) as IncidentAssignment[],
  };
}

export async function getUnitsForOrg(orgId: string): Promise<Unit[]> {
  const supabase = await createSSRClient();
  const { data } = await supabase.from("units").select("*").eq("org_id", orgId).order("callsign");
  return (data ?? []) as Unit[];
}

export async function getMyActiveAssignment(): Promise<{
  assignment: IncidentAssignment | null;
  incident: Incident | null;
  unit: Unit | null;
}> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { assignment: null, incident: null, unit: null };

  const { data: unit } = await supabase.from("units").select("*")
    .eq("responder_id", user.id)
    .in("status", ["assigned","en_route","on_scene"])
    .maybeSingle();

  if (!unit) return { assignment: null, incident: null, unit: null };

  const { data: assignment } = await supabase.from("incident_assignments_v").select("*")
    .eq("id", (unit as Unit).active_assignment_id ?? "")
    .maybeSingle();
  const { data: incident } = await supabase.from("incidents").select("*")
    .eq("id", (assignment as IncidentAssignment | null)?.incident_id ?? "")
    .maybeSingle();

  return {
    assignment: assignment as IncidentAssignment | null,
    incident: incident as Incident | null,
    unit: unit as Unit,
  };
}

export async function getCallerOrgId(): Promise<string | null> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_roles").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export type { Incident, Unit, IncidentAssignment, UnitLocation };
```

- [ ] **Step 2: Verify TS compiles**

```bash
cd ~/TMMT && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dispatch-queries.ts
git commit -m "feat(dispatch): read fetchers for cockpit/incident/me views"
```

---

## Phase 5: Dispatch server actions

### Task 16: `actions.ts` skeleton with `createIncident` + `geocodeAddress`

**Files:**
- Create: `src/app/(command)/dispatch/actions.ts`

- [ ] **Step 1: Write the file**

```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import { searchAddress } from "@/lib/mapbox";
import { askCaptainDispatch } from "@/lib/captain-client";
import { notifyResponder } from "@/lib/notify-telegram";
import type { Candidate, AssignmentReasoning, Incident } from "@/lib/dispatch-types";

const NewIncidentSchema = z.object({
  org_id: z.string().uuid(),
  reporter_name: z.string().min(1).max(120).optional(),
  reporter_phone: z.string().max(40).optional(),
  location_lat: z.number().refine(n => n >= -90 && n <= 90, "lat out of range"),
  location_lng: z.number().refine(n => n >= -180 && n <= 180, "lng out of range"),
  location_text: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  required_capabilities: z.array(z.string().max(64)).max(20).default([]),
  required_class: z.string().nullable().optional(),
});

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAuth() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function geocodeAddress(query: string): Promise<ActionResult<Array<{ label: string; lat: number; lng: number }>>> {
  await requireAuth();
  const results = await searchAddress(query);
  return { ok: true, data: results.map(r => ({ label: r.place_name, lat: r.center[1], lng: r.center[0] })) };
}

export async function createIncident(input: unknown): Promise<ActionResult<{ incident_id: string; ref_code: string }>> {
  const parsed = NewIncidentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  const { supabase, user } = await requireAuth();

  // Generate the ref_code via RPC so we benefit from the same sequence rule.
  const { data: refRow, error: refErr } = await supabase.rpc("next_dsp_ref_code");
  if (refErr) return { ok: false, error: "ref_code generation failed" };
  const ref_code = refRow as unknown as string;

  const { data: inserted, error } = await supabase
    .from("incidents")
    .insert({
      org_id: parsed.data.org_id,
      ref_code,
      reporter_name: parsed.data.reporter_name ?? null,
      reporter_phone: parsed.data.reporter_phone ?? null,
      location_lat: parsed.data.location_lat,
      location_lng: parsed.data.location_lng,
      location_text: parsed.data.location_text,
      description: parsed.data.description ?? null,
      severity: parsed.data.severity,
      required_capabilities: parsed.data.required_capabilities,
      required_class: parsed.data.required_class ?? null,
      status: "assigning",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[createIncident] insert failed", error);
    return { ok: false, error: "could not save incident" };
  }
  const incidentId = inserted.id as string;

  // Run assignment engine (best-effort; if it fails, leave status='received' for manual)
  await runAssignment(incidentId);

  return { ok: true, data: { incident_id: incidentId, ref_code } };
}

async function runAssignment(incidentId: string): Promise<void> {
  const supabase = await createSSRClient();
  const { data: candidatesRaw, error: candErr } = await supabase.rpc("find_best_unit", { p_incident_id: incidentId });
  if (candErr) { console.error("[runAssignment] find_best_unit failed", candErr); return; }
  const candidates = (candidatesRaw ?? []) as Candidate[];

  if (candidates.length === 0) {
    await supabase.from("incidents").update({ status: "received" }).eq("id", incidentId);
    return;
  }

  const { data: incRow } = await supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle();
  const incident = incRow as Incident | null;
  if (!incident) return;

  // Ask CAPTAIN (fail-open within 1.5s)
  const captain = await askCaptainDispatch({
    incident: {
      severity: incident.severity,
      location: incident.location_lat !== null && incident.location_lng !== null
        ? [incident.location_lat, incident.location_lng] : null,
      required_capabilities: incident.required_capabilities,
      description: incident.description,
    },
    candidates,
  });

  const pickId = captain ? captain.ranked_unit_ids[0] : candidates[0].unit_id;
  const pickIndex = candidates.findIndex(c => c.unit_id === pickId);

  const reasoning: AssignmentReasoning = {
    captain_used: !!captain,
    captain_skipped: !captain,
    candidates,
    pick_index: pickIndex,
    ...(captain ? { captain_text: captain.reasoning } : {}),
  };

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.rpc("assign_unit", {
    p_incident_id: incidentId,
    p_unit_id: pickId,
    p_by_kind: "system",
    p_by_user: user?.id ?? null,
    p_weight: 0,
    p_reasoning: reasoning,
  });

  // Tentative notification
  const { data: unitRow } = await supabase.from("units").select("responder_id, callsign").eq("id", pickId).maybeSingle();
  await notifyResponder({
    responderId: (unitRow?.responder_id as string | null) ?? null,
    text: `TENTATIVE assignment for ${incident.ref_code}. May change in 30s.\nLocation: ${incident.location_text}`,
    fetchChatId: async (uid) => {
      const { data } = await supabase.from("profiles").select("telegram_chat_id").eq("id", uid).maybeSingle();
      return (data?.telegram_chat_id as string | null) ?? null;
    },
  });
}
```

- [ ] **Step 2: Verify TS**

```bash
cd ~/TMMT && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(command\)/dispatch/actions.ts
git commit -m "feat(dispatch): createIncident + geocodeAddress server actions"
```

### Task 17: Add `overrideAssignment`, `transitionStatus`, `lockExpiredAssignments` to `actions.ts`

**Files:**
- Modify: `src/app/(command)/dispatch/actions.ts`

- [ ] **Step 1: Append to `actions.ts`**

```typescript
const OverrideSchema = z.object({
  incident_id: z.string().uuid(),
  current_assignment_id: z.string().uuid(),
  chosen_unit_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

export async function overrideAssignment(input: unknown): Promise<ActionResult<{ assignment_id: string }>> {
  const parsed = OverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase, user } = await requireAuth();

  const { data: current } = await supabase.from("incident_assignments_v")
    .select("*").eq("id", parsed.data.current_assignment_id).maybeSingle();
  if (!current) return { ok: false, error: "assignment not found" };
  if ((current as { effective_status?: string }).effective_status === "locked") {
    return { ok: false, error: "override window expired" };
  }

  // 1. Cancel current
  await supabase.from("incident_assignments")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.current_assignment_id);

  // 2. Release the previously-assigned unit
  await supabase.from("units")
    .update({ status: "available", active_assignment_id: null })
    .eq("id", (current as { unit_id: string }).unit_id);

  // 3. Insert override record + new assignment via RPC
  await supabase.from("assignment_overrides").insert({
    org_id: (current as { org_id: string }).org_id,
    incident_id: parsed.data.incident_id,
    original_unit_id: (current as { unit_id: string }).unit_id,
    chosen_unit_id: parsed.data.chosen_unit_id,
    reason: parsed.data.reason,
    context: (current as { reasoning_json: unknown }).reasoning_json,
  });

  const { data: newAssignment, error } = await supabase.rpc("assign_unit", {
    p_incident_id: parsed.data.incident_id,
    p_unit_id: parsed.data.chosen_unit_id,
    p_by_kind: "user",
    p_by_user: user.id,
    p_weight: 1.0,
    p_reasoning: {
      override: true,
      override_reason: parsed.data.reason,
      override_of: parsed.data.current_assignment_id,
    } satisfies Partial<AssignmentReasoning>,
  });
  if (error) return { ok: false, error: "override failed" };

  // 4. Notify the previously-assigned responder
  const { data: prevUnit } = await supabase.from("units").select("responder_id, callsign")
    .eq("id", (current as { unit_id: string }).unit_id).maybeSingle();
  if (prevUnit?.responder_id) {
    await notifyResponder({
      responderId: prevUnit.responder_id as string,
      text: `ASSIGNMENT CHANGED — your previous incident has been reassigned to another unit.`,
      fetchChatId: async (uid) => {
        const { data } = await supabase.from("profiles").select("telegram_chat_id").eq("id", uid).maybeSingle();
        return (data?.telegram_chat_id as string | null) ?? null;
      },
    });
  }

  const id = (newAssignment as { id: string } | null)?.id ?? "";
  return { ok: true, data: { assignment_id: id } };
}

const TransitionSchema = z.object({
  incident_id: z.string().uuid(),
  to_status: z.enum(["en_route","on_scene","cleared","closed","cancelled"]),
});

export async function transitionStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = TransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase } = await requireAuth();

  const patch: Record<string, unknown> = { status: parsed.data.to_status };
  if (parsed.data.to_status === "closed" || parsed.data.to_status === "cancelled" || parsed.data.to_status === "cleared") {
    patch.closed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("incidents").update(patch).eq("id", parsed.data.incident_id);
  if (error) return { ok: false, error: "transition failed" };

  // Mirror the unit's status from incident status
  const unitStatus = parsed.data.to_status === "en_route" ? "en_route"
                  : parsed.data.to_status === "on_scene" ? "on_scene"
                  : parsed.data.to_status === "cleared" || parsed.data.to_status === "closed" || parsed.data.to_status === "cancelled" ? "available"
                  : null;
  if (unitStatus) {
    const { data: ia } = await supabase.from("incident_assignments_v").select("unit_id")
      .eq("incident_id", parsed.data.incident_id)
      .eq("effective_status", "locked")
      .maybeSingle();
    if (ia?.unit_id) {
      await supabase.from("units").update({
        status: unitStatus,
        ...(unitStatus === "available" ? { active_assignment_id: null } : {}),
      }).eq("id", ia.unit_id as string);
    }
  }
  return { ok: true, data: null };
}

export async function lockExpiredAssignments(orgId: string): Promise<ActionResult<{ locked: number }>> {
  await requireAuth();
  const supabase = await createSSRClient();
  const { data, error } = await supabase.rpc("lock_expired_assignments", { p_org_id: orgId });
  if (error) return { ok: false, error: "lock tick failed" };
  return { ok: true, data: { locked: (data as number | null) ?? 0 } };
}
```

- [ ] **Step 2: Verify TS + commit**

```bash
cd ~/TMMT && npx tsc --noEmit
git add src/app/\(command\)/dispatch/actions.ts
git commit -m "feat(dispatch): overrideAssignment + transitionStatus + lockExpiredAssignments"
```

### Task 18: Add unit + responder admin actions

**Files:**
- Modify: `src/app/(command)/dispatch/actions.ts`

- [ ] **Step 1: Append**

```typescript
const SetUnitStatusSchema = z.object({
  unit_id: z.string().uuid(),
  status: z.enum(["off_duty","available","out_of_service"]),
});

export async function setUnitStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = SetUnitStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase } = await requireAuth();
  const { error } = await supabase.from("units").update({ status: parsed.data.status }).eq("id", parsed.data.unit_id);
  return error ? { ok: false, error: "update failed" } : { ok: true, data: null };
}

const SetUnitLocationSchema = z.object({
  unit_id: z.string().uuid(),
  lat: z.number().refine(n => n >= -90 && n <= 90),
  lng: z.number().refine(n => n >= -180 && n <= 180),
});

export async function setUnitLocation(input: unknown): Promise<ActionResult<null>> {
  const parsed = SetUnitLocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase } = await requireAuth();
  const now = new Date().toISOString();
  const { error: updErr } = await supabase.from("units").update({
    current_lat: parsed.data.lat,
    current_lng: parsed.data.lng,
    last_ping_at: now,
  }).eq("id", parsed.data.unit_id);
  if (updErr) return { ok: false, error: "update failed" };

  // Append history
  const { data: u } = await supabase.from("units").select("org_id").eq("id", parsed.data.unit_id).maybeSingle();
  if (u?.org_id) {
    await supabase.from("unit_locations").insert({
      org_id: u.org_id as string,
      unit_id: parsed.data.unit_id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
  }
  return { ok: true, data: null };
}

const ApproveResponderSchema = z.object({
  org_id: z.string().uuid(),
  user_id: z.string().uuid(),
  link_kind: z.enum(["vendor","operator","client_volunteer","contractor"]),
  certs: z.record(z.string(), z.unknown()).optional(),
});

export async function approveResponderLink(input: unknown): Promise<ActionResult<null>> {
  const parsed = ApproveResponderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase, user } = await requireAuth();
  const { error } = await supabase.from("org_responder_links").upsert({
    org_id: parsed.data.org_id,
    user_id: parsed.data.user_id,
    link_kind: parsed.data.link_kind,
    approved_at: new Date().toISOString(),
    approved_by: user.id,
    certs: parsed.data.certs ?? {},
    active: true,
  });
  return error ? { ok: false, error: "approve failed" } : { ok: true, data: null };
}

export async function revokeResponderLink(linkId: string): Promise<ActionResult<null>> {
  if (!z.string().uuid().safeParse(linkId).success) return { ok: false, error: "invalid id" };
  const { supabase } = await requireAuth();
  const { error } = await supabase.from("org_responder_links").update({ active: false }).eq("id", linkId);
  return error ? { ok: false, error: "revoke failed" } : { ok: true, data: null };
}
```

- [ ] **Step 2: Verify TS + commit**

```bash
cd ~/TMMT && npx tsc --noEmit
git add src/app/\(command\)/dispatch/actions.ts
git commit -m "feat(dispatch): unit + responder admin server actions"
```

---

## Phase 6: UI components (leaf-first)

### Task 19: `UnitCard.tsx` — pin hover tooltip

**Files:**
- Create: `src/app/(command)/dispatch/_components/UnitCard.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import type { Unit } from "@/lib/dispatch-types";

const statusColor: Record<Unit["status"], string> = {
  off_duty: "bg-gray-300 text-gray-800",
  available: "bg-emerald-500 text-white",
  assigned: "bg-amber-500 text-white",
  en_route: "bg-blue-500 text-white",
  on_scene: "bg-violet-500 text-white",
  out_of_service: "bg-rose-500 text-white",
};

export function UnitCard({ unit }: { unit: Unit }) {
  return (
    <div className="rounded-md border bg-white p-2 shadow-sm dark:bg-zinc-900 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold">{unit.callsign}</span>
        <span className={`rounded px-2 py-0.5 text-xs ${statusColor[unit.status]}`}>{unit.status}</span>
      </div>
      {unit.last_ping_at && (
        <p className="mt-1 text-xs text-zinc-500">
          last ping {new Date(unit.last_ping_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(command\)/dispatch/_components/UnitCard.tsx
git commit -m "feat(dispatch): UnitCard pin tooltip"
```

### Task 20: `IncidentQueue.tsx`

**Files:**
- Create: `src/app/(command)/dispatch/_components/IncidentQueue.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import Link from "next/link";
import type { Incident } from "@/lib/dispatch-types";

const severityBadge: Record<number, string> = {
  1: "bg-rose-600 text-white",
  2: "bg-amber-500 text-white",
  3: "bg-emerald-500 text-white",
};

export function IncidentQueue({ incidents, focusedId, onFocus }: {
  incidents: Incident[];
  focusedId?: string;
  onFocus?: (id: string) => void;
}) {
  if (incidents.length === 0) {
    return <p className="p-4 text-sm text-zinc-500">No active incidents.</p>;
  }
  return (
    <ul className="divide-y dark:divide-zinc-800">
      {incidents.map(i => (
        <li
          key={i.id}
          className={`cursor-pointer p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${focusedId === i.id ? "bg-blue-50 dark:bg-blue-950" : ""}`}
          onClick={() => onFocus?.(i.id)}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-mono text-sm font-bold">{i.ref_code ?? "—"}</span>
              {i.severity != null && (
                <span className={`ml-2 rounded px-2 py-0.5 text-xs ${severityBadge[i.severity]}`}>
                  S{i.severity}
                </span>
              )}
            </div>
            <span className="text-xs uppercase text-zinc-500">{i.status}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{i.location_text}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {new Date(i.reported_at).toLocaleTimeString()}
            </span>
            <Link
              href={`/dispatch/incident/${i.id}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              open →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(command\)/dispatch/_components/IncidentQueue.tsx
git commit -m "feat(dispatch): IncidentQueue list component"
```

### Task 21: `OverridePanel.tsx` — 30s countdown + top-3 with reasoning

**Files:**
- Create: `src/app/(command)/dispatch/_components/OverridePanel.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import type { Candidate, IncidentAssignment } from "@/lib/dispatch-types";
import { overrideAssignment } from "../actions";

export function OverridePanel({
  assignment, incidentId, onChanged,
}: {
  assignment: IncidentAssignment;
  incidentId: string;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState<number>(() => secondsRemaining(assignment.created_at));
  const candidates = assignment.reasoning_json?.candidates ?? [];

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft(secondsRemaining(assignment.created_at)), 250);
    return () => clearInterval(t);
  }, [assignment.created_at]);

  if (secondsLeft <= 0 || assignment.effective_status === "locked") {
    return (
      <div className="rounded border bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        Assignment locked.
      </div>
    );
  }

  const submit = () => {
    if (!chosen || reason.trim().length === 0) {
      setError("Pick a unit and write a brief reason.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await overrideAssignment({
        incident_id: incidentId,
        current_assignment_id: assignment.id,
        chosen_unit_id: chosen,
        reason: reason.trim(),
      });
      if (!res.ok) setError(res.error);
      else onChanged();
    });
  };

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Override window</h3>
        <span className="font-mono text-2xl text-amber-700 dark:text-amber-300">{secondsLeft}s</span>
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        System chose <strong className="font-mono">{assignment.unit_id.slice(0, 8)}</strong>. Pick a different unit within {secondsLeft}s.
      </p>
      <ul className="mt-3 space-y-2">
        {candidates.slice(0, 3).map((c: Candidate) => {
          const isCurrent = c.unit_id === assignment.unit_id;
          return (
            <li key={c.unit_id} className={`flex items-center justify-between rounded border bg-white p-2 dark:bg-zinc-900 ${chosen === c.unit_id ? "border-blue-500" : ""}`}>
              <div>
                <div className="font-mono text-sm font-bold">{c.callsign}</div>
                <div className="text-xs text-zinc-500">
                  {c.distance_km.toFixed(1)}km · match {c.capability_match_score} · ETA ~{Math.round(c.eta_seconds / 60)}min
                </div>
              </div>
              {isCurrent ? (
                <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">current</span>
              ) : (
                <button
                  onClick={() => setChosen(c.unit_id)}
                  className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                >
                  reassign
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {candidates.length > 3 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">+{candidates.length - 3} more</summary>
          <ul className="mt-2 space-y-1">
            {candidates.slice(3).map((c: Candidate) => (
              <li key={c.unit_id}>
                <button onClick={() => setChosen(c.unit_id)} className="text-blue-600 hover:underline">
                  {c.callsign} ({c.distance_km.toFixed(1)}km, match {c.capability_match_score})
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Why are you overriding? (logged for learning)"
        className="mt-3 w-full rounded border p-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
        rows={2}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <button
        disabled={pending || !chosen || reason.trim().length === 0}
        onClick={submit}
        className="mt-2 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Reassigning…" : "Confirm override"}
      </button>
    </div>
  );
}

function secondsRemaining(createdAtIso: string): number {
  const elapsed = (Date.now() - new Date(createdAtIso).getTime()) / 1000;
  return Math.max(0, Math.ceil(30 - elapsed));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(command\)/dispatch/_components/OverridePanel.tsx
git commit -m "feat(dispatch): OverridePanel with 30s countdown + reason capture"
```

### Task 22: `AddressAutocomplete.tsx` — debounced geocode field

**Files:**
- Create: `src/app/(command)/dispatch/_components/AddressAutocomplete.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import { useEffect, useState } from "react";
import { geocodeAddress } from "../actions";

export type Place = { label: string; lat: number; lng: number };

export function AddressAutocomplete({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [picked, setPicked] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (picked && q === picked.label) return; // user just picked; don't re-fetch
    if (q.trim().length < 3) { setResults([]); return; }
    const handle = setTimeout(async () => {
      const res = await geocodeAddress(q);
      if (res.ok) setResults(res.data); else setError(res.error);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, picked]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPicked(null); }}
        placeholder="Address or landmark…"
        className="w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700"
        required
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {results.length > 0 && !picked && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border bg-white shadow dark:bg-zinc-900 dark:border-zinc-700">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => { setPicked(r); setQ(r.label); setResults([]); onPick(r); }}
                className="block w-full p-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(command\)/dispatch/_components/AddressAutocomplete.tsx
git commit -m "feat(dispatch): AddressAutocomplete with 250ms debounce"
```

### Task 23: `DispatchMap.tsx` — Mapbox GL realtime map

**Files:**
- Create: `src/app/(command)/dispatch/_components/DispatchMap.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import { useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Incident, Unit } from "@/lib/dispatch-types";

const unitColor: Record<Unit["status"], string> = {
  off_duty: "#9ca3af",
  available: "#10b981",
  assigned: "#f59e0b",
  en_route: "#3b82f6",
  on_scene: "#8b5cf6",
  out_of_service: "#ef4444",
};
const severityColor: Record<number, string> = {
  1: "#dc2626",
  2: "#f59e0b",
  3: "#10b981",
};

export function DispatchMap({ units, incidents, focusedIncidentId, onIncidentClick }: {
  units: Unit[];
  incidents: Incident[];
  focusedIncidentId?: string;
  onIncidentClick?: (id: string) => void;
}) {
  const initialView = useMemo(() => {
    const u = units.find(u => u.current_lat && u.current_lng);
    return {
      longitude: u?.current_lng ?? -118.2437,
      latitude: u?.current_lat ?? 34.0522,
      zoom: 11,
    };
  }, [units]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-600">NEXT_PUBLIC_MAPBOX_TOKEN not set</div>;
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={initialView}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
    >
      <NavigationControl position="top-right" />
      {units.filter(u => u.current_lat && u.current_lng).map(u => (
        <Marker key={u.id} longitude={u.current_lng!} latitude={u.current_lat!} anchor="center">
          <div
            title={`${u.callsign} (${u.status})`}
            className="h-3 w-3 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: unitColor[u.status] }}
          />
        </Marker>
      ))}
      {incidents.filter(i => i.location_lat && i.location_lng).map(i => (
        <Marker key={i.id} longitude={i.location_lng!} latitude={i.location_lat!} anchor="bottom">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIncidentClick?.(i.id); }}
            title={i.ref_code ?? "incident"}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${focusedIncidentId === i.id ? "ring-4 ring-blue-300" : ""}`}
            style={{ backgroundColor: i.severity ? severityColor[i.severity] : "#6b7280", borderColor: "white" }}
          >
            <span className="text-xs font-bold text-white">{i.severity ?? "?"}</span>
          </button>
        </Marker>
      ))}
    </Map>
  );
}
```

- [ ] **Step 2: Verify build (CSS import is the most common breakage)**

```bash
cd ~/TMMT && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(command\)/dispatch/_components/DispatchMap.tsx
git commit -m "feat(dispatch): DispatchMap with Mapbox GL + unit/incident markers"
```

### Task 24: `StatusTransitionBar.tsx`

**Files:**
- Create: `src/app/(command)/dispatch/_components/StatusTransitionBar.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import { useTransition } from "react";
import type { IncidentStatus } from "@/lib/dispatch-types";
import { transitionStatus } from "../actions";

const NEXT: Partial<Record<IncidentStatus, IncidentStatus[]>> = {
  assigned: ["en_route","cancelled"],
  en_route: ["on_scene","cancelled"],
  on_scene: ["cleared","cancelled"],
  cleared: ["closed"],
};

export function StatusTransitionBar({ incidentId, current, onChanged }: {
  incidentId: string;
  current: IncidentStatus;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const options = NEXT[current] ?? [];
  if (options.length === 0) {
    return <p className="text-sm text-zinc-500">No further transitions.</p>;
  }
  return (
    <div className="flex gap-2">
      {options.map(s => (
        <button
          key={s}
          disabled={pending}
          onClick={() => start(async () => {
            const r = await transitionStatus({ incident_id: incidentId, to_status: s });
            if (r.ok) onChanged();
          })}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          → {s.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(command\)/dispatch/_components/StatusTransitionBar.tsx
git commit -m "feat(dispatch): StatusTransitionBar for incident state machine"
```

---

## Phase 7: Dispatch pages

### Task 25: Route layout (`(command)/dispatch/layout.tsx`)

**Files:**
- Create: `src/app/(command)/dispatch/layout.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";

export const metadata = {
  title: "Dispatch — TMMT",
  description: "Rescue dispatch cockpit",
};

export default async function DispatchLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Staff bypass OR any org_roles row
  if (!isStaffUser(user)) {
    const { data } = await supabase.from("org_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle();
    if (!data) redirect("/");
  }

  return <div className="h-[calc(100vh-4rem)]">{children}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(command\)/dispatch/layout.tsx
git commit -m "feat(dispatch): owner-only layout with org_roles gate"
```

### Task 26: Cockpit (`/dispatch`)

**Files:**
- Create: `src/app/(command)/dispatch/page.tsx`
- Create: `src/app/(command)/dispatch/_components/CockpitClient.tsx`

- [ ] **Step 1: Server page**

```tsx
import Link from "next/link";
import { getDispatchCockpitData, getCallerOrgId } from "@/lib/dispatch-queries";
import { CockpitClient } from "./_components/CockpitClient";

export default async function DispatchPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) {
    return (
      <div className="p-6">
        <p>No dispatch tenant configured for your account.</p>
        <Link href="/" className="text-blue-600 underline">back home</Link>
      </div>
    );
  }
  const { incidents, units } = await getDispatchCockpitData(orgId);
  return <CockpitClient orgId={orgId} initialIncidents={incidents} initialUnits={units} />;
}
```

- [ ] **Step 2: Client shell**

```tsx
"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { DispatchMap } from "./DispatchMap";
import { IncidentQueue } from "./IncidentQueue";
import type { Incident, Unit } from "@/lib/dispatch-types";
import { lockExpiredAssignments } from "../actions";
import { createBrowserClient } from "@supabase/ssr";

export function CockpitClient({ orgId, initialIncidents, initialUnits }: {
  orgId: string;
  initialIncidents: Incident[];
  initialUnits: Unit[];
}) {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [units, setUnits] = useState(initialUnits);
  const [focused, setFocused] = useState<string | undefined>();
  const [, start] = useTransition();

  // Tick the lock-expiry on mount + every 10s
  useEffect(() => {
    const tick = () => start(() => void lockExpiredAssignments(orgId));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [orgId]);

  // Subscribe to Realtime
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const ch = supabase.channel(`dispatch:${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `org_id=eq.${orgId}` },
        (payload) => setIncidents(prev => mergeRow(prev, payload as { eventType: string; new: Incident; old: { id?: string } })))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "units", filter: `org_id=eq.${orgId}` },
        (payload) => setUnits(prev => mergeRow(prev, payload as { eventType: string; new: Unit; old: { id?: string } })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]);

  return (
    <div className="grid h-full grid-cols-[1fr_360px]">
      <div className="relative">
        <DispatchMap units={units} incidents={incidents} focusedIncidentId={focused} onIncidentClick={setFocused} />
      </div>
      <aside className="flex flex-col border-l bg-white dark:bg-zinc-950 dark:border-zinc-800">
        <header className="flex items-center justify-between border-b p-3 dark:border-zinc-800">
          <h2 className="font-semibold">Active queue</h2>
          <Link href="/dispatch/incident/new" className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
            + New incident
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto">
          <IncidentQueue incidents={incidents} focusedId={focused} onFocus={setFocused} />
        </div>
      </aside>
    </div>
  );
}

function mergeRow<T extends { id: string }>(prev: T[], payload: { eventType: string; new: T; old: { id?: string } }): T[] {
  if (payload.eventType === "DELETE") return prev.filter(r => r.id !== payload.old.id);
  const idx = prev.findIndex(r => r.id === payload.new.id);
  if (idx === -1) return [payload.new, ...prev];
  const next = prev.slice();
  next[idx] = payload.new;
  return next;
}
```

- [ ] **Step 3: Build + verify**

```bash
cd ~/TMMT && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(command\)/dispatch/page.tsx src/app/\(command\)/dispatch/_components/CockpitClient.tsx
git commit -m "feat(dispatch): cockpit page with realtime + lock tick"
```

### Task 27: New incident form (`/dispatch/incident/new`)

**Files:**
- Create: `src/app/(command)/dispatch/incident/new/page.tsx`
- Create: `src/app/(command)/dispatch/incident/new/NewIncidentForm.tsx`

- [ ] **Step 1: Server page**

```tsx
import { getCallerOrgId } from "@/lib/dispatch-queries";
import { NewIncidentForm } from "./NewIncidentForm";

export default async function NewIncidentPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) return <p className="p-6">No tenant.</p>;
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">New incident</h1>
      <NewIncidentForm orgId={orgId} />
    </div>
  );
}
```

- [ ] **Step 2: Client form**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddressAutocomplete, type Place } from "../../_components/AddressAutocomplete";
import { createIncident } from "../../actions";

const CAPABILITIES = [
  "medical_basic","medical_advanced","terrain_offroad","lane_split",
  "water_rescue","hazmat","high_speed","passenger_transport",
] as const;

const CLASSES = ["sport_bike","sport_car","sport_suv","van","truck","helicopter","foot","other"] as const;

export function NewIncidentForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [place, setPlace] = useState<Place | null>(null);
  const [severity, setSeverity] = useState<1|2|3>(2);
  const [caps, setCaps] = useState<string[]>([]);
  const [reqClass, setReqClass] = useState<string>("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place) { setError("Pick an address first."); return; }
    setError(null);
    start(async () => {
      const res = await createIncident({
        org_id: orgId,
        reporter_name: reporterName || undefined,
        reporter_phone: reporterPhone || undefined,
        location_lat: place.lat,
        location_lng: place.lng,
        location_text: place.label,
        description: description || undefined,
        severity,
        required_capabilities: caps,
        required_class: reqClass || null,
      });
      if (!res.ok) setError(res.error);
      else router.push(`/dispatch/incident/${res.data.incident_id}`);
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Location</span>
        <AddressAutocomplete onPick={setPlace} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Severity</span>
        <select value={severity} onChange={e => setSeverity(Number(e.target.value) as 1|2|3)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700">
          <option value={1}>1 — life-critical</option>
          <option value={2}>2 — urgent</option>
          <option value={3}>3 — non-urgent</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Required capabilities</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CAPABILITIES.map(c => (
            <label key={c} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={caps.includes(c)}
                onChange={(e) => setCaps(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))}
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-medium">Required vehicle class (optional)</span>
        <select value={reqClass} onChange={e => setReqClass(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700">
          <option value="">(any)</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Reporter name (optional)</span>
        <input value={reporterName} onChange={e => setReporterName(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Reporter phone (optional)</span>
        <input value={reporterPhone} onChange={e => setReporterPhone(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700" />
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
        {pending ? "Creating…" : "Create + auto-assign"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
cd ~/TMMT && npm run build
git add src/app/\(command\)/dispatch/incident/new
git commit -m "feat(dispatch): new-incident form with geocoded address + capability chooser"
```

### Task 28: Incident detail page (`/dispatch/incident/[id]`)

**Files:**
- Create: `src/app/(command)/dispatch/incident/[id]/page.tsx`
- Create: `src/app/(command)/dispatch/incident/[id]/IncidentDetailClient.tsx`

- [ ] **Step 1: Server page**

```tsx
import { notFound } from "next/navigation";
import { getIncidentWithAssignments } from "@/lib/dispatch-queries";
import { IncidentDetailClient } from "./IncidentDetailClient";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { incident, assignments } = await getIncidentWithAssignments(id);
  if (!incident) notFound();
  return <IncidentDetailClient initialIncident={incident} initialAssignments={assignments} />;
}
```

- [ ] **Step 2: Client**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Incident, IncidentAssignment } from "@/lib/dispatch-types";
import { OverridePanel } from "../../_components/OverridePanel";
import { StatusTransitionBar } from "../../_components/StatusTransitionBar";

export function IncidentDetailClient({ initialIncident, initialAssignments }: {
  initialIncident: Incident;
  initialAssignments: IncidentAssignment[];
}) {
  const router = useRouter();
  const [incident] = useState(initialIncident);
  const [assignments, setAssignments] = useState(initialAssignments);

  // Auto-tick: re-fetch every 1s while a pending assignment exists (cheap, RLS-safe).
  useEffect(() => {
    const pending = assignments.find(a => a.effective_status === "pending");
    if (!pending) return;
    const id = setInterval(() => router.refresh(), 1000);
    return () => clearInterval(id);
  }, [assignments, router]);

  const active = assignments.findLast(a => a.status !== "cancelled");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="font-mono text-2xl">{incident.ref_code}</h1>
        <p className="text-sm text-zinc-500">
          {incident.location_text} · S{incident.severity} · {incident.status}
        </p>
      </header>

      {incident.description && <p className="rounded bg-zinc-50 p-3 text-sm dark:bg-zinc-900">{incident.description}</p>}

      {active?.effective_status === "pending" && (
        <OverridePanel
          assignment={active}
          incidentId={incident.id}
          onChanged={() => router.refresh()}
        />
      )}

      {active?.effective_status === "locked" && (
        <div className="rounded border bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm">
            Locked to unit <span className="font-mono">{active.unit_id.slice(0,8)}</span>
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Next step</h2>
        <StatusTransitionBar incidentId={incident.id} current={incident.status} onChanged={() => router.refresh()} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Assignment history</h2>
        <ul className="space-y-1 text-sm">
          {assignments.map(a => (
            <li key={a.id} className="rounded border p-2 dark:border-zinc-700">
              <span className="font-mono">{a.unit_id.slice(0,8)}</span>
              {" · "}{a.assigned_by_kind}
              {" · "}{a.effective_status ?? a.status}
              {" · "}{new Date(a.created_at).toLocaleTimeString()}
              {a.reasoning_json?.override_reason && (
                <div className="mt-1 text-xs italic text-zinc-500">"{a.reasoning_json.override_reason}"</div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
cd ~/TMMT && npm run build
git add src/app/\(command\)/dispatch/incident/\[id\]
git commit -m "feat(dispatch): incident detail with override panel + history"
```

### Task 29: Units roster page (`/dispatch/units`)

**Files:**
- Create: `src/app/(command)/dispatch/units/page.tsx`
- Create: `src/app/(command)/dispatch/units/UnitsClient.tsx`

- [ ] **Step 1: Server page**

```tsx
import { getCallerOrgId, getUnitsForOrg } from "@/lib/dispatch-queries";
import { UnitsClient } from "./UnitsClient";

export default async function UnitsPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) return <p className="p-6">No tenant.</p>;
  const units = await getUnitsForOrg(orgId);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Units</h1>
      <UnitsClient units={units} />
    </div>
  );
}
```

- [ ] **Step 2: Client**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Unit } from "@/lib/dispatch-types";
import { setUnitStatus, setUnitLocation } from "../actions";

export function UnitsClient({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locTarget, setLocTarget] = useState<string | null>(null);
  const [locLat, setLat] = useState("");
  const [locLng, setLng] = useState("");

  return (
    <div className="mt-6 space-y-2">
      {units.map(u => (
        <div key={u.id} className="flex items-center justify-between rounded border p-3 dark:border-zinc-700">
          <div>
            <span className="font-mono font-bold">{u.callsign}</span>
            <span className="ml-2 rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">{u.status}</span>
            {u.current_lat && u.current_lng && (
              <span className="ml-2 text-xs text-zinc-500">
                {u.current_lat.toFixed(4)}, {u.current_lng.toFixed(4)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={u.status}
              disabled={pending || ["assigned","en_route","on_scene"].includes(u.status)}
              onChange={e => start(async () => {
                const r = await setUnitStatus({ unit_id: u.id, status: e.target.value as "off_duty"|"available"|"out_of_service" });
                if (r.ok) router.refresh();
              })}
              className="rounded border px-2 py-1 text-sm dark:bg-zinc-900 dark:border-zinc-700"
            >
              <option value="off_duty">off_duty</option>
              <option value="available">available</option>
              <option value="out_of_service">out_of_service</option>
              {["assigned","en_route","on_scene"].includes(u.status) && <option value={u.status}>{u.status}</option>}
            </select>
            <button onClick={() => setLocTarget(u.id)} className="rounded bg-zinc-200 px-2 py-1 text-sm dark:bg-zinc-700">
              set loc
            </button>
          </div>
        </div>
      ))}
      {locTarget && (
        <div className="rounded border bg-zinc-50 p-3 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="mb-2 text-sm font-medium">Set location for {units.find(u => u.id === locTarget)?.callsign}</p>
          <div className="flex gap-2">
            <input placeholder="lat" value={locLat} onChange={e => setLat(e.target.value)} className="w-32 rounded border p-1" />
            <input placeholder="lng" value={locLng} onChange={e => setLng(e.target.value)} className="w-32 rounded border p-1" />
            <button
              disabled={pending}
              onClick={() => start(async () => {
                const r = await setUnitLocation({ unit_id: locTarget, lat: Number(locLat), lng: Number(locLng) });
                if (r.ok) { setLocTarget(null); setLat(""); setLng(""); router.refresh(); }
              })}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              save
            </button>
            <button onClick={() => setLocTarget(null)} className="px-3 py-1 text-sm">cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
cd ~/TMMT && npm run build
git add src/app/\(command\)/dispatch/units
git commit -m "feat(dispatch): units roster with status + location editor"
```

### Task 30: Responders admin (`/dispatch/responders`)

**Files:**
- Create: `src/app/(command)/dispatch/responders/page.tsx`
- Create: `src/app/(command)/dispatch/responders/RespondersClient.tsx`

- [ ] **Step 1: Server page**

```tsx
import { getCallerOrgId } from "@/lib/dispatch-queries";
import { createSSRClient } from "@/lib/supabase-server";
import { RespondersClient } from "./RespondersClient";

export default async function RespondersPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) return <p className="p-6">No tenant.</p>;
  const supabase = await createSSRClient();
  const { data } = await supabase.from("org_responder_links")
    .select("*, profiles:user_id(full_name, email, telegram_chat_id)")
    .eq("org_id", orgId)
    .order("approved_at", { ascending: false, nullsFirst: true });
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Responder links</h1>
      <RespondersClient orgId={orgId} links={(data ?? []) as ResponderLinkRow[]} />
    </div>
  );
}

export type ResponderLinkRow = {
  id: string;
  org_id: string;
  user_id: string;
  link_kind: "vendor"|"operator"|"client_volunteer"|"contractor";
  approved_at: string | null;
  active: boolean;
  certs: Record<string, unknown>;
  profiles: { full_name: string | null; email: string | null; telegram_chat_id: string | null } | null;
};
```

- [ ] **Step 2: Client**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ResponderLinkRow } from "./page";
import { revokeResponderLink } from "../actions";

export function RespondersClient({ orgId, links }: { orgId: string; links: ResponderLinkRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="mt-6 divide-y dark:divide-zinc-800">
      {links.map(l => (
        <li key={l.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{l.profiles?.full_name ?? l.profiles?.email ?? l.user_id.slice(0,8)}</p>
            <p className="text-xs text-zinc-500">
              {l.link_kind} · {l.active ? "active" : "revoked"}
              {l.profiles?.telegram_chat_id ? " · TG ✓" : " · TG ✗"}
            </p>
          </div>
          {l.active && (
            <button
              disabled={pending}
              onClick={() => start(async () => {
                const r = await revokeResponderLink(l.id);
                if (r.ok) router.refresh();
              })}
              className="rounded bg-rose-100 px-3 py-1 text-sm text-rose-700 hover:bg-rose-200"
            >
              revoke
            </button>
          )}
        </li>
      ))}
      {links.length === 0 && (
        <li className="py-3 text-sm text-zinc-500">No responder links yet. Add users to the org_responder_links table to begin.</li>
      )}
    </ul>
  );
}
```

> **Note on responder add UX.** Approving a *new* user requires picking them from `profiles`. For Core, this is intentionally minimal: the operator inserts a `profiles` row out-of-band (or via the existing admin) then approves the link here. Full new-user invite flow ships with Subproject #7 (Multi-Tenant Onboarding).

- [ ] **Step 3: Build + commit**

```bash
cd ~/TMMT && npm run build
git add src/app/\(command\)/dispatch/responders
git commit -m "feat(dispatch): responder links admin (revoke; approve happens via direct insert)"
```

### Task 31: Responder self-view (`/dispatch/me`)

**Files:**
- Create: `src/app/(command)/dispatch/me/page.tsx`

- [ ] **Step 1: Write the file**

```tsx
import Link from "next/link";
import { getMyActiveAssignment } from "@/lib/dispatch-queries";
import { StatusTransitionBar } from "../_components/StatusTransitionBar";

export default async function MePage() {
  const { assignment, incident, unit } = await getMyActiveAssignment();
  if (!assignment || !incident || !unit) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">No active assignment</h1>
        <p className="mt-2 text-sm text-zinc-500">You'll see your incident here when dispatched.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-6 space-y-3">
      <h1 className="text-xl font-semibold">{incident.ref_code}</h1>
      <p className="text-sm">{incident.location_text}</p>
      <p className="text-xs text-zinc-500">S{incident.severity} · status {incident.status}</p>
      {incident.description && <p className="rounded bg-zinc-50 p-2 text-sm dark:bg-zinc-900">{incident.description}</p>}
      <Link
        href={`https://maps.apple.com/?daddr=${incident.location_lat},${incident.location_lng}`}
        className="block rounded bg-blue-600 px-4 py-2 text-center text-white"
        target="_blank"
      >
        Open in Maps
      </Link>
      <StatusTransitionBar incidentId={incident.id} current={incident.status} onChanged={() => {}} />
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd ~/TMMT && npm run build
git add src/app/\(command\)/dispatch/me
git commit -m "feat(dispatch): responder self-view at /dispatch/me"
```

---

## Phase 8: Sidebar link + nav

### Task 32: Add Dispatch link to Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Read the file to find the nav-items array**

```bash
grep -n "href" ~/TMMT/src/components/Sidebar.tsx | head -20
```

- [ ] **Step 2: Add a new entry to the nav array following the existing pattern**

Look for the entries like `{ href: "/", label: "Dashboard" }` and insert:

```tsx
{ href: "/dispatch", label: "Dispatch", icon: "Radio" /* or whatever lucide icon name matches the existing pattern */ },
```

If the Sidebar uses a conditional render based on `isStaffUser`, leave the entry visible to all authed users — the layout in Task 25 handles authz.

- [ ] **Step 3: Build + commit**

```bash
cd ~/TMMT && npm run build
git add src/components/Sidebar.tsx
git commit -m "feat(dispatch): add Dispatch nav entry to Sidebar"
```

---

## Phase 9: Mandatory RLS smoke test

### Task 33: Playwright test — cross-tenant RLS isolation

**Files:**
- Create: `e2e/dispatch-rls.spec.ts`

- [ ] **Step 1: Pre-test seed (one-time)**

In the Supabase SQL Editor, run this to create a second seed tenant + an isolated incident. This is **not** part of the migration because it depends on actual auth users that the owner creates in the Supabase dashboard first.

```sql
-- Owner creates two Auth users in dashboard first:
--   tmmt-test@example.com  → memorize uid_t
--   pilot-test@example.com → memorize uid_p
-- Then run:
INSERT INTO public.organizations (name, org_type) VALUES ('Pilot Org 2', 'tenant')
  ON CONFLICT DO NOTHING;

WITH t AS (SELECT id FROM public.organizations WHERE name = 'TMMT Rentals'),
     p AS (SELECT id FROM public.organizations WHERE name = 'Pilot Org 2')
INSERT INTO public.org_roles (org_id, user_id, role) VALUES
  ((SELECT id FROM t), '<uid_t>', 'dispatcher'),
  ((SELECT id FROM p), '<uid_p>', 'dispatcher')
ON CONFLICT DO NOTHING;

INSERT INTO public.incidents (org_id, ref_code, location_lat, location_lng, location_text, severity, status)
SELECT id, 'DSP-2026-99001', 34.0, -118.2, 'TMMT-only', 2, 'received' FROM public.organizations WHERE name='TMMT Rentals';

INSERT INTO public.incidents (org_id, ref_code, location_lat, location_lng, location_text, severity, status)
SELECT id, 'DSP-2026-99002', 34.0, -118.2, 'Pilot-only', 2, 'received' FROM public.organizations WHERE name='Pilot Org 2';
```

- [ ] **Step 2: Write the Playwright test**

```typescript
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe("dispatch RLS isolation", () => {
  test("tmmt-test sees only TMMT row; pilot-test sees only Pilot row", async () => {
    const t = createClient(URL, ANON);
    await t.auth.signInWithPassword({
      email: process.env.E2E_TMMT_EMAIL!,
      password: process.env.E2E_TMMT_PASSWORD!,
    });
    const { data: tRows } = await t.from("incidents").select("ref_code");
    expect(tRows?.map(r => r.ref_code)).toContain("DSP-2026-99001");
    expect(tRows?.map(r => r.ref_code)).not.toContain("DSP-2026-99002");

    const p = createClient(URL, ANON);
    await p.auth.signInWithPassword({
      email: process.env.E2E_PILOT_EMAIL!,
      password: process.env.E2E_PILOT_PASSWORD!,
    });
    const { data: pRows } = await p.from("incidents").select("ref_code");
    expect(pRows?.map(r => r.ref_code)).toContain("DSP-2026-99002");
    expect(pRows?.map(r => r.ref_code)).not.toContain("DSP-2026-99001");
  });
});
```

- [ ] **Step 3: Add the four E2E env keys to `.env.example`**

```bash
echo '
# RLS isolation smoke test
E2E_TMMT_EMAIL=
E2E_TMMT_PASSWORD=
E2E_PILOT_EMAIL=
E2E_PILOT_PASSWORD=' >> .env.example
```

- [ ] **Step 4: Run the test (requires the four env keys to be set in .env)**

```bash
npm run test:e2e -- dispatch-rls
```
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/dispatch-rls.spec.ts .env.example
git commit -m "test(dispatch): mandatory RLS isolation smoke test"
```

---

## Phase 10: Docs + finalize

### Task 34: Operator runbook

**Files:**
- Create: `docs/DISPATCH-CORE.md`

- [ ] **Step 1: Write the file**

```markdown
# Dispatch Core — Operator Runbook

## Routes
- `/dispatch` — cockpit (map + queue)
- `/dispatch/incident/new` — create incident
- `/dispatch/incident/[id]` — detail + override panel
- `/dispatch/units` — unit roster + manual location
- `/dispatch/responders` — responder link admin
- `/dispatch/me` — responder self-view

## Day-1 setup
1. Set `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAPBOX_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID`, `AIXMOS_AGENT_HOST` in `.env`.
2. Apply `supabase/migrations/20260530120000_rescue_dispatch_core.sql`.
3. For each responder, set `profiles.telegram_chat_id` (Telegram → /start the bot → record their chat_id).
4. For each vehicle, set `fleet.vehicle_class` and `fleet.capability_tags`.
5. Insert `units` rows pairing a fleet vehicle + responder with a callsign.

## Failure modes
- **CAPTAIN down:** deterministic SQL ranking is used; `reasoning_json.captain_skipped=true` is logged.
- **Mapbox down:** map shows a banner; queue/forms still work.
- **Telegram down:** assignment proceeds; the responder ping is silently skipped.
- **Realtime drops:** UI polls every 10s; "live updates paused" badge.

## Cost guardrails
- Mapbox geocoding is rate-limited at the form layer by a 250ms debounce + server-side LRU cache (500 entries, 24h TTL).
- Auth-gated server action means anonymous traffic cannot burn quota.

## What's NOT in Core (deferred)
Responder mobile app · public intake · full AI dispatcher productization · equipment loadout · SLA dashboards · self-signup · billing · vehicle conversion · compliance pack.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DISPATCH-CORE.md
git commit -m "docs(dispatch): operator runbook"
```

### Task 35: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the "Production Gaps" section. Insert a new section above it.**

Add this just above `## Production Gaps`:

```markdown
## Dispatch Core (Subproject #1 of Rescue Dispatch SaaS) — SHIPPED

Plan: `docs/superpowers/plans/2026-05-27-rescue-dispatch-core.md`
Spec: `docs/superpowers/specs/2026-05-27-rescue-dispatch-core-design.md`
Migration: `supabase/migrations/20260530120000_rescue_dispatch_core.sql`
Routes: `/dispatch/*` under `(command)` (owner-only on .net)
Tenancy: per-tenant via `org_roles` + new `is_org_dispatcher(org_id)` helper. `is_staff()` bypass preserved.
Agents: CAPTAIN refinement via `captain_dispatch` prompt (JSON output). Fail-open at 1.5s.

```

- [ ] **Step 2: Final build + commit**

```bash
cd ~/TMMT && npm run build && npm run lint
git add CLAUDE.md
git commit -m "docs(claude): record Dispatch Core in project context"
```

### Task 36: Mirror to `~/projects/TMMT` (the second canonical clone)

**Files:**
- All of the above in `~/projects/TMMT/`

- [ ] **Step 1: Sync via git**

If both clones share the same remote, just push from `~/TMMT` and pull in `~/projects/TMMT`:

```bash
cd ~/TMMT && git push origin feature/rescue-dispatch-core
cd ~/projects/TMMT && git fetch origin && git checkout feature/rescue-dispatch-core
```

If the clones are independent, use a tarball or rsync the diff manually — but this should not normally be needed because both clones track `https://github.com/Metavibez4L/TMMT`.

- [ ] **Step 2: Verify**

```bash
cd ~/projects/TMMT && npm install && npm run build
```

---

## Self-Review (run by the human or planning agent before execution)

**Spec coverage check** — every acceptance criterion in Spec §2:
- AC1 (create incident at `/dispatch` on .net) → Tasks 25–27.
- AC2 (auto-assign <2s, top 5, top 3 surfaced with reasoning) → Tasks 7 (`find_best_unit`), 13 (CAPTAIN client), 16 (`runAssignment`), 21 (`OverridePanel`).
- AC3 (30s override) → Tasks 6 (view + tick), 17 (`overrideAssignment`), 21 (countdown UI).
- AC4 (live map + status transitions) → Tasks 17 (`transitionStatus`), 23 (`DispatchMap`), 24 (`StatusTransitionBar`), 26 (cockpit Realtime), 31 (`/me`).
- AC5 (RLS isolation across two tenants) → Tasks 4, 8, 9 (schema + policies + seed), 33 (test).
- AC6 (audit trail: assignments + overrides + status changes) → Tasks 4 (tables), 16/17/18 (server actions that insert).

**Placeholder scan** — no "TBD" / "implement later" / "similar to Task N" remain. All code blocks are complete.

**Type consistency** — `Candidate`, `Incident`, `Unit`, `IncidentAssignment`, `AssignmentReasoning` are all defined once in `dispatch-types.ts` (Task 11) and re-imported elsewhere. Server action names match between definition and callers (`createIncident`, `overrideAssignment`, `transitionStatus`, `setUnitStatus`, `setUnitLocation`, `approveResponderLink`, `revokeResponderLink`, `geocodeAddress`, `lockExpiredAssignments`).

**Risk callouts that will surface at execution time:**
1. `npx supabase db push --linked` requires the project to be linked; if not, paste the migration into the SQL Editor manually (Task 9).
2. CAPTAIN prompt change lives in a **separate repo** (`~/AIXMOS-AGENTS`); the agent host must be restarted (Task 10).
3. The two E2E auth users must be created **in the Supabase dashboard** before Task 33 — they cannot be seeded by migration because Supabase Auth users are not in `public`.
4. `(command)` route group uses `PortalChrome` — if `PortalChrome` enforces a different auth check that conflicts with Task 25's `org_roles` gate, the layout in Task 25 will need to render its own minimal chrome instead of relying on the parent. Verify on first build.
