# E2 — Screens/Routes, Roles, Navigation, Admin Surfaces, Design System (evidence)

- Worker: E2, TMMT master product extraction. Date: 2026-09-21.
- Canon: `AIXMOS537/TMMT` @ `origin/master` `4cca6835` (worktree `C:\dev\wt-master-extraction`), the Next.js app deployed as Vercel `tmmt-ops`.
- Method: read-only static analysis. Every `page.tsx` / `route.ts` under `src/app`, `apps/engine/src/app`, `aria/app` was enumerated by script; imports were followed two levels (excluding the shared `src/lib/queries.ts` barrel, which was resolved by the named imports instead) to collect `.from()` tables, `.rpc()` calls, storage buckets, `fetch('/api/…')` calls, auth helpers, service-role use, rate limiters, TODO/stub markers. Gates were read by hand from `src/middleware.ts`, `src/lib/auth-roles.ts` and every `layout.tsx`. No runtime/prod checks, no DB reads. `node_modules`/`.next` ignored.
- Full per-route table: `docs/product/_evidence/E2_route_registry.csv` (175 rows: 20 columns — route, methods, group, screen, domain, edge audience, in-code guard, purpose, tables, RPCs, storage/API calls, service-role writer, rate limit, states, nav path, status, known problems, file).
- Status words: EXISTING/WORKING, EXISTING/PARTIAL, EXISTING/BROKEN, PLACEHOLDER, ORPHANED, LEGACY, PLANNED ONLY, MISSING, UNKNOWN. **"WORKING" here means the code path is complete** (a real table/RPC read, a persistence path for its actions, no stub marker). Nothing was exercised against production, so no row claims runtime health.

---

## 1. Route registry — summary

### 1.1 Counts

| App | Pages | API routes | Notes |
|---|---:|---:|---|
| Canon `src/app` (tmmt-ops) | 127 | 30 (29 `/api/*` + `/explainer` route handler) | 12 route groups: `(admin)` 29, `(auth)` 4, `(command)` 16, `(executive)` 1, `(investor)` 1, `(learn)` 11, `(operator)` 4, `(partner)` 1, `(pocket)` 9, `(program)` 4, `(vendor)` 1, ungrouped 46 |
| `apps/engine` (`@aixmos/engine`, port 3001) | 13 | 0 | Standalone copy of the Learn/Work cube faces. No auth middleware (`apps/engine/middleware.ts` passes everything). LEGACY |
| `aria` (port 4200) | 1 | 4 | Avatar/voice chat against local Ollama `127.0.0.1:11434` (`aria/app/api/chat/route.ts:3`). Not part of the tmmt-ops deploy. ORPHANED |

No parallel (`@slot`) or intercepting (`(.)`) routes exist. Rewrites/redirects that act as routes: `next.config.ts:21-29` (bare `/onboarding`, `/dashboard`, `/coach`, `/consent`, `/status`, `/documents`, `/products`, `/questionnaire/*`, `/application/*` → `/learn/*`), `next.config.ts:47-50` (`/appointments`, `/contracts`, `/payments`, `/fleet` → `/interfaces/*`), `next.config.ts:63-69` (`/funding`, `/credit` → `/forms/credit-funding-intake?entry=…`), `vercel.json` (`/learn` → `/learn/onboarding`, `/work` → `/work/program`).

### 1.2 Canon routes by domain and status (pages + APIs)

| Domain | Pages | APIs | WORKING | PARTIAL | BROKEN | PLACEHOLDER | ORPHANED | LEGACY |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Marketing/Public | 21 | 1 | 16 | 5 | – | 1 | – | – |
| Credit Center | 19 | 2 | 4 | 15 | 1 | 1 | – | – |
| Intake/Forms | 20 | 1 | 17 | 1 | 3 | – | – | – |
| Admin/Integrations | 5 | 13 | 12 | – | 4 | – | – | 2 |
| AIXMOS/AI | 9 | 3 | 4 | 6 | 2 | – | – | – |
| Dealer/Partner | 10 | 0 | 7 | 2 | – | – | 1 | – |
| Rentals/Bookings | 6 | 1 | 5 | – | – | – | – | 2 |
| Communications | 4 | 3 | 4 | 3 | – | – | – | – |
| Maintenance | 6 | 0 | 6 | – | – | – | – | – |
| Auth | 5 | 1 | 5 | – | – | – | 1 | – |
| Dispatch (rescue) *(extra domain; fits none of the 16)* | 6 | 0 | 3 | – | – | – | 3 | – |
| Payments | 3 | 2 | 2 | 3 | – | – | – | – |
| Analytics | 4 | 1 | 4 | – | 1 | – | – | – |
| CRM/Leads | 4 | 1 | 5 | – | – | – | – | – |
| Fleet | 3 | 0 | 3 | – | – | – | – | – |
| Customer Portal | 1 | 1 | – | – | 2 | – | – | – |
| Agreements/Documents | 1 | 0 | 1 | – | – | – | – | – |
| **Total canon** | **127** | **30** | **98** | **35** | **13** | **2** | **5** | **4** |

