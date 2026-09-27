# 05 — Screen registry (summary)

Source: SPEC §6 (+ E2 §1, §5) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = everything in this file down to "Navigation defects" (routes on master; runtime status per SPEC X3). **TARGET** = the "BUILT ELSEWHERE, NOT IN CANON" table: those screens exist only in rescue archives and are port candidates (PM-16), not routes you can link to.

**Full per-route detail:** `docs/product/_evidence/E2_route_registry.csv`. It has 175 rows and 20 columns: app, kind, route, methods, route_group, screen_or_endpoint, domain, audience_edge_middleware, guard_in_code, purpose, data_tables, rpcs, storage_or_api_calls, writer_service_role, rate_limit, states, nav_path, status, known_problems, file. **Update the row when you change a route** (Definition of Done item 10).

The CSV keeps E2's **code-path** status. SPEC applies a **runtime** adjustment (X3): 7 screens that the CSV marks WORKING read tables that do not exist in prod.

## Counts

| App | Pages | API routes | Deployed |
|---|---:|---:|---|
| Canon `src/app` | 127 | 30 | yes |
| `apps/engine` | 13 | 0 | no (LEGACY) |
| `aria` | 1 | 4 | no (ORPHANED) |

Route groups in canon: `(admin)` 29, `(auth)` 4, `(command)` 16, `(executive)` 1, `(investor)` 1, `(learn)` 11, `(operator)` 4, `(partner)` 1, `(pocket)` 9, `(program)` 4, `(vendor)` 1, ungrouped 46 (sum = 127 pages).

**What each number means (SPEC §6.1; never add numbers from different rows):** 127 = pages; 30 = API routes; **157 = 127 + 30 = the denominator of the status table below** (98 + 35 + 13 + 2 + 5 + 4 = 157); 175 = CSV rows = 157 + 13 `apps/engine` + 5 `aria`; 29 / 28 = `(admin)` screens / reachable by staff (`/money` owner-only); 12 route buckets = 11 parenthesised groups + 1 ungrouped bucket (this is the "12 groups" in the tier × route matrix); 13 = CSV code-path BROKEN; 7 = runtime ghost-table BROKEN on top of that (runtime view 91 WORKING / 20 BROKEN); 6 = unlinked screens (R6) while the ORPHANED column shows 5 because `/command/outbox` is scored PARTIAL first; "127 screens" in the READINESS report means the 127 pages.

## Canon by domain and status (pages + APIs)

| Domain | Total | WORKING | PARTIAL | BROKEN | PLACEHOLDER | ORPHANED | LEGACY |
|---|---:|---:|---:|---:|---:|---:|---:|
| Marketing/Public | 22 | 16 | 5 | – | 1 | – | – |
| Credit Center | 21 | 4 | 15 | 1 | 1 | – | – |
| Intake/Forms | 21 | 17 | 1 | 3 | – | – | – |
| Admin/Integrations | 18 | 12 | – | 4 | – | – | 2 |
| AIXMOS/AI | 12 | 4 | 6 | 2 | – | – | – |
| Dealer/Partner | 10 | 7 | 2 | – | – | 1 | – |
| Rentals/Bookings | 7 | 5 | – | – | – | – | 2 |
| Communications | 7 | 4 | 3 | – | – | – | – |
| Maintenance | 6 | 6 | – | – | – | – | – |
| Auth | 6 | 5 | – | – | – | 1 | – |
| Dispatch (rescue) | 6 | 3 | – | – | – | 3 | – |
| Payments | 5 | 2 | 3 | – | – | – | – |
| Analytics | 5 | 4 | – | 1 | – | – | – |
| CRM/Leads | 5 | 5 | – | – | – | – | – |
| Fleet | 3 | 3 | – | – | – | – | – |
| Customer Portal | 2 | – | – | 2 | – | – | – |
| Agreements/Documents | 1 | 1 | – | – | – | – | – |
| **Total** | **157** | **98** | **35** | **13** | **2** | **5** | **4** |

## BROKEN (13 in the CSV)

- **8 machine APIs 307'd to `/login` by middleware (R1):** `/api/cron/journey-recompute`, `/api/cron/marketing-kpi-ghl`, `/api/license/{heartbeat,provision,revoke}`, `/api/audit/events`, `/api/mission/generate`, `/api/ops/command`.
- **4 customer pages login-walled (R3):** `/intake`, `/intake/[business]`, `/intake/thanks`, `/status/[token]`.
- `/command/credit-dispute/[id]`: ungated letter generator (credit track).

