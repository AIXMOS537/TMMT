# Rescue Dispatch — Subproject #1: Dispatch Core

**Date:** 2026-05-27
**Status:** Approved design, ready for implementation plan
**Owner:** Muhammad Taha
**Spec sits within:** AIXMOS Rescue Dispatch SaaS (10-subproject portfolio; this is #1)

---

## 1. Background & Goal

TMMT's owner is launching a multi-tenant SaaS for emergency/rescue dispatch. The product helps an operator (a private rescue company, corporate safety contractor, or other dispatch operator) put the closest available, capability-matched fast vehicle (sport bike, sports car, sport SUV, etc., reconditioned for rescue work) on the road within minutes of an incident, with the right equipment for the job. TMMT itself is Tenant #1; external operators license the platform after the pilot proves out.

The full product decomposes into 10 subprojects (Core, Responder Mobile, Public Intake, AI Dispatcher Brain, Equipment Loadout, SLA & Metrics, Multi-Tenant Onboarding & White-Label, Billing, Vehicle Conversion Playbook, Compliance Pack). This spec covers **Subproject #1: Dispatch Core** — the foundation everything else depends on.

## 2. Goal & Acceptance Criteria

Ship a working dispatcher console where:

1. TMMT (Tenant #1) can create an incident from the dispatcher console at `/dispatch` on the `.net` (owner-only) domain.
2. The system auto-assigns within 2 seconds. `find_best_unit` returns the top 5 ranked candidates; the override panel surfaces the top 3 with the remainder collapsible. Each candidate includes its reasoning (distance, capability match, CAPTAIN annotation if available).
3. The dispatcher can override the auto-pick within a 30-second window before the assignment is locked.
4. The assigned responder appears on a live Mapbox map and transitions through statuses (`assigned → en_route → on_scene → cleared`). Status updates are manual in Core (mobile app comes in Subproject #2).
5. A second test tenant ("Pilot Org") sees only its own incidents and units (RLS isolation proven via the one mandatory smoke test).
6. Every assignment, override, and status change is recorded in an audit trail.

## 3. Non-Goals

The following are explicitly deferred to later subprojects and **must not** be built in Core:

- Responder mobile app, push notifications, real GPS pings (Subproject #2)
- Public-facing customer intake form (Subproject #3)
- Detailed equipment loadout inventory beyond simple capability tags (Subproject #5)
- SLA dashboards, MTTR reports, time-to-X metrics displays (Subproject #6)
- Tenant self-signup, white-label theming, custom domains (Subproject #7)
- Billing, Stripe, usage metering (Subproject #8)
- Vehicle conversion methodology, parts lists, safety certification (Subproject #9 — parallel hardware track)
- Responder certification verification workflow (Subproject #10 — compliance)

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       .net (owner/dispatcher)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Next.js app (~/TMMT)                                      │  │
│  │  ├─ /dispatch              (cockpit: map + queue)          │  │
│  │  ├─ /dispatch/incident/new (create form)                   │  │
│  │  ├─ /dispatch/incident/[id] (detail + override panel)      │  │
│  │  ├─ /dispatch/units        (roster + capability editor)    │  │
│  │  ├─ /dispatch/responders   (org_responder_links admin)     │  │
│  │  └─ /dispatch/me           (responder-scoped view)         │  │
│  └────────────┬───────────────────────────┬───────────────────┘  │
│               │                           │                      │
│       Supabase JS client          Server actions                 │
│       (Realtime subscribe)        (assignment, override)         │
└───────────────┼───────────────────────────┼──────────────────────┘
                │                           │
                ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Supabase (uapxakmlwnpfsftfeezx)                                 │
│  ├─ Tables: incidents, units, unit_locations, assignments, …    │
│  ├─ RLS policies: org_id isolation                              │
│  ├─ pg fn: find_best_unit(incident_id) → ranked JSON            │
│  ├─ pg fn: assign_unit(incident_id, unit_id, by, weight)        │
│  └─ Realtime channels: incidents, unit_locations                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP (token, 1.5s timeout)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  AIXMOS Agents Host (127.0.0.1:7777, container aix-agent-host)   │
│  POST /agent/captain — OPTIONAL refinement, fail-open            │
└──────────────────────────────────────────────────────────────────┘
```

CAPTAIN is an optional refinement: if the agent host is unreachable or times out at 1.5s, the deterministic SQL ranking is used as the final answer and the assignment proceeds normally. Core never blocks on CAPTAIN.

## 5. Data Model

All new tables include `org_id uuid not null` and are protected by RLS policies that scope reads/writes to the caller's org membership (plus platform-staff override).

### New tables

```sql
-- Incidents: the request for help
incidents (
  id uuid primary key,
  org_id uuid not null,
  ref_code text unique,                          -- DSP-2026-#####
  reported_at timestamptz default now(),
  reporter_name text,
  reporter_phone text,
  location_lat double precision,
  location_lng double precision,
  location_text text,                            -- human-readable address
  description text,
  severity smallint check (severity in (1,2,3)), -- 1=life-critical, 2=urgent, 3=non-urgent
  required_capabilities text[],                  -- e.g. {'medical_basic','terrain_offroad'}
  required_class text,                           -- nullable; null = any vehicle_class fits
  status text check (status in (
    'received','assigning','assigned','en_route','on_scene','cleared','closed','cancelled'
  )),
  created_by uuid references profiles,
  closed_at timestamptz
)

-- Units: a dispatchable resource (vehicle + responder pairing, or either alone)
units (
  id uuid primary key,
  org_id uuid not null,
  fleet_id uuid references fleet,        -- nullable (responder on foot)
  responder_id uuid references profiles, -- nullable (vehicle unattended)
  callsign text,                          -- 'RESCUE-1', 'BIKE-3'
  status text check (status in (
    'off_duty','available','assigned','en_route','on_scene','out_of_service'
  )),
  current_lat double precision,
  current_lng double precision,
  last_ping_at timestamptz,
  active_assignment_id uuid               -- nullable; current incident
)

-- Time-series location history (append-only)
unit_locations (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  unit_id uuid not null references units,
  lat double precision,
  lng double precision,
  heading smallint,                       -- 0-359
  speed_mph smallint,
  recorded_at timestamptz default now()
)

-- Assignments (chained per incident; multiple rows if overridden)
incident_assignments (
  id uuid primary key,
  org_id uuid not null,
  incident_id uuid not null references incidents,
  unit_id uuid not null references units,
  assigned_by_kind text check (assigned_by_kind in ('system','user')),
  assigned_by uuid,                       -- null if system
  override_weight numeric default 0,      -- 0 for system, >=1 for user override
  reasoning_json jsonb,                   -- CAPTAIN's output (or null on fallback)
  status text check (status in ('pending','locked','cancelled','completed')),
  created_at timestamptz default now(),
  locked_at timestamptz                   -- set when 30s window closes
)

-- Override events (for later learning)
assignment_overrides (
  id uuid primary key,
  org_id uuid not null,
  incident_id uuid not null references incidents,
  original_unit_id uuid not null,
  chosen_unit_id uuid not null,
  reason text,                            -- dispatcher's free-text rationale
  context jsonb,                          -- snapshot of incident + candidates
  created_at timestamptz default now()
)

-- Who can respond for which org (role-based responder model)
org_responder_links (
  id uuid primary key,
  org_id uuid not null,
  user_id uuid not null references profiles,
  link_kind text check (link_kind in ('vendor','operator','client_volunteer','contractor')),
  approved_at timestamptz,
  approved_by uuid references profiles,
  certs jsonb,                            -- {cpr:'2026-08-01', emt_b:'2027-01-15', driver_class_a:true}
  active boolean default true,
  unique (org_id, user_id)
)

-- Per-tenant access roles
org_roles (
  org_id uuid not null,
  user_id uuid not null references profiles,
  role text check (role in ('tenant_admin','dispatcher','responder','viewer')),
  primary key (org_id, user_id)
)
```

### Schema extensions

```sql
ALTER TABLE fleet ADD COLUMN vehicle_class text
  check (vehicle_class in (
    'sport_bike','sport_car','sport_suv','van','truck','helicopter','foot','other'
  ));
ALTER TABLE fleet ADD COLUMN capability_tags text[];
-- Example tags: 'terrain_offroad','lane_split','water_rescue',
-- 'medical_basic','medical_advanced','hazmat','high_speed','passenger_transport'

ALTER TABLE profiles ADD COLUMN respond_capable boolean default false;
ALTER TABLE profiles ADD COLUMN responder_certs jsonb;
```

### Key functions

```sql
-- Deterministic ranking. <50ms. Always returns; never depends on CAPTAIN.
find_best_unit(p_incident_id uuid) returns table (
  unit_id uuid,
  distance_km numeric,
  capability_match_score smallint,   -- count of matched required_capabilities
  eta_seconds integer                -- rough straight-line estimate; precise from Mapbox later
);

-- Atomic assignment with reasoning.
assign_unit(
  p_incident_id uuid,
  p_unit_id uuid,
  p_by_kind text,
  p_by_user uuid,
  p_weight numeric,
  p_reasoning jsonb
) returns incident_assignments;
```

## 6. Assignment Engine

**On `incidents.insert`:**

1. Set `incident.status = 'assigning'`.
2. Call `find_best_unit(incident.id)` (pure SQL, deterministic).
   - Filter: same `org_id`, `units.status = 'available'`, `capability_tags ⊇ required_capabilities`, `vehicle_class = required_class OR required_class IS NULL`.
   - Sort: `capability_match_score DESC, distance_km ASC`.
   - Return top 5.
3. If candidates is empty → `incident.status = 'received'` (back to manual queue), notify dispatcher, stop. Return the top 5; the override panel will show the top 3 with the rest collapsible.
4. Fire-and-forget HTTP call to `POST http://127.0.0.1:7777/agent/captain` with 1.5s timeout:
   ```json
   {
     "incident": { "severity": 2, "location": [...], "required_capabilities": [...], "description": "..." },
     "candidates": [ { "unit_id": "...", "distance_km": 4.2, "capability_match_score": 3 }, ... ]
   }
   ```
   Expected response shape: `{ "ranked_unit_ids": [uuid, ...], "reasoning": "..." }`.
5. Pick = `CAPTAIN.ranked_unit_ids[0]` if CAPTAIN responded successfully, else `candidates[0]`. Log `captain_used: true|false` in reasoning_json.
6. Insert `incident_assignments` row with `status='pending'`, `reasoning_json` set.
7. Start a 30-second override window. **Locking is DB-driven, not in-memory**, so it survives server restarts: the row stays `status='pending'` with `created_at` recorded; any subsequent read of the assignment uses `CASE WHEN created_at < now() - interval '30 seconds' THEN 'locked' ELSE 'pending' END` (or a Supabase Edge Function / cron tick that flips `locked_at`). Effective behavior is identical to a timer, but recoverable.
8. Send tentative notification to assigned responder via `tmmt-agent-channel` (Telegram / iMessage), marked **"TENTATIVE — may change in 30s"**.
9. At 30s expiry (next read or cron tick): if assignment still `pending` → set `status='locked'`, `locked_at = now()`, send final ping. If `cancelled` → already handled by override path.

**Override path (dispatcher reassigns within 30s):**

1. Update current assignment `status='cancelled'`.
2. Insert new `incident_assignments` row with `assigned_by_kind='user'`, `override_weight=1.0`, full `reasoning_json` including dispatcher's free-text reason.
3. Insert `assignment_overrides` row with full context snapshot.
4. Reset 30s window for the new pick.
5. Send "ASSIGNMENT CHANGED" notification to the previously-assigned responder.

## 7. Dispatcher Console UI

All routes live under `~/TMMT/src/app/(command)/dispatch/` — the existing owner-only `command` route group on `.net`.

| Path | Page | Description |
|---|---|---|
| `/dispatch` | Cockpit (landing) | Split layout: live Mapbox map left, sortable incident queue right, "Create incident" CTA top-right |
| `/dispatch/incident/new` | New incident form | Mapbox Geocoding address autocomplete, severity, description, required_capabilities checkboxes, required_class dropdown |
| `/dispatch/incident/[id]` | Incident detail | Full info + 30s override panel (visible while `assignment.status='pending'`) + assignment history + status transition buttons |
| `/dispatch/units` | Unit roster | Table of all units, status badges, capability tags, edit modal, manual "Set location" form |
| `/dispatch/responders` | Responder admin | `org_responder_links` for this tenant; approve/revoke; view `certs` jsonb |
| `/dispatch/me` | Responder self-view (web) | Responder-scoped: their current assignment, scene map, status buttons. Visible to users with role='responder'. This is the web-only fallback for Core; Subproject #2 adds the native mobile app on top of the same data model (no schema migration required). |

### Components

- **`DispatchMap.tsx`** — Mapbox GL React component. Subscribes to Supabase Realtime on `unit_locations` and `incidents`. Pin style derived from `vehicle_class` (icon) + `status` (color). Props: `units`, `incidents`, `focusedIncidentId?`, `onIncidentClick`, `onUnitClick`.
- **`IncidentQueue.tsx`** — Reuses existing TMMT DataTable pattern. Columns: ref_code, severity badge, location_text, status, assigned unit callsign, time_open.
- **`OverridePanel.tsx`** — Live countdown timer (30s), top-3 ranked candidates with CAPTAIN reasoning + distance + capability match score, large "Reassign to X" buttons, free-text reason field.
- **`UnitCard.tsx`** — Small tooltip rendered on map pin hover; status badge.

State management: Supabase Realtime subscriptions + React state are sufficient at Core scale. No Zustand/Redux required.

## 8. Realtime, Auth, RLS

### Realtime channels

- `realtime:incidents:org_id=eq.{tenant_org}` — all insert/update events
- `realtime:unit_locations:org_id=eq.{tenant_org}` — every new ping
- `realtime:incident_assignments:org_id=eq.{tenant_org}` — assignment changes (drives the override panel countdown)

### Roles (per-tenant, via `org_roles`)

- **tenant_admin** — full read/write within their org
- **dispatcher** — full read/write on incidents, units, assignments within their org
- **responder** — read their own active assignment + self-update status; no org-wide visibility
- **viewer** — read-only across the org

Platform staff (your team) bypass org scoping via the existing `is_staff()` helper. A new `is_dispatcher(org_id)` helper is added.

### RLS template (applied to all 7 new tables — `incidents`, `units`, `unit_locations`, `incident_assignments`, `assignment_overrides`, `org_responder_links`, `org_roles` — adjusted per-table)

```sql
-- READ: tenant member sees their org's rows; staff sees everything
create policy "tenant_read" on incidents for select using (
  org_id in (select org_id from org_roles where user_id = auth.uid())
  or is_staff()
);

-- WRITE: only tenant_admin or dispatcher within the org; staff bypass
create policy "dispatcher_write" on incidents for all using (
  exists (
    select 1 from org_roles
    where org_id = incidents.org_id
      and user_id = auth.uid()
      and role in ('tenant_admin','dispatcher')
  )
  or is_staff()
);
```

Responder role gets a narrower select policy on `incidents` and `incident_assignments` that only matches rows where they are the assigned `unit.responder_id`. The `/dispatch/me` route relies on this.

## 9. Degraded Mode

| Failure | Behavior |
|---|---|
| Mapbox unreachable | Map shows error banner; queue, list, and forms still fully functional |
| CAPTAIN (`:7777`) down or timeout | Deterministic SQL ranking is used; `reasoning_json.captain_skipped = true` recorded |
| Supabase Realtime drops connection | supabase-js auto-reconnect; UI polls every 10s while disconnected and shows a "live updates paused" badge |
| Responder ping endpoint unreachable | Last known location is shown with a "stale (>2 min)" warning badge |

## 10. Testing Posture

Per owner decision, **full TDD is deferred** — Core ships first, comprehensive unit and E2E tests follow. **Exception:** one RLS isolation smoke test is mandatory before any second tenant is onboarded:

```
Two seeded tenants (tmmt-rentals, pilot-org-2), each with one incident.
Sign in as tmmt-rentals user, query incidents → assert pilot-org-2 row is NOT returned.
Sign in as platform staff, query incidents → assert both rows ARE returned.
```

This single test prevents the worst-case outcome (cross-tenant data leakage). Run it in CI gated on the multi-tenant deployment.

Other test layers (pgTAP for `find_best_unit`, server-action unit tests for `assign_unit`, full Playwright E2E for the dispatcher flow) are tracked in a follow-up subproject and not blocking for Core completion.

## 11. Open Questions for Plan Phase

These do not block design approval but must be resolved before implementation:

1. **Existing `org_roles` table?** Implementation plan must check whether TMMT already has an `org_roles` or equivalent table. If yes, extend it; if no, create it. The partner_portal migration introduced `is_staff()`/`is_partner()` — confirm consistency.
2. **Geocoding cost guardrails.** Mapbox Geocoding API has a free tier of 100k requests/mo. Address autocomplete on the New Incident form can burn this fast. Plan should add a server-side debounce/cache.
3. **Notification token reuse.** `tmmt-agent-channel` Telegram bot is configured for owner alerts. Plan must decide whether to reuse the existing bot with per-responder chat IDs, or run a separate bot for tenant-scoped responder pings.
4. **Reference code format collision.** `next_ref_code()` already generates `TMMT-YYYY-#####`. The plan should add a separate generator `next_dsp_ref_code()` returning `DSP-YYYY-#####` to keep incident IDs distinct from TMMT rental refs.
5. **CAPTAIN response contract.** The CAPTAIN agent's current prompt at `~/AIXMOS-AGENTS/agents/prompts.js` does not return structured JSON. Plan must include a prompt update + JSON-mode response so the server action can parse `ranked_unit_ids` deterministically.

## 12. Out of Scope (Reminder)

This spec is **Subproject #1 of 10**. The following subprojects are tracked separately and intentionally excluded from this build:

| # | Subproject | Depends on |
|---|---|---|
| 2 | Responder Mobile App (Expo, push, true GPS) | Core |
| 3 | Public Intake Portal | Core |
| 4 | AI Dispatcher Brain productized (beyond Core's optional CAPTAIN call) | Core |
| 5 | Equipment & Loadout System | Core |
| 6 | SLA & Metrics dashboards | Core, Mobile |
| 7 | Multi-Tenant Onboarding + White-Label | Core, Mobile |
| 8 | Billing / Usage Metering | Onboarding |
| 9 | Vehicle Conversion Playbook (hardware track, parallel) | Independent |
| 10 | Compliance & Insurance Pack | Independent |