By kind: pages 82 WORKING / 31 PARTIAL / 5 BROKEN / 2 PLACEHOLDER / 5 ORPHANED / 2 LEGACY; APIs 16 WORKING / 4 PARTIAL / 8 BROKEN / 2 LEGACY.

### 1.3 Screens by surface (condensed; full detail in the CSV)

**Rentals desk — `(admin)`, 29 screens, bare paths, `Sidebar.tsx`.** All are `"use client"` pages reading through the browser anon client (`src/lib/queries.ts` → `src/lib/supabase.ts`), so RLS is the only row gate; writes go through `adminUpsert` (`src/app/(admin)/admin-actions.ts:10-58`, 22-table allow-list, `isStaffUser` check, SSR user client — not service role). Reads fall back to an offline cache and throw `QueryError` into `(admin)/error.tsx`.

| Route | Screen | Data | Status |
|---|---|---|---|
| `/desk` | Rentals desk dashboard | `getDashboardData` (counts + latest `incoming_leads`, `tickets`) | WORKING, but reached only by post-login redirect (see §1.4) |
| `/revenue`, `/scorecard`, `/timesheets`, `/money` | Revenue, scorecard, timesheets, Money Meter | `customer_payments`, `time_clock_entries`, `money_meter_*` RPCs | WORKING (read-only); `/money` owner-only at the edge |
| `/interfaces/appointments·contracts·vehicles·payments` | "Interfaces" (Airtable-interface style) | `appointments`, `contracts` (+document storage), `fleet`+`maintenance_appointments`, `customer_payments` | WORKING; payments PARTIAL (manual ledger, no processor action) |
| `/bookings` | Rental board | `vehicles`, `fleet`, `bookings`, `rental_pricing_rules`, `rental_insurance_products`; actions `loadBoard/placeHold/addVehicleToBoard` | WORKING — the only screen writing `bookings` |
| `/leads`, `/waitlist`, `/background-checks`, `/credit-funding` | Pipeline | `incoming_leads` (+`request_handoff`), `waitlist`, `bg_check_queue`/`bg_check_decide`/`v_decision_trail`, `credit_funding_sessions` | WORKING; `/credit-funding` PARTIAL (read-only) |
| `/customers`, `/former-customers`, `/do-not-rent`, `/affiliates` | Customers | `active_customers`, `former_customers`, `do_not_rent_list`, `customer_payments` | `/customers`, `/former-customers` LEGACY (Airtable-era tables); `/affiliates` PARTIAL (computed, no payout action) |
| `/inspections`, `/maintenance`, `/insurance` | Fleet | `fleet_car_inspections`, `maintenance_appointments`, `insurance` | WORKING |
| `/cases`, `/workflow-vendors`, `/vendors`, `/tickets` | Workflow / Maintenance | `cases`, `vendor_jobs`, `vendors`, `clickup_tasks`, `shops_mechanics_cleaning`, `tickets` (service-role `workflow-actions.ts`) | WORKING |
| `/tasks`, `/va-queue`, `/expenses`, `/operation-costs` | Operations | `tasks`, `exec_va_tasks` (service-role, `requireStaff`), `expenses`, `operation_costs` | WORKING |

**Owner command center — `(command)` layout, `/command/*`, `/dispatch/*`, `/operators/*`.** `(command)/layout.tsx` has no auth; `/command/*` relies on middleware (owner only), `/dispatch` has its own layout gate, `/operators` checks in page.

| Route | Screen | Status | Note |
|---|---|---|---|
| `/command` | Command hub (link grid) | WORKING | Static nav, tenant-filtered (`commandHubSectionsFor`) |
| `/command/desk` | Command desk (voice → AI refine → exec VAs) | WORKING | `ops_threads`/`ops_messages` via `src/app/ops-actions.ts` |
| `/command/handoffs` | Entity handoffs (TMMT/AIXMOS/MOE) | WORKING | `v_federation_handoffs`, `capture_handoff_consent`, `accept_handoff` |
| `/command/outbox` | Message outbox | PARTIAL + ORPHANED | Stages `exec_va_tasks` into `automation_outbox`; no code anywhere in the repo reads `automation_outbox` (only `outbox/actions.ts`, `outbox/page.tsx`, `src/lib/ops/va-task-outbox.ts` touch it); not linked from any nav |
| `/command/credit-dispute`, `/import`, `/[id]` | Credit dispute command | PARTIAL / PARTIAL / BROKEN | `[id]` BROKEN per E5 (ungated `runDisputeProtocol`) |
| `/dispatch`, `/dispatch/incident/new`, `/dispatch/incident/[id]` | Rescue dispatch cockpit | WORKING | `incidents`, `units`, `incident_assignments`, `find_best_unit`, `assign_unit`; Leaflet map |
| `/dispatch/me`, `/dispatch/units`, `/dispatch/responders` | Responder/units/links | ORPHANED | No `href` to any of them in `src/` |
| `/operators`, `/operators/onboard` | Operator provisioning | WORKING / ORPHANED | `onboard` has no inbound link |