**Plus 7 more screens broken at runtime (ghost tables, X3):** `/command/desk`, `/executive`, `/operator` (feed), `/operator/leads`, `/investor`, `/pocket/earn`, `/pocket/build`.

## PLACEHOLDER (2)

- `/learn/status`: submit invents an `AIX-STUB-` reference (`(learn)/learn/status/page.tsx`) (KD-38).
- `/try`: a scripted client-side demo with no backend (placeholder by design).

## ORPHANED (unlinked, R6)

`/command/outbox`, `/operators/onboard`, `/dispatch/me`, `/dispatch/units`, `/dispatch/responders`, `/whoami`. `/whoami` is also denied to tier `none`, the tier it was built to diagnose.

## LEGACY

`/customers`, `/former-customers` (Airtable-era tables), `/api/webhooks/airtable`, `/api/webhooks/airtable/locations`, all 13 `apps/engine` pages.

## Navigation defects

- **R2:** operator home loops (`auth-roles.ts:134-147` → `/desk`; `(admin)/layout.tsx:37-38` redirects non-staff back to `homePathForTier`).
- **R4:** "Dashboard" → marketing `/` (`Sidebar.tsx:43`, `command-hub-nav.ts:49-52`). `/desk` has no nav link.
- **R5:** `CommandHubNav` renders the raw `commandHubSections`, not the tenant-aware `commandHubSectionsFor`. Portal users see owner links and a literal `__MARKETING_SITE__` (`command-hub-nav.ts:42`, `CommandHubNav.tsx`, `PortalChrome.tsx:45`).
- There are three nav definitions: `Sidebar.tsx`, `command-hub-nav.ts`, `config/tailor.json`.

## BUILT ELSEWHERE, NOT IN CANON (PRESERVED-RESCUED HISTORICAL WORK; port sources)

Classification per SPEC §33: UNIQUE AND RELEVANT · UNIQUE BUT DEFERRED · SUPERSEDED · DUPLICATE · HISTORICAL REFERENCE · NEEDS MANUAL REVIEW. Nothing rescued is automatically canonical; no bundle is automatically merged.

| Rescue | Screens | Classification |
|---|---|---|
| TMMT OS (`C:\dev\tmmt-os`, TMMT-OS-ARCHIVE) | **Customer portal** `(client)/client/*` (15: dashboard, rental, vehicle, billing, credit, documents, maintenance, marketplace, path, support, support/[id], training, updates, upgrade, [section]) | UNIQUE AND RELEVANT, owner URGENT → PM-16a/c (after PM-19) |
| same | **Dealer desk** `(internal)/internal/dealer/*` (10: home, collections, deals, deals/[id], deals/new, inventory, leads, onboarding, payments, service) | UNIQUE AND RELEVANT, owner URGENT → PM-16b/c (after TMMT-DATA-003) |
| same | internal/owner/team/investor/vendor/portals/`/v/[venture]/*` | SUPERSEDED / NEEDS MANUAL REVIEW (URL shape); many duplicate canon screens |
| archive/master only | `internal/{property,property/setup,briefing,marketplace,partner-verticals,dispatch/new}`, `client/marketplace`, `team/performance` | UNIQUE BUT DEFERRED (Phase 4+; commercial-authority gate) |
| T07 Fast Track (PC Kit overlay) | `/apply`, `/apply/[slug]`, `/apply/packet` | UNIQUE AND RELEVANT; **rewrite its migration first**; after GHL M8 (PM-16d) |
| T08 | dealer-admin invite flow | UNIQUE AND RELEVANT; fold into `src/lib/signup-invite.ts` (PM-16b, 2A-A4b coordination) |
| T10 AIX-CREDIT-DISPUTE | `/applications`, `/dashboard`, `/data-points`, `/disputes/[id]`, `/funding`, `/import` | NEEDS MANUAL REVIEW (credit track) |
| T16 | `/api/vehicles/lifecycle` | HISTORICAL REFERENCE |

Every port needs a Next 14→16 / React 18→19 / Tailwind 3→4 pass. Never push rescue bundles as they are: their history carries credentials-named files and CVILLE PDFs.