**Role portals — `PortalChrome` layouts.** `/executive` (ops_messages, WORKING), `/operator` + `/operator/leads` (lead pool RPCs `lead_claim/lead_assign/lead_cross_refer`, WORKING) + `/operator/training[/moduleId]` (PARTIAL: curriculum hard-coded in `src/lib/operator/academy-modules.ts`, progress in `operator_training_progress`), `/vendor` (vendor jobs, WORKING), `/investor` (`investor_updates`, WORKING), `/partner` (`get_partner_fleet` RPC, WORKING; own `PartnerPortalChrome`).

**AIXMOS cube — `(learn)` 11 pages, `(program)` 4 pages.** State comes from `@aixmos/core` `CubeProvider`: localStorage (`packages/aixmos-core/src/cube/sync.ts:36-45`) plus `/api/cube/application` → `program_applications` only when an application id resolves (`src/components/CubeApplicationProvider.tsx`, `src/app/cube-application-actions.ts`). Otherwise it seeds the demo persona "Jordan Rivera" (`packages/aixmos-core/src/mock-data.ts:19,55`). Hence PARTIAL across the face. `/learn/documents` is WORKING (`program_documents` + storage). `/learn/status` is PLACEHOLDER: submit calls `submitApplicationStub` and invents an `AIX-STUB-` reference (`(learn)/learn/status/page.tsx:5,20-35,93-94`). `/work/*` operates on one application in context, not a multi-application queue.

**Pocket — `(pocket)` 9 pages.** Any signed-in account (middleware `pathAllowedForTier` lines for `/pocket`). `/pocket`, `/pocket/earn`, `/pocket/agents`, `/pocket/build` read real tables (token balances, referral codes/earnings, `organization_licenses`, `client_engagements`). `/pocket/assistant` → `/api/pocket/chat` → `POCKET_BRAIN_URL` (PARTIAL: env-dependent). `/pocket/academy*`, `/pocket/compass`, `/pocket/climb` are static content (PARTIAL).

**Public intake / forms — `/forms/*` (19), `/intake/*` (3), `/status/[token]`.** Forms post to `processUnifiedIntake` (`src/lib/intake/unified.ts`, service-role, → `people`, `cases`, `form_submissions`, `customer_services`, `sync_events`) or `submit_customer_intake`. POST `/forms*` is rate-limited in middleware (in-memory `isRateLimited`), `/api/forms/submit` and `/api/leads/webhook` use `isRateLimitedDurable`.

**Marketing/public (22).** `/welcome` (signed-out `/` rewrite, reads `vehicles`), `/join`, `/upgrade`, `/dealers`, `/kits`, `/build[/reserved]`, `/configurator`, `/try` (PLACEHOLDER by design: scripted client-side demo, no backend), `/lp/aixmos`, `/lp/[org]/[sku]` (phone-only form → `/api/leads/webhook`), `/trust`, `/partners/all-in-one`, `/legal/*` (6), `/offline`, `/explainer`, and `/` for signed-in users.

**API routes (30).** Webhooks: GHL ×6 (`verifyGhlWebhook`, HMAC/shared secret + replay), Airtable ×2 (LEGACY, `x-sync-secret`), agent Twilio SMS (signature), Stripe per-tenant (`constructEvent`), Cal.com (HMAC), GHL Voice (`x-ghl-voice-secret`). Session APIs: `/api/cube/application`, `/api/pocket/chat` (durable RL), `/api/offline/merge`, `/api/rental/quote` (`isStaffUser`). Machine APIs: `/api/cron/*` ×2, `/api/license/*` ×3, `/api/audit/events`, `/api/mission/generate`, `/api/ops/command`. 23 of 30 reach the service-role client (directly or one import down); 3 call `isRateLimitedDurable` (`/api/forms/submit`, `/api/leads/webhook`, `/api/pocket/chat`).

### 1.4 Route-level defects found (code evidence)

| # | Finding | Evidence | Status |
|---|---|---|---|
| R1 | **Machine-to-machine APIs are behind the login wall.** `isPublicPath` whitelists only `/api/auth/`, `/api/webhooks/`, `/api/forms/`, `/api/agent/`, `/api/leads/`, `/api/health`. `/api/cron/*` (the two Vercel crons in `vercel.json`), `/api/license/*`, `/api/audit/events`, `/api/mission/generate`, `/api/ops/command` get 307 → `/login` for any caller without a session cookie, before their own secret checks run. The repo's own test pins it: `src/middleware.test.ts:237-243` (`/api/cron/anything`, `/api/ops/command` "redirects to /login"). | `src/middleware.ts:47-67,266-279` | EXISTING/BROKEN (8 APIs) |
| R2 | **Operator tier home loops.** `homePathForTier("operator")` = `/desk` (`auth-roles.ts:134-147`, pinned by `auth-roles.test.ts:41`); `/desk` is under `(admin)/layout.tsx`, which redirects any non-`isStaffUser` to `homePathForTier(tier)` = `/desk` again. Middleware also allows operators on desk paths, so nothing breaks the cycle. An operator signing in lands in a redirect loop unless they type `/operator`. | `src/app/(admin)/layout.tsx:37-38`, `src/lib/auth-roles.ts:97-106,134-147` | EXISTING/BROKEN (operator sign-in) |
| R3 | **Customer-facing pages are login-walled.** `/intake`, `/intake/[business]`, `/intake/thanks` and `/status/[token]` are not in `isPublicPath`/`isPitchPublicPath`. A signed-out renter following a staff-minted status link, or a visitor clicking "Submit a request" on `/trust` (`trust/page.tsx:112`), is redirected to `/login`; a `customer` account (tier `none`) is redirected to `/no-access`. | `src/middleware.ts:47-67,108-155,266-279,316-320` | EXISTING/BROKEN (4 pages) |
| R4 | **"Dashboard" no longer reaches the desk.** `Sidebar.tsx` and `command-hub-nav.ts` both link "Dashboard" to `/`. Since commit `2495c0a2` the desk moved to `/desk`, and signed-in `/` renders the public front door `src/app/page.tsx` outside the `(admin)` layout. `/desk` has no nav link. | `src/components/Sidebar.tsx:43`, `src/lib/command-hub-nav.ts:49`, `src/lib/auth-roles.ts:134-147` | `/desk` ORPHANED from nav |
| R5 | **Portal quick-nav leaks owner links and a literal placeholder.** `PortalChrome` (executive, investor, operator, vendor, command layouts) renders `CommandHubNav`, which uses the raw `commandHubSections`, not the tenant-aware `commandHubSectionsFor`. Every portal user sees owner-only links (they bounce off middleware), TMMT-own links on white-label tenants, and an `<a href="__MARKETING_SITE__">`. | `src/components/CommandHubNav.tsx:6,8`, `src/components/PortalChrome.tsx:45`, `src/lib/command-hub-nav.ts:42,137-142` | EXISTING/PARTIAL (nav) |
| R6 | Unlinked screens: `/command/outbox`, `/operators/onboard`, `/dispatch/me`, `/dispatch/units`, `/dispatch/responders`, `/whoami`. `/whoami` is also denied to tier `none`, which is the tier it was built to diagnose. | grep for inbound `href` across `src/` | ORPHANED |
| R7 | Stale gate comment: `(admin)/layout.tsx:9-16` says "31 admin screens" at `/payments`, `/contracts`; there are 29, and those two paths are now redirects to `/interfaces/*`. | `next.config.ts:47-50` | doc drift |
| R8 | Dead links found: only in `config/tailor.example.json` (`/client/dashboard`, `/team/dashboard`, `/admin/dashboard` — TMMT OS routes). Live `config/tailor.json` points to `/command`, `/operator`, `/learn`. No other internal `href`/`redirect`/`router.push` targets a missing route. | script over `src/` + `config/` | – |

---

## 2. Roles (derived from code)

### 2.1 Role vocabularies that exist

| Vocabulary | Values | Where defined / read | Used for authorization? |
|---|---|---|---|
| JWT `app_metadata.role` (`APP_ROLE_TOKENS`) | `admin`, `internal_team`, `va`, `executive_va`, `executive`, `operator`, `investor`, `partner`, `vendor`, `customer` | `src/lib/auth-roles.ts:14-25`; read by `getTierForUser` | **Yes — the app's only role source** (middleware, layouts, server actions) |
| Access tier (derived) | `owner` ← admin; `executive` ← executive_va/executive; `operator`; `staff` ← internal_team/va; `investor` ← investor/partner; `vendor`; `none` ← customer, missing, unknown | `auth-roles.ts:33-51,97-106` | Yes |
| DB `public.user_role` (= `profiles.role`) | `admin`, `internal_team`, `investor`, `vendor`, `customer` | `src/lib/db-vocab.ts:48-54`; read by DB `is_platform_admin()` | Yes, DB/RLS side only (app code does not read `profiles.role`) |
| `org_roles.role` (CHECK) | `tenant_admin`, `dispatcher`, `responder`, `viewer` | `supabase/migrations/20260530120000_rescue_dispatch_core.sql`; `db-vocab.ts:68` | Yes, dispatch only (`(command)/dispatch/layout.tsx:15-17`) |
| DB `public.portal_role` | `client`, `team_member`, `manager`, `admin`, `super_admin` | `db-vocab.ts:88-94` | **No app reader** — orphaned vocabulary |
| Notification `recipient_role` (CHECK) | `owner`, `staff`, `operator`, `system` | migrations | Addressing, not authZ |
| Cube personas | `client`, `coach`, `admin`, `supervisor` | `packages/aixmos-core` | **No** — client-side demo switch (`src/lib/cube-demo-controls.ts`; off in prod unless `NEXT_PUBLIC_CUBE_DEMO_CONTROLS=1`) |

DB helper functions referenced in migrations: `is_staff()` 99, `is_platform_admin()` 62, `is_org_member()` 43, `is_internal_ops()` 4, `is_admin()` 1 (grep counts over `supabase/migrations`). App-side, `isPlatformAdmin()` (`src/lib/queries.ts:239`) calls the `is_platform_admin` RPC to reveal admin-only fields (insurance, background checks).

Five JWT tokens have **no DB `user_role` value**: `va`, `executive_va`, `executive`, `operator`, `partner` exist only in the JWT. RLS that keys on `profiles.role` cannot see them.

### 2.2 Tier → routes allowed (effective = middleware ∩ layout/page guard)

| Tier (JWT roles) | Home | Can reach | Blocked from |
|---|---|---|---|
| **owner** (`admin`) | `/command` | Everything. Only tier on `/command/*`, `/operators/*`, `/money`. Only tier allowed on the owner-hub host (`isOwnerHubHost`). | – |
| **staff** (`internal_team`, `va`) | `/desk` | 28 `(admin)` screens (not `/money`), `/dispatch/*`, `/work/*`, `/learn/*`, `/intake/*`, `/status/[token]`, `/whoami`, `/`, `/clock`, `/pocket/*`, public | `/command`, `/executive`, `/operator`, `/operators`, `/vendor`, `/investor`, `/partner`, `/money` |
| **executive** (`executive_va`, `executive`) | `/executive` | `/executive`, `/learn/*`, `/dispatch/*` only with an `org_roles` row, `/intake`, `/status`, `/whoami`, `/`, `/clock`, `/pocket` | All `(admin)` and `(program)` screens (layout `isStaffUser` rejects them though middleware lets them through) |
| **operator** (`operator`) | `/desk` → **loops (R2)** | `/operator/*`, `/learn/*`, `/dispatch/*` with `org_roles` row, `/intake`, `/status`, `/`, `/clock`, `/pocket` | All `(admin)`/`(program)` screens; `/operators` |
| **investor** (`investor`, `partner`) | `/investor` | `/investor`, `/partner`, `/clock`, `/pocket`, public | everything else |
| **vendor** (`vendor`) | `/vendor` | `/vendor`, `/clock`, `/pocket`, public | everything else |
| **none** (`customer`, missing/unknown) | `/no-access` | `/no-access`, `/clock`, `/pocket/*`, public pages | `/learn/*` (client credit face), `/status/[token]` (their own status), `/intake`, `/whoami` |

Consequence: **there is no working customer role path in canon.** The only customer-shaped screens (`/learn/*`, `/status/[token]`) are denied to `customer` accounts and to signed-out visitors; the one customer surface a `customer` can open is `/pocket`.

---

## 3. Overlapping admin surfaces

| Surface (name in UI/code) | Routes | Shell / nav | Audience | Responsibilities |
|---|---|---|---|---|
| **Rentals desk** ("Dashboard", Sidebar) | 29 `(admin)` bare paths | `Sidebar.tsx` (8 groups) + `(admin)/layout.tsx` | owner + staff | Fleet, bookings, customers, pipeline, payments ledger, tickets, vendors, cases, VA approvals, team time |
| **Command Center / Command Hub** | `/command`, `/command/*`, `CommandHubNav` bar | `PortalChrome` + `CommandHubNav`; `/command` grid from `command-hub-nav.ts` | owner | Link hub re-listing desk screens (Fleet, Bookings, Maintenance, Leads, Customers, Cases, Vendors) + owner-only desks (credit dispute, handoffs, operators, command desk) + external GHL/ClickUp |
| **Owner Desk** | *No route or label named "Owner Desk" exists in canon code.* The nearest are `/command/desk` ("Command desk", badge "Owner") and TMMT OS `/admin/*` (owner group) | – | – | Term exists only outside canon |
| **"Desk" (name collision)** | `/desk` (staff KPI dashboard), `/command/desk` (owner → VA command relay) | different shells | staff vs owner | Two unrelated screens share the word |
| **Operations** | Sidebar group "Operations" (`/tasks`, `/va-queue`, `/tickets`, `/expenses`, `/vendors`, `/operation-costs`); `ops_threads/ops_messages` (`ops-actions.ts`) used by `/command/desk`, `/executive`, `/operator`; `/api/ops/command` | Sidebar / PortalChrome | staff / owner / exec / operator | Owner-command relay lives in `ops_messages`; VA tasks live in `exec_va_tasks` → `automation_outbox` — **two separate command/task queues** |
| **Dispatch** | `/dispatch/*` (rescue incidents, units, responders) | full-height cockpit, zinc palette, reached from Sidebar "Overview" | staff + org_roles members | Roadside/rescue dispatch vertical. "Dispatch" also names "dispatch to executive VAs" in the command desk description and TMMT OS `/internal/dispatch` — same word, different meaning |
| **AIXMOS** | `/work/*` (staff), `/learn/*` (client face), `/pocket/*` (member app), `/command/credit-dispute/*`, `/credit-funding`, `/lp/aixmos`, `/try`, `/upgrade`, `apps/engine` | CubeShell (`@aixmos/core`), pocket shell, PortalChrome | staff / owner / any signed-in | Credit readiness, coaching, dispute letters, member app, upsell |
| **CRM** | `/leads` (`incoming_leads`), `/operator/leads` (`lead_pool`), `/waitlist`, `/customers` (`active_customers`), `/command/handoffs`, GHL (external links in hub; webhooks mirror `ghl_contacts`/`people`) | Sidebar / operator portal / hub | staff / operator / owner | Lead capture, routing, claiming, referral, customer record |
| **Role portals** | `/executive`, `/operator`, `/vendor`, `/investor`, `/partner` | `PortalChrome` (owner hub nav bar shown to all, R5) / `PartnerPortalChrome` | each tier | Feeds and task views per role |
| **Operators console vs Operator portal** | `/operators` (owner provisions operator orgs) vs `/operator` (operator's own feed) | – | owner vs operator | One-letter name collision; middleware comment at `middleware.ts:132-138` records it already caused a wrong rule |

**Duplicated responsibilities (noted, not resolved):**

1. **Home/dashboard** — `/desk`, `/command`, signed-in `/`, `/pocket`, `/executive`, `/work/program` each present a "home"; nav "Dashboard" points at the marketing one (R4).
2. **Navigation definitions** — three: `Sidebar.tsx` navGroups, `command-hub-nav.ts` sections (rendered twice: grid on `/command`, bar in `CommandHubNav`), `config/tailor.json` portal cards on `/`. Hub re-lists 8 desk screens.
3. **Command/task relay** — `/command/desk` + `/executive` + `/operator` (`ops_messages`) vs `/va-queue` + `/command/outbox` (`exec_va_tasks` → `automation_outbox`, no drainer).
4. **Vendors** — `/vendors` (`shops_mechanics_cleaning`) vs `/workflow-vendors` (`vendors`); vendor jobs visible in `/cases` and `/vendor`.
5. **Scheduling** — `/interfaces/appointments` (`appointments`), `/bookings` (`bookings`), `/maintenance` (`maintenance_appointments`), plus GHL `ghl_appointments` and Cal.com webhook.
6. **Vehicles** — `fleet` (`/interfaces/vehicles`, `/inspections`) vs `vehicles` (`/bookings`, `/welcome`).
7. **Customer record** — `active_customers`/`former_customers` (desk), `people` (GHL mirror, intake), `client_journey` (`/status/[token]`), `program_applications` (cube).
8. **Credit** — `/credit-funding` (`credit_funding_sessions`), `/work/*` + `/learn/*` (`program_applications`), `/command/credit-dispute` (`dispute_clients`), `/forms/credit-funding-intake`, `apps/engine` (second copy of the Learn/Work faces).
9. **Leads** — `/leads` (`incoming_leads`) vs `/operator/leads` (`lead_pool`) vs GHL contacts.

**Legacy surfaces:** `apps/engine` (13 pages, standalone cube, LEGACY); `/api/webhooks/airtable*` (Airtable retirement); `/customers`, `/former-customers` (Airtable-era tables); `tmmt-command-center` repo (paused, outside canon); TMMT OS internal/owner/client surfaces (§5); `aria` (separate app, ORPHANED).

---

## 4. Design system

### 4.1 Foundations

| Item | What the code has | Evidence |
|---|---|---|
| Framework | Next 16.3.5, React 19.2, Tailwind **v4** (CSS-first, **no `tailwind.config.*`**), `@tailwindcss/postcss` | `package.json`, `postcss.config.mjs` |
| Tokens | `globals.css` (88 lines): `@theme inline` maps `--color-{border,muted,muted-foreground,background,foreground,card,card-foreground,primary,primary-foreground,secondary,secondary-foreground,ring}` to CSS vars; `:root` + `.dark` values (primary violet `#7c3aed` / `#a78bfa`); 12 per-tenant `--brand-*` vars with TMMT fallbacks | `src/app/globals.css:5-60` |
| Brand theming | `BrandProvider`/`BrandScope`/`BrandLogo`/`BrandName` set tenant brand per request (`getRequestBrand`) | `src/components/brand/*` — but `var(--brand-*)` appears in only 6 places in `.tsx` |
| Dark mode | Class-based: `@custom-variant dark (&:where(.dark, .dark *))`; inline script in root layout reads `localStorage.theme` or `prefers-color-scheme`; `ThemeToggle` | `globals.css:2`, `src/app/layout.tsx:17,27` |
| Typography | `system-ui` stack only, no web font; body colours hard-coded in `globals.css:62-71` | – |
| Icons / charts / maps | `lucide-react`; `recharts` (`components/charts.tsx`, `RevenueTrendChart.tsx`); `leaflet` + `react-leaflet` (dispatch map) | `package.json` |
| Validation | `zod` 4 in 21 non-test files (server side). **No** react-hook-form, **no** `useActionState`; forms are `useState` + server actions (`useTransition` in 11 files) | grep |
| Toasts / notifications | **None** (no toast library or component). Inline `ErrorBanner` and status text; `alert()/confirm()` in 3 files | `src/components/ui.tsx:498` |
| Dialogs / panels | `Modal` (`ui.tsx:340`, used in 23 files), `DetailPanel.tsx` (slide-over, 5 files) | – |
| PWA / offline | `manifest.ts`, `PWARegister`, `/offline`, `OfflineSyncBar`, offline cache in `queries.ts`, `/api/offline/merge` | – |

### 4.2 Component kits (two, plus a third inside the cube package)

1. **`src/components/ui.tsx` (519 lines, custom, hard-coded `gray`/`slate`/`blue` classes)** — `Badge`, `Card` (+`CardHeader/Title/Description/Content`), `StatCard`, `StatusBadge`, `StatusPill`, `PageHeader`, `DataTable` (`overflow-x-auto`, `emptyMessage`), `ExportButton`, `Modal`, `FormField`, `Label`, `Input`, `Select`, `Textarea`, `Button`, `FilterBar`, `ErrorBanner`, `inputClass`/`selectClass`. **96 files import it.**
2. **`src/components/ui/*.tsx` (shadcn-style, token-based, no cva, no Radix)** — `button`, `card`, `input`, `label`, `select`, `textarea`, "ported from TMMT OS for the public front door". **4 importers**: `src/app/page.tsx`, `intake/page.tsx`, `intake/thanks/page.tsx`, `components/intake-form.tsx`. No `components.json`; not a real shadcn install.
3. **`@aixmos/core` `CubeShell`** (`packages/aixmos-core/src/cube/CubeShell.tsx`) — the Learn/Work chrome, hard-coded `slate`, **0 `dark:` classes**.

`Button`, `Card*`, `Input`, `Label`, `Select`, `Textarea` exist in both kits with different APIs and different colour sources. `@/components/ui` resolves to `ui.tsx` while `@/components/ui/card` resolves to the folder — same import prefix, two kits.

### 4.3 Layout shells and navigation patterns

| Shell | Used by | Pattern |
|---|---|---|
| `Sidebar` + `(admin)/layout.tsx` | 29 desk screens | Fixed 256px left sidebar, collapsible groups (all but Overview start collapsed), mobile hamburger + overlay, `max-w-7xl` content |
| `PortalChrome` + `CommandHubNav` | `(command)`, `(executive)`, `(investor)`, `(operator)`, `(vendor)` | Sticky top header, horizontal scrolling pill bar, `max-w-5xl` |
| `PartnerPortalChrome` | `(partner)` | Own header |
| `LearnChrome` / `CubeProgramShell` → `CubeShell` | `(learn)`, `(program)` | Cube face switcher, demo role select when enabled |
| Pocket layout | `(pocket)` | Mobile-first `max-w-screen-sm`, no nav chrome, tile grid (`src/lib/pocket.ts`) |
| Dispatch layout | `/dispatch/*` | Full-height `calc(100vh-4rem)` cockpit with map; zinc palette |
| Legal layout | `/legal/*` | Pill nav + `prose` article |
| None (page-owned) | `/`, `/welcome`, `/lp/*`, `/kits`, `/build`, `/dealers`, forms | Each page builds its own header |

Responsive: Tailwind default breakpoints only (`sm/md/lg`); sidebar collapses below `lg`; `DataTable` scrolls horizontally; dispatch cockpit has 0 responsive classes in `CockpitClient.tsx` (desktop-only).

Loading/empty/error: `loading.tsx` in 9 groups (`admin`, `command`, `executive`, `investor`, `learn`, `operator`, `pocket`, `program`, `vendor`) — none for `(auth)`, `(partner)`, forms, marketing; `error.tsx` only in `(admin)` plus root `error.tsx` and `global-error.tsx`; empty state via `DataTable.emptyMessage` ("No records found"); `QueryError` from `queries.ts` surfaces to `(admin)/error.tsx`; `RouteSpinner.tsx`.

### 4.4 Inconsistencies (observed, no redesign proposed)

- **Accent colour splits by face:** operator desk/portals = `blue-600` (`text-blue` 168, `bg-blue` 126 uses); front door/intake = token `primary` violet `#7c3aed`; dispatch = `zinc`; pocket = `slate` + `blue`; brand vars (`--brand-*`, TMMT violet on near-black) barely used. Grey scales are mixed: `text-gray` 608 vs `text-slate` 434 uses.
- **Dark mode coverage is uneven:** desk/portals carry explicit `dark:` classes; token pages flip via CSS vars; the credit face (`CubeShell`, `/learn/*`) has **no dark mode** — the unmerged rescue branch T01 "one component kit, and give the credit face a dark mode" targets exactly this.
- **Two kits with the same component names** (§4.2); `StatusPill` also has its own test at `src/components/StatusPill.test.tsx`.
- **Customer vs operator vs admin vs credit faces** use four different shells (§4.3) with no shared header, logo placement or sign-out pattern (`Sidebar` form vs `PortalChrome` button vs none on Pocket/Learn).
- **No shared toast/feedback component**; each form invents its own success/error text.

---

## 5. BUILT ELSEWHERE, NOT IN CANON

Source: `Desktop\CONSOLIDATION-2026-09-21\UNIQUE_WORK_RESCUE_MANIFEST.md`. Route names below were read from directory listings only (`page.tsx` paths); no credential file was opened.

| Rescue id | Where | Screens not in canon | Notes |
|---|---|---|---|
| **T07** Fast Track overlay (PC Kit `_Archive\TMMT-LIVE`, 2026-08-24) | `C:\TechHaus-Archive\TMMT\rescue-2026-09-21\07-fast-track-overlay\files\src\app\` | `/apply`, `/apply/[slug]`, `/apply/packet` (+ `components/fast-track/*`, `lib/fast-track/*`) | Only copy of migration `20260825000000_fast_track_applications.sql`. Overlay also has old `(admin)/appointments·contracts·fleet·payments` pages that canon replaced with `/interfaces/*` redirects |
| **T04/T05/T06** TMMT OS (`import/tmmt-os`, `C:\dev\tmmt-os` @ `b38ad91`, TMMT-OS-ARCHIVE) — 90 pages, 20 API routes | `C:\dev\tmmt-os\src\app` (listing only) | **Customer portal** `(client)/client/*`: dashboard, billing, credit, documents, maintenance, path, rental, support, support/[id], training, updates, upgrade, vehicle, [section] (14). **Dealer desk** `(internal)/internal/dealer/*`: dealer, collections, deals, deals/[id], deals/new, inventory, leads, onboarding, payments, service (10). **Internal**: admin, agency, assistant, billing, cases, cases/[id], dashboard, dispatch, ghl-sync, interfaces, journey, journey/[email], ledger, operators, sync, sync/[id], vendors. **Owner** `(owner)/admin/*`: dashboard, licenses, support, users, [section]. **Team** `/team/dashboard`, `/team/[section]`. **Investor** `/investor/{dashboard,ledger,contact}`. **Vendor** `/vendor/{dashboard,jobs/[id],ledger}`. **Public**: `/apply`, `/apply/[slug]`, `/apply/packet`, `/apply/thanks`, `/marketplace`, `/onboarding`, `/portals`, `/track`, `/learn`. **Venture-scoped desk copies** `/v/[venture]/*` (21) | Canon has already ported `/`, `/intake/*` from here. Customer portal + dealer desk are the owner's "URGENT" port (work-baton rules) and are absent from canon |
| **T08** 4th TMMT OS history (Sync STALE snapshot) | `...\08-tmmt-os-4th-history-stale\` | `/internal/agency` changes; dealer-admin invite flow (LOTOS) | Migration `0033_dealer_instance_inventory.sql`. REQUIRES REVIEW (credentials file in bundle history — not opened) |
| **T10** `AIX-CREDIT-DISPUTE` standalone | `...\10-aix-credit-dispute-REQUIRES-REVIEW\files\src\app\` | `/`, `/applications`, `/dashboard`, `/data-points`, `/disputes/[id]`, `/funding`, `/import` | Migration `20260707140000_applications_funding.sql`. Credit/PII — REQUIRES REVIEW |
| **T09** FOR_OWNERS stashes | bundle | Rescue-dispatch cockpit and `/kits` — **already in canon**; partner plate/VIN UI variant not in canon | – |
| **T16** Codex pitch runtime | `...\16-codex-pitch-runtime\` | `/api/vehicles/lifecycle` | Experiment |
| **T01** `docs/system-of-record-2026-09-01` | bundle | No new screens; UI kit consolidation + credit-face dark mode | Relevant to §4.4 |
| **A06** `AIX_AI_COMMAND_SYSTEM` | `...\AIXMOS\...\06-aix-ai-command-system\` | an `integrations/tmmt-os` login page copy | – |

---

## 6. Open questions this evidence cannot settle (UNKNOWN)

- Whether any external scheduler reaches `/api/cron/*` or `/api/ops/command` by another path (e.g. with a session cookie). Code says the edge redirects them; no Vercel logs were read.
- Whether production accounts with `operator` role exist today (R2 only bites if they do).
- Runtime behaviour of `/pocket/assistant` and `/api/agent/*` without the per-tenant env/config (`POCKET_BRAIN_URL`, Twilio, Stripe secrets).
- Row counts behind the desk screens (E3 covers data).
