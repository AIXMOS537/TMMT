# TECHHAUS PROJECT DOSSIER

**Repository:** `/Users/ceo.moe/Projects/TMMT` (github.com/AIXMOS537/TMMT)
**Generated:** 2026-09-05 · read-only reconnaissance · **no application file was modified**
**Evidence basis:** direct repository inspection + executed non-mutating checks (typecheck, lint, unit tests, production build)

**Confidence legend:** `CONFIRMED` (direct repo evidence) · `INFERRED` (strongly suggested, unproven) · `UNKNOWN` (insufficient evidence) · `CONCERN` (deserves investigation) · `BROKEN` (reproducibly failing)

---

## 1. Executive Summary

`tmmt-app` is a **single Next.js 16 App Router application** deployed as one Vercel project (`tmmt-ops`) on top of a **Supabase (PostgreSQL + Auth + Storage)** backend. It is not a microservice fleet and not a conventional monorepo — it is one deployable app with three unrelated Next.js trees and a shared TypeScript package sitting beside it in the same git repository.

The product is an **owner-operated business operating system**, not a single-purpose SaaS. One deployment serves at least seven distinct audience surfaces behind one auth layer: a vehicle-rental admin desk, a command/dispatch console, a credit-and-funding program ("Learn"), an operator/affiliate network, a member app ("AIXMOS Pocket"), an investor/partner portal, and a public intake-forms surface. Routing between them is decided entirely in `src/middleware.ts` by an access **tier** derived from Supabase `app_metadata.role`.

**Engineering quality is materially higher than the surrounding repository hygiene suggests.** All four executed checks pass: typecheck clean, 483 unit tests green in 1.1s, production build succeeds, lint reports 0 errors / 40 warnings. The source tree contains **zero `as any`, zero `console.log`, zero empty catch blocks, and three `TODO`-family markers (all false positives — literal `XXXX` placeholders)**. Non-obvious decisions carry long explanatory comments that state what was wrong before and why the current shape was chosen. Several files document their own security weaknesses in prose.

The real risk is **not** in `src/`. It is in the repository *around* `src/`: 327 local branches, 5 git worktrees, a 257 MB `.git`, three vendored `node_modules` trees, background daemons from prior agent sessions actively running against this working copy, and 13 uncommitted paths including a schema migration mid-rename. That is the surface a multi-machine orchestration system would have to operate on, and it is the part that is not ready.

**Top three concerns:** (1) two `.env` files holding ~73 production secrets are mode `644`; (2) `/api/license/heartbeat` authenticates by string equality on a client-supplied `hardware_uuid` — the file says so itself; (3) the repository's git surface (327 branches / 5 worktrees / live daemons / uncommitted migration rename) cannot support multiple machines writing to it without a locking layer that does not currently exist.

---

## 2. Repository Identity

| Field | Value | Status |
|---|---|---|
| Package name | `tmmt-app` v0.1.0, `private: true` | CONFIRMED |
| Git provider | GitHub — `https://github.com/AIXMOS537/TMMT.git` | CONFIRMED |
| Current branch | `preview/rename-moe-legacy-to-aixmos-credit` | CONFIRMED |
| HEAD | `b748f7bcb1d45e5695e9c96d2359833d41d3617c` — *"naming: attestation_hash -> binding_hash; stop claiming attestation"* | CONFIRMED |
| Position vs `origin/master` | **6 ahead, 0 behind** — six local commits are unpushed | CONFIRMED |
| Production branch | `master` (`origin/HEAD -> origin/master`) | CONFIRMED |
| Local branches | **327** | CONFIRMED |
| Remote branches | 80 | CONFIRMED |
| Git worktrees | **5** (see below) | CONFIRMED |
| `.git` size | 257 MB | CONFIRMED |
| Stash entries | 0 | CONFIRMED |
| Structure | Single application; **not** an npm/pnpm workspace (`package.json` has no `workspaces` key) | CONFIRMED |
| Package manager | npm — `package-lock.json` present, `npm ci` used in CI | CONFIRMED |
| Declared Node | `engines.node: ">=24 <25"` | CONFIRMED |
| **Local Node** | **v26.5.0** — outside the declared range | CONCERN |
| CI Node | 24 (`.github/workflows/verify.yml`) | CONFIRMED |
| npm | 12.0.1 | CONFIRMED |
| Framework | Next.js `16.2.11` declared / **`16.2.10` installed and building** | CONFIRMED |
| Language | TypeScript 5, strict enough that `tsc --noEmit` is clean | CONFIRMED |
| Build tooling | `next build --webpack` (webpack explicitly, not Turbopack), Tailwind CSS v4 via `@tailwindcss/postcss` | CONFIRMED |

### Uncommitted changes (reported, NOT altered)

```
 M CLAUDE.md
 M SYSTEM_AUDIT_2026/39_FLAGSHIP_PLATFORM_ARCHITECTURE.md
 D supabase/migrations/20260827000000_org_ghl_connections.sql
M  vercel.json                       (staged — whitespace/formatting only)
?? SYSTEM_AUDIT_2026/40_AIXMOS_TRIAGE_CONTROL_PLANE.md
?? docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md
?? src/lib/agent/tenant.test.ts
?? supabase/migrations/20260827000001_org_ghl_connections.sql
?? supabase/migrations/20260903185639_audit_hardening_20260903.sql
?? supabase/migrations/20260903185722_audit_hardening_20260903_revoke_public.sql
?? supabase/migrations/20260903193844_exec_va_tasks_triage_schema.sql
?? supabase/migrations/20260903194001_classify_va_tasks_fn.sql
?? supabase/migrations/_staged/
```

`CONCERN` — the deleted `..._20260827000000_org_ghl_connections.sql` plus the untracked `..._20260827000001_org_ghl_connections.sql` is a **migration timestamp rename in flight**. Four further migrations (audit hardening ×2, exec_va_tasks triage schema, classify function) exist only as untracked files. If anything resets this working tree, that work is gone — untracked files are not protected by git.

`CONCERN` — `src/lib/agent/tenant.test.ts` is untracked but **is being executed** by the passing test run. The green suite partly depends on a file that is not in version control.

### Worktrees

```
/Users/ceo.moe/projects/TMMT                                    [preview/rename-moe-legacy-to-aixmos-credit]
/Users/ceo.moe/Archive/tmmt-worktrees/prod-migrations-20260903   [landing/prod-migrations-20260903]
/Users/ceo.moe/projects/TMMT-jobs-board                          (detached HEAD)
/Users/ceo.moe/projects/TMMT-swarm/.coord-init-1761              (detached HEAD)
/Users/ceo.moe/Projects/TMMT-swarm/6                             [swarm/carry/6]
```

`CONCERN` — two worktrees are on detached HEADs and one lives under `Archive/`. On a case-insensitive macOS filesystem, `projects/` and `Projects/` are the same directory, so these paths are less distinct than they read.

---

## 3. Technology Stack

| Technology | Version | Purpose | Evidence | Configured in | Used in |
|---|---|---|---|---|---|
| Next.js | 16.2.11 decl / 16.2.10 installed | App Router framework, SSR/RSC, API routes | `package.json`, build banner | `next.config.ts` | all of `src/app` |
| React | 19.2.4 | UI runtime | `package.json` | — | 116 client components |
| TypeScript | ^5 | Types; build gate | `tsconfig.json` | `tsconfig.json` | whole tree |
| Tailwind CSS | v4 | Styling | `package.json` | `postcss.config.mjs` | components/pages |
| Supabase JS | `@supabase/supabase-js` ^2.97.0 | DB/Auth/Storage client | `package.json` | `src/lib/supabase*.ts` | ~all data access |
| Supabase SSR | `@supabase/ssr` ^0.9.0 | Cookie-aware server/middleware clients | `package.json` | `src/lib/supabase-server.ts` | middleware, RSC, actions |
| PostgreSQL | (Supabase-hosted) | System of record | `supabase/migrations/*.sql` | 45 migrations | 60+ tables |
| Vercel | — | Hosting, cron, ignored-build-step | `vercel.json`, `.vercel/project.json` | `vercel.json` | project `tmmt-ops` |
| Anthropic SDK | `@anthropic-ai/sdk` ^0.104.1 | Sales-agent LLM calls | `package.json` | `src/lib/agent/llm-router.ts` | SMS/voice agent |
| OpenAI-compatible (self-hosted) | via `fetch` | AIXMOS Pocket member chat — deliberately **not** Anthropic | `src/lib/pocket-brain.ts` | `POCKET_BRAIN_URL` | `/api/pocket/chat` |
| Stripe | ^22.2.0 | Payments/webhooks | `package.json` | — | 12 files |
| Twilio | ^6.0.2 | SMS in/out for the agent | `package.json` | — | 9 files |
| GoHighLevel (GHL) | REST | CRM backbone: contacts, forms, appointments, checkout | `src/lib/ghl/**` | env `GHL_*` | 7 webhook routes + lib |
| Airtable | REST | Legacy/parallel data source, ops locations, people | `src/app/api/webhooks/airtable/**` | env `AIRTABLE_*` | 2 webhook routes |
| ClickUp | REST | Task/ops sync | `src/lib/clickup/**` | env `CLICKUP_*` | ops surfaces |
| Sentry | `@sentry/nextjs` ^10.47.0 | Errors + tracing | `sentry.{server,edge}.config.ts`, `src/instrumentation*.ts` | `withSentryConfig` in `next.config.ts` | 5 files |
| Mixpanel | `mixpanel-browser` ^2.73.0 | Product analytics | `package.json` | CSP allowlist | `AnalyticsProvider.tsx` |
| Zod | ^4.3.6 | Runtime validation, LLM output schema | `package.json` | — | 21 files |
| Recharts | ^3.8.1 | Charts | `package.json` | — | `charts.tsx`, revenue |
| Leaflet / react-leaflet | 1.9.4 / 5.0.0 | Maps for dispatch | `package.json` | — | 1 component |
| dnd-kit | core 6 / sortable 10 | Kanban drag-drop | `package.json` | — | `KanbanBoard.tsx` |
| lucide-react | ^0.576.0 | Icons | `package.json` | — | 74 files |
| Vitest | ^3.2.6 + jsdom + Testing Library | Unit/DOM tests | `vitest.config.ts` | `vitest.setup.ts` | 58 test files |
| Playwright | ^1.58.2 | E2E + a 106-route audit crawl | `playwright.config.ts`, `playwright.prod.config.ts` | — | `e2e/` |
| ESLint | ^9 + `eslint-config-next` | Lint | `eslint.config.mjs` | — | whole tree |
| gitleaks | external binary (optional) | Secret scanning in hooks | `.gitleaks.toml` | pre-commit/pre-push | — |

**Not present** (checked, absent): Prisma, Drizzle, Redis (`REDIS_URL` appears only in vendored `node_modules` scans, not in `src`), tRPC, Zustand/Redux, NextAuth, Clerk, a state-management library of any kind. State is React state + server data.

---

## 4. Annotated Architecture Tree

```
TMMT/
├── src/                                462 files · ~47,091 lines TS/TSX  ← THE APPLICATION
│   ├── middleware.ts                   282 ln · tenant resolution + auth gate + tier routing (the single
│   │                                   most important file in the repo; every request passes through it)
│   ├── instrumentation.ts              Sentry server init
│   ├── instrumentation-client.ts       Sentry client init
│   ├── app/                            213 files · App Router
│   │   ├── (admin)/                    27 pages — rentals desk: customers, fleet, leads, cases, money,
│   │   │                               revenue, tickets, timesheets, vendors, inspections, insurance…
│   │   ├── (auth)/login/               login + forgot + reset; `actions.ts` uses service-role client
│   │   ├── (command)/                  owner console: /command, /dispatch (incidents, units, responders),
│   │   │                               /operators (provisioning), credit-dispute workbench
│   │   ├── (executive)/                executive dashboard
│   │   ├── (investor)/ (partner)/      investor + partner portals (distinct; see middleware note)
│   │   ├── (learn)/learn/              credit & funding program: onboarding → questionnaire → consent →
│   │   │                               documents → application review → status
│   │   ├── (operator)/operator/        operator/affiliate surface: leads, training modules
│   │   ├── (pocket)/pocket/            AIXMOS Pocket member app: assistant, academy, climb, compass, earn
│   │   ├── (program)/work/             program/supervisor/review/admin workflow
│   │   ├── (vendor)/vendor/            vendor portal
│   │   ├── forms/                      18 public intake forms + `actions.ts` (741 ln, largest file)
│   │   ├── legal/                      credit / funding / privacy / rental / sms disclosures
│   │   ├── lp/[org]/[sku]/             dynamic per-org landing pages (ad funnel)
│   │   ├── build/ dealers/ join/ try/ upgrade/ kits/ clock/ explainer/ offline/ whoami/
│   │   └── api/                        28 route handlers (see §10)
│   ├── lib/                            208 files · ALL business logic
│   │   ├── supabase.ts                 browser client (lazy Proxy singleton)
│   │   ├── supabase-server.ts          SSR + middleware clients
│   │   ├── supabase-service.ts         service-role client, guarded by `import "server-only"`
│   │   ├── auth-roles.ts               role → AccessTier mapping (the authorization core)
│   │   ├── site-domains.ts             .com/.net host routing, CORS allowlist
│   │   ├── rate-limit.ts               in-memory limiter (see §17)
│   │   ├── agent/                      SMS/voice sales agent: llm-router, state-machine, personas,
│   │   │                               compliance (quiet hours, opt-out, banned phrases, area-code TZ),
│   │   │                               redact-pii, twilio-send, handoff, guard, audit
│   │   ├── platform/                   tenant-resolve + tenant-org (multi-tenancy primitives)
│   │   ├── ghl/                        GHL client, webhook-auth, dispatch, sync, org-location
│   │   ├── credit-dispute/             dispute engine + letter generators
│   │   ├── client-journey/ marketing-kpi/ routing/ intake/ crm-sync/ people/ workflow/ …
│   │   └── pocket-brain.ts             self-hosted LLM client (OpenAI-compatible)
│   └── components/                     38 files — small shared layer (ui.tsx is the design system)
│
├── supabase/
│   ├── migrations/                     45 tracked .sql (2026-03-31 → 2026-09-03) + _parked/ (4) + _staged/ (5, untracked)
│   ├── schema/                         schema snapshots
│   └── functions/intake/               one Edge Function
│
├── packages/aixmos-core/               `@aixmos/core` — shared types/logic, resolved via tsconfig paths,
│                                       NOT via npm workspaces; listed in `transpilePackages`
├── apps/engine/                        SECOND Next.js app (`@aixmos/engine`) — own node_modules, own .next,
│                                       own lockfile. Not built or deployed by the root app.
├── aria/                               THIRD Next.js app (`aria`) — own node_modules (9,657 files on disk,
│                                       13 tracked). Not built or deployed by the root app.
├── AIXMOS/                             portal HTML, docker compose, airtable CSVs, scripts (34 tracked)
├── shared/                             compliance-gates (tested), owner-approval-gate, schemas, config
├── scripts/                            260 files — the operations layer: verify.sh, ship.sh, swarm*.sh,
│                                       sync-machine.sh, mesh/, dual-sync/, fleet/, hooks/, 40+ .mjs tools
├── e2e/                                Playwright: smoke, dispatch-rls, net-only-refactor, audit crawl
├── docs/                               363 files (176 top-level .md) — extensive written doctrine
├── SYSTEM_AUDIT_2026/                  41 tracked audit reports (+1 untracked)
├── dist/ tools/ bin/ web/ infra/ imports/ specs/ content/ watch/ config-from-lexar/
│                                       misc operator kits, wiki HTML, one-off assets (23/26/7/3/… tracked)
├── workstream-{1,2,3}-*/               near-empty planning dirs (5/7/6 files)
├── .github/workflows/                  verify.yml · pii-guard.yml · session-autopilot.yml · mission-daily.yml
├── .swarm/                             machine identity, dispatch log, presence, heartbeat logs
└── 25 root-level .md/.command files    START-HERE, GO.md, DEPLOY.md, WIKI.md, EVERYTHING.command, …
```

`CONCERN` — three independent Next.js apps (`src/`, `apps/engine/`, `aria/`) coexist with **no workspace tool**. Each has its own `node_modules` and lockfile. Nothing links them; `@aixmos/core` is shared only through a `tsconfig.json` path alias. Any dependency-install or upgrade task must be told which of the three it means.

---

## 5. Product / User Journey

**Primary purpose (CONFIRMED from `README.md`, routes and DB tables):** replace an Airtable-based vehicle-rental operation (1,453 records / 44 tables, per README) with a purpose-built admin system — then, layered on top (CONFIRMED from routes and `docs/AIXMOS-TMMT-FUNNEL.md` reference in README), a membership + credit-guidance + operator-network business.

**Business funnel (CONFIRMED, README §"Ops + Command Center"):** rental → $97 membership → credit guidance. Private owner hub on `.net`; public AIXMOS marketing on `.com`; one Vercel deploy.

### Audiences and journeys

| Audience | Entry | Journey | Status |
|---|---|---|---|
| **Public visitor** | `/` | Redirected to the external GHL site (`allinonemanagementsolutions.com`) — the app's front door is staff-only | CONFIRMED (`middleware.ts`) |
| **Lead** | `/lp/[org]/[sku]`, `/join`, `/try`, `/forms/*` | Landing → form/phone capture → `incoming_leads` → `routeIncomingLead` → SMS agent | CONFIRMED |
| **Rental customer** | `/forms/customer-intake`, `/forms/background-check`, `/forms/waitlist`, `/forms/appointment`, `/forms/inspection`, `/forms/handover`, `/forms/ticket` | Public, no login; 18 form slugs total | CONFIRMED |
| **Staff / admin** | `/login` → tier `owner`/`staff` | 27 admin pages; kanban/calendar/chart "interfaces" generation for appointments, contracts, payments, vehicles | CONFIRMED |
| **Owner** | `.net` owner hub → `/command` | Command centre, dispatch, operator provisioning, credit-dispute workbench, money meter | CONFIRMED |
| **Credit/funding applicant** | `/learn/onboarding` | onboarding → questionnaire (personal + business) → consent → documents → application review → status | CONFIRMED |
| **Operator / affiliate** | `/operator` | leads pool, training modules with progress tracking | CONFIRMED |
| **Member (Pocket)** | `/pocket` | assistant (LLM chat), academy lessons, climb, compass, earn (referral codes + earnings) | CONFIRMED |
| **Investor / partner** | `/investor`, `/partner` | investor updates; `/partner` exposes fleet data via `get_partner_fleet` + `partner_fleet_access` | CONFIRMED |
| **Vendor** | `/vendor` | vendor jobs + file uploads | CONFIRMED |
| **Employee** | `/clock` | time clock, available to every signed-in tier | CONFIRMED |

**Billing:** `INFERRED` — checkout is delegated to **GHL hosted checkout links** (14 `NEXT_PUBLIC_GHL_CHECKOUT_*` env vars, price points 97 / 3750 / 7500 / 15000 / 25000 + monthly SKUs), while Stripe is present for webhook handling (`/api/agent/stripe/webhook/[slug]`) and `kit-checkout.ts`. There is no in-app Stripe Checkout session creation in `src/app`. `CONCERN` — two payment rails for one funnel.

**Compliance is a first-class product feature, not an afterthought (CONFIRMED):** `src/lib/compliance.ts`, `src/lib/agent/compliance/{quiet-hours,opt-out,banned-phrases,disclaimers,area-code-timezone}.ts`, `shared/compliance-gates/sms-gate.test.ts`, `/legal/*` disclosure pages, and a Pocket system prompt that explicitly forbids the words "repair", "fix", "delete", "guarantee", "100%". This is CROA/TCPA-shaped and should be treated as load-bearing by anyone editing agent output.

---

## 6. Routes

**110 `page.tsx` files, 16 layouts, 28 API route handlers.** Build output: 140 entries, mix of Static (`○`), SSG (`●`) and Dynamic (`ƒ`); the overwhelming majority are `ƒ` (server-rendered on demand) because auth-gated pages read cookies.

Auth is applied **centrally in `src/middleware.ts`**, not per-page. The tier gate is:

```
owner      → everything
executive  → /executive + rentals desk
operator   → /operator, /operator/* + rentals desk   (NOT /operators — deliberately fixed)
vendor     → /vendor only
investor   → /investor + /partner
staff|none → rentals desk only
every tier → /clock, /pocket, /api/pocket, /api/offline
```

`AccessTier` falls back to **`none`**, never `staff` — the file documents this as a fixed bug: "Granting on absence is the bug. Do not reintroduce a permissive default here."

### Representative route map

| Route | Purpose | Implementation | Rendering | Auth | Data | Calls |
|---|---|---|---|---|---|---|
| `/` | Front door | `src/app/page.tsx` | Dynamic | staff+; anon → external GHL site | — | — |
| `/login`, `/login/forgot`, `/login/reset` | Auth | `src/app/(auth)/login/**` | Dynamic | public | Supabase Auth | `actions.ts` (service-role, rate-limited) |
| `/command` | Owner console | `(command)/command` | Dynamic | owner | multiple | ops-command |
| `/dispatch`, `/dispatch/units`, `/dispatch/responders`, `/dispatch/incident/[id]`, `/dispatch/incident/new`, `/dispatch/me` | Incident dispatch | `(command)/dispatch/**` | Dynamic | owner | `incidents`, `units`, `unit_locations`, `incident_assignments_v` | `dispatch/actions.ts` (422 ln) |
| `/command/credit-dispute`, `/[id]`, `/import` | Dispute workbench | `(command)/command/credit-dispute/**` | Dynamic | owner | `dispute_clients` | credit-dispute engine |
| `/operators`, `/operators/onboard` | Operator provisioning | `(command)/operators/**` | Dynamic | owner only | `organizations`, `profiles` | service-role actions |
| `/leads`, `/customers`, `/cases`, `/money`, `/revenue`, `/tickets`, `/timesheets`, `/vendors`, `/waitlist`, `/inspections`, `/insurance`, `/maintenance`, `/expenses`, `/scorecard`, `/tasks`, `/affiliates`, `/background-checks`, `/do-not-rent`, `/former-customers`, `/operation-costs`, `/credit-funding`, `/workflow-vendors` | Rentals/admin desk | `(admin)/**` | Dynamic | staff+ (`/money` owner-only) | 30+ tables | `queries.ts` (646 ln) |
| `/interfaces/{appointments,contracts,payments,vehicles}` | Kanban/calendar/chart generation | `(admin)/interfaces/**` | Dynamic | staff+ | same tables | `KanbanBoard`, `CalendarView`, `DetailPanel` |
| `/learn/*` (11 pages) | Credit/funding program | `(learn)/learn/**` | Dynamic | signed-in | `program_applications`, `program_documents` | `/api/cube/application` |
| `/pocket/*` (6 pages) | Member app | `(pocket)/pocket/**` | Mixed (academy SSG) | any signed-in | `tmmt_token_balances`, `pocket_referral_*` | `/api/pocket/chat` |
| `/forms/[slug]` + 17 named forms | Public intake | `src/app/forms/**` | Mixed | **public** | writes via `forms/actions.ts` | `/api/forms/submit` |
| `/lp/[org]/[sku]` | Per-org ad landing | `src/app/lp/**` | Dynamic | public | org lookup | `/api/leads/webhook` |
| `/legal/{credit,funding,privacy,rental,sms}` | Disclosures | `src/app/legal/**` | Static | public | — | — |
| `/clock` | Time clock | `src/app/clock` | Dynamic | any signed-in | `time_clock_entries` | — |
| `/offline` | PWA offline shell | `src/app/offline` | Static | public | IndexedDB | `/api/offline/merge` |

**Rewrites** (legacy path preservation): `/onboarding`, `/dashboard`, `/coach`, `/consent`, `/status`, `/documents`, `/products`, `/questionnaire/*`, `/application/*` → their `/learn/*` equivalents; `/api/agent/_health` → `/api/agent/health` (the underscore folder is unroutable in App Router — external monitors already point at the old URL).

**Redirects:** `/appointments`, `/contracts`, `/payments`, `/fleet` → `/interfaces/*` (307); `/credit`, `/funding` → external GHL site (307).

---

## 7. Component Architecture

**38 component files.** This is a deliberately thin shared layer — most UI lives inside route folders.

- **Design system:** `src/components/ui.tsx` (519 ln) is the single shared primitives module. `charts.tsx` wraps Recharts.
- **Brand system:** `components/brand/{BrandProvider,BrandName,BrandLogo,BrandScope}.tsx` — multi-tenant white-labelling, driven by `scripts/brand-sync.mjs` (`npm run brand:check` runs in CI). Fully unit-tested.
- **Data-view generation:** `KanbanBoard`, `CalendarView`, `DetailPanel`, `ViewSwitcher`, `ExportButton` — the newer "interfaces" generation that replaced four older admin screens.
- **Providers/context:** `AnalyticsProvider` (Mixpanel), `BrandProvider`, `CubeApplicationProvider`, `PWARegister`, `OfflineSyncBar`.
- **Client/server split:** 116 files carry `"use client"`; 22 carry `"use server"`. `import "server-only"` guards the service-role factory. `src/lib/supabase.ts` contains a written explanation of why the service-role factory was *removed* from the browser-client module.

### Duplication and dead-looking code

| Observation | Files | Confidence |
|---|---|---|
| Two workflow banners with near-identical names | `components/learn/workflow-banner.tsx` and `components/program/WorkflowBanner.tsx` | CONCERN — probable duplicate; not verified line-by-line |
| Unused imports/constants | `credit-dispute/engine/deep-audit.ts` (`CreditProfile`, `SEVEN_YEARS_MS`, `TEN_YEARS_MS`), plus 2 unused icon imports | CONFIRMED (lint) |
| 34 × `setState` inside `useEffect` | across client components incl. `ThemeToggle`, `VoiceCapture` | CONFIRMED (lint) — React 19 `react-hooks/set-state-in-effect` |
| One stale `eslint-disable` directive | reported as "unused directive" | CONFIRMED |

No oversized components: the largest file in the tree is 741 lines (`app/forms/actions.ts`), the largest component 519 lines (`ui.tsx`).

---

## 8. Data Architecture

```
USER
 └─> Next.js page (RSC or "use client")
      ├─> Server Action ("use server", 22 files)  ──┐
      └─> fetch → /api/* route handler             ─┤
                                                    ├─> anon client (@supabase/ssr, RLS enforced as the user)
                                                    └─> SERVICE-ROLE client (RLS BYPASSED — checks must be in code)
                                                          └─> Supabase Postgres
                                                                ├─> RLS policies (137 CREATE POLICY across 7 RLS migrations)
                                                                ├─> RPC functions (get_partner_fleet, is_platform_admin, …)
                                                                └─> Storage (documents, licence uploads, vendor files)
                                                    └─> external: GHL · Airtable · ClickUp · Twilio · Stripe · Anthropic · self-hosted LLM
 <─── response ──── revalidate / redirect / JSON ────┘
```

### Three Supabase clients, cleanly separated (CONFIRMED)

| Module | Client | Guard | Notes |
|---|---|---|---|
| `src/lib/supabase.ts` | `createBrowserClient` | lazy `Proxy` — importing never reads env or instantiates | Prevents build-time env explosions |
| `src/lib/supabase-server.ts` | `createServerClient` ×2 (SSR + middleware) | `cookies()` read **before** env validation so prerender bails out dynamically | Deliberate, commented |
| `src/lib/supabase-service.ts` | `createClient` with `SUPABASE_SERVICE_ROLE_KEY` | `import "server-only"` | 15 lines; the only service-role factory |

A second service-role helper exists at `src/lib/agent/supabase-server.ts` (`createServiceSupabase`), used by the agent/license/audit routes. `CONCERN` — two service-role factories for the same job; only one carries the `server-only` guard.

**Service-role blast radius: 47 call sites across 30 files**, including four page components (`(pocket)/pocket/page.tsx`, `(pocket)/pocket/earn/page.tsx`) and login actions. Every one of these bypasses RLS, so authorization must be re-implemented in TypeScript at each site. `src/lib/auth-roles.ts` explicitly notes that "four server actions gate a service-role client on that check."

### Schema

- **45 tracked migrations**, 2026-03-31 → 2026-09-03, plus `_parked/` (4) and untracked `_staged/` (5).
- **137 `CREATE POLICY`** statements; 7 migrations toggle `ROW LEVEL SECURITY`.
- **60+ tables referenced from code.** Highest-traffic: `cases` (28 refs), `incoming_leads` (14), `crm_sync_records` (14), `units` (11), `sync_events` (8), `profiles` (8), `organizations` (8), `incidents` (8).
- Multi-tenancy is **host-based**: `middleware.ts` sets a tenant header (brand, from a static map) and an org header (data scope). It **deliberately refuses to default the org** for an unknown host and always strips an inbound org header — "never trust an inbound org header".
- Realtime: `INFERRED` — the leads webhook docstring says "downstream realtime subscriber triggers first outbound SMS"; no `.channel(`/`.subscribe(` was located in `src`, so the subscriber may live outside this repo. `UNKNOWN`.
- Offline: `/api/offline/merge` + `OfflineSyncBar` + `PWARegister` imply an IndexedDB → server merge path.
- Edge Functions: exactly one, `supabase/functions/intake`.

---

## 9. Authentication & Authorization

```
LOGIN                 /login  →  (auth)/login/actions.ts  →  Supabase Auth (email + password)
                                 rate-limited (isRateLimited) · service-role client used for admin lookups
SESSION CREATION      Supabase Auth issues JWT
SESSION STORAGE       HTTP cookies via @supabase/ssr (getAll/setAll)
SERVER VALIDATION     middleware.ts → createMiddlewareClient → supabase.auth.getUser()
                      wrapped in try/catch: on failure it FAILS CLOSED (treats request as signed-out)
ROUTE PROTECTION      isPublicPath / isPitchPublicPath / isFunnelPublicPath allowlists
                      then pathAllowedForTier(pathname, getTierForUser(user))
                      unauthorized → redirect to homePathForTier(tier), never a 500
DB AUTHORIZATION      RLS policies (anon client) — BYPASSED at all 47 service-role call sites
LOGOUT                Supabase sign-out (client)
OAuth                 /api/auth/callback exists; no OAuth provider buttons found in login UI  (INFERRED: email/password only today)
```

**Roles:** `app_metadata.role` ∈ `admin | internal_team | va | executive_va | executive | operator | investor | partner | vendor | customer` → mapped to `AccessTier` ∈ `owner | executive | operator | staff | investor | vendor | none`.

**Owner hub:** `NEXT_PUBLIC_OWNER_HUB_HOST` (the `.net` host). On that host a non-owner is bounced to `/login?hub=owner`; an owner at `/` goes to `/command`.

### Where authentication exists but authorization may be thin

| Finding | Detail | Confidence |
|---|---|---|
| Service-role in page components | `(pocket)/pocket/page.tsx` and `(pocket)/pocket/earn/page.tsx` construct a service-role client during render. Middleware only proves the user is *signed in* — `/pocket` is open to every tier. Row scoping is therefore entirely in page code. | CONCERN |
| Two admin truth sources | TypeScript reads `app_metadata.role`; the DB's `is_platform_admin()` reads `profiles.role`. `auth-roles.ts` records that these were verified to agree on 2026-08-31 for all three accounts — but nothing enforces that they stay in sync. | CONCERN |
| Middleware allowlists are string-prefix based | 40+ path predicates across three functions. Correct today (an `/operator` vs `/operators` prefix bug is documented as already fixed), but fragile: a new route under a public prefix is public by default. | CONCERN |
| `/api/pocket/chat`, `/api/offline/merge`, `/api/auth/callback` | the only three API routes that check a session | CONFIRMED |

No authentication bypass was attempted.

---

## 10. API Inventory

### Internal endpoints (28)

| Method | Path | Implementation | Auth | Input | Output | Deps | Callers |
|---|---|---|---|---|---|---|---|
| GET | `/api/health` | `api/health/route.ts` | none (public by design) | — | status | — | monitors |
| GET | `/api/agent/health` (+ `/_health` rewrite) | `api/agent/health/route.ts` | none | — | status | — | external monitors |
| POST | `/api/agent/sms/inbound` | 158 ln | **HMAC + `timingSafeEqual`** (Twilio) | Twilio form body | TwiML/JSON | `agent/*`, Anthropic | Twilio |
| POST | `/api/agent/voice/ghl` | 128 ln | `GHL_VOICE_WEBHOOK_SECRET` | voice payload | JSON | `agent/voice/*` | GHL |
| POST | `/api/agent/stripe/webhook/[slug]` | 52 ln | signature secret | Stripe event | JSON | Stripe | Stripe |
| POST | `/api/agent/cal/webhook/[slug]` | 57 ln | **HMAC + `timingSafeEqual`** | booking event | JSON | — | Cal |
| POST | `/api/audit/events` | 45 ln | `X-Audit-Key` + `timingSafeEqual` | NDJSON (≤1 MB / 10k lines) | `{accepted}` | service-role | fleet clients |
| GET | `/api/auth/callback` | 33 ln | **session** | code | redirect | Supabase Auth | browser |
| GET/POST | `/api/cron/journey-recompute` | 41 ln | `CRON_SECRET` \|\| `OPS_COMMAND_SECRET` (Bearer or `x-cron-secret`) | `?email` | JSON | `client-journey` | Vercel cron (daily 04:00) |
| GET/POST | `/api/cron/marketing-kpi-ghl` | 36 ln | same pattern | — | JSON | `marketing-kpi` | Vercel cron (Mon 13:00) |
| GET/PUT | `/api/cube/application` | 94 ln | **token OR session**, 404 on both unknown and unauthorized | `?id`, `?token`, AppState body | AppState | `program-applications-server` | `/learn/*` |
| POST/OPTIONS | `/api/forms/submit` | 103 ln | **none** — public; CORS allowlist + rate limit | form JSON | JSON | `forms/actions` | public forms, external sites |
| POST/OPTIONS | `/api/leads/webhook` | 181 ln | **none** — public; CORS allowlist + rate limit + org slug + license guard | `?org=slug`, phone/UTM body | JSON | `lead-pool`, `agent/tenant` | landing pages |
| POST | `/api/license/provision` | 77 ln | one-time install token (sha256 hash lookup) | token + org + hw uuid + pubkey | session token + URLs | service-role | fleet installer |
| POST | `/api/license/heartbeat` | 57 ln | **`hardware_uuid` string equality only** | org + hw uuid | ok / 410 + kill_command | service-role | installed clients |
| POST | `/api/license/revoke` | 60 ln | admin key + `timingSafeEqual` | org | JSON | service-role | owner |
| POST | `/api/mission/generate` | 76 ln | `CRON_SECRET` | audience/notify | JSON | Telegram | GitHub Action (daily) |
| POST | `/api/offline/merge` | 69 ln | **session** | offline queue | JSON | Supabase | PWA |
| POST | `/api/ops/command` | 100 ln | `OPS_COMMAND_SECRET` + `timingSafeEqual` (length-guarded) | command | JSON | service-role | owner tooling |
| POST | `/api/pocket/chat` | 161 ln | **session** + token metering + rate limit | message | reply | `pocket-brain`, `token-ledger` | Pocket app |
| POST | `/api/webhooks/ghl` | 270 ln | `verifyGhlWebhook` + idempotency (`consumeGhlEventId`) | GHL event | JSON | service-role, dispatch | GHL |
| POST | `/api/webhooks/ghl/{contact,form,appointment}` | 7 ln each | same, via `handleGhlWebhookPost` | GHL event | JSON | shared handler | GHL |
| POST | `/api/webhooks/ghl/program` | 107 ln | secret | GHL event | JSON | service-role | GHL |
| POST | `/api/webhooks/ghl/overdue` | 58 ln | `GHL_OVERDUE_WEBHOOK_SECRET` | GHL event | JSON | service-role | GHL |
| POST | `/api/webhooks/airtable` | 111 ln | secret | Airtable payload | JSON | service-role | Airtable automation |
| POST | `/api/webhooks/airtable/locations` | 57 ln | secret | Airtable payload | JSON | service-role | Airtable automation |

### External services consumed

| Service | Purpose | Files | Env names (values redacted) | Failure handling |
|---|---|---|---|---|
| Supabase | DB / Auth / Storage | ~all | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | middleware fails **closed**; clients throw on missing env at use-time |
| Anthropic | sales-agent LLM | `lib/agent/llm-router.ts` | `ANTHROPIC_API_KEY`, `ANTHROPIC_OPS_MODEL` | 8 s AbortController timeout → typed `LlmTimeoutError`; 1 retry on schema-parse failure |
| Self-hosted LLM | Pocket member chat | `lib/pocket-brain.ts` | `POCKET_BRAIN_URL/MODEL/KEY/TIMEOUT_MS/MAX_TOKENS` | typed result `{ok, error: not_configured\|unreachable\|empty\|bad_response}` |
| OpenAI | present but marginal | `lib/ops-ai.ts` | `OPENAI_API_KEY` | UNKNOWN |
| GoHighLevel | CRM, forms, checkout, voice | `lib/ghl/**`, 7 routes | `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET` (21 refs), `GHL_VOICE_WEBHOOK_SECRET`, `GHL_OVERDUE_WEBHOOK_SECRET`, `GHL_CF_*`, `GHL_*_MAP_JSON`, 14 × `NEXT_PUBLIC_GHL_CHECKOUT_*` | signature verify + idempotency + 409 on duplicate |
| Twilio | SMS | `lib/agent/twilio-send.ts` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | HMAC verify; rate-limited |
| Stripe | payments | `kit-checkout.ts`, webhook route | (Stripe keys not referenced in `src` — `UNKNOWN` where configured) | signature secret |
| Airtable | legacy data | 2 webhook routes | `AIRTABLE_PAT`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_LEADS_TABLE`, `AIRTABLE_OPS_LOCATIONS_TABLE` | secret-gated |
| ClickUp | tasks | `lib/clickup/**` | `CLICKUP_API_TOKEN`, `CLICKUP_TEAM_ID`, `CLICKUP_LIST_*` | UNKNOWN |
| Telegram | owner notifications | `lib/notify-telegram.ts` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID` | UNKNOWN |
| iMessage relay | notifications | `lib/notify.ts` | `IMESSAGE_RELAY_URL`, `IMESSAGE_RELAY_TOKEN`, `IMESSAGE_NOTIFY_TO` | UNKNOWN |
| Sentry | errors | instrumentation | `NEXT_PUBLIC_SENTRY_DSN` | `enabled: NODE_ENV === "production"`, `tracesSampleRate: 0.1` |
| Mixpanel | analytics | `AnalyticsProvider` | `NEXT_PUBLIC_MIXPANEL_TOKEN` | — |
| Slack | webhook alerts | `lib/*` | `SLACK_WEBHOOK_URL` | UNKNOWN |
| OpenStreetMap | geocoding | `lib/osm-geocode.ts`, `osm-cache.ts` | — | cached |

**No API key value appears in this dossier.**

---

## 11. Environment Variable Inventory

**Names only. No values were read out of any `.env` file, and none appear here.**

### Local `.env` files present (names + permissions only)

| File | Variable count | Mode | Tracked in git? |
|---|---|---|---|
| `.env` | 25 | `600` | no |
| `.env.local` | 58 | `600` | no |
| `.env.prod` | 51 | `600` | no |
| `.env.production.local` | 25 | `600` | no |
| **`.env.vercel-prod`** | **52** | **`644`** | no |
| `.env.vercel-pull` | 7 | `600` | no |
| **`.env.vercel-pulled`** | **21** | **`644`** | no |
| `.env.example` | 91 | — | **yes** (intended) |
| `.env.legacy.example` | — | — | **yes** (intended) |

`git ls-files` confirms **no real `.env` file is tracked**; `.gitignore` has `.env*` with `!.env.example` / `!.env.legacy.example` exceptions, and both a pre-commit and a pre-push hook block env/key files independently. **P1 CONCERN:** `.env.vercel-prod` (52 vars) and `.env.vercel-pulled` (21 vars) are mode `644` — world-readable to any local account or process.

### Classification (names referenced anywhere in `src/`)

- **PUBLIC / CLIENT** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_AIXMOS_SITE_URL`, `NEXT_PUBLIC_AIXMOS_LEARN_BASE_URL`, `NEXT_PUBLIC_OWNER_HUB_HOST`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_AFFILIATE_APPLY_URL`, `NEXT_PUBLIC_CLICKUP_WORKSPACE_URL`, `NEXT_PUBLIC_CUBE_{SAME_ORIGIN,WORK_URL,LEARN_URL,DEMO_CONTROLS,COMMAND_URL,FLEET_URL,PERSISTENCE}`, `NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_WORKFORCE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_GHL_*` (14 checkout SKUs + `CONSULT_CALL`, `CREDIT_GUIDANCE`, `OPERATOR_APPLY`, `UPSELL_PIPELINE_URL`, `FORM_EMBED`)
- **DATABASE** — `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COMMAND_CENTER_SUPABASE_URL`, `COMMAND_CENTER_SUPABASE_SERVICE_KEY`, (`SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `DATABASE_URL` — scripts only)
- **AUTH / SECRETS** — `ADMIN_KEY`, `AUDIT_INGEST_KEY`, `CRON_SECRET`, `OPS_COMMAND_SECRET`, `SYNC_WEBHOOK_SECRET`, `GHL_WEBHOOK_SECRET`, `GHL_VOICE_WEBHOOK_SECRET`, `GHL_OVERDUE_WEBHOOK_SECRET`, `AIXMOS_AGENT_TOKEN`, `VAPID_PRIVATE_KEY`
- **AI** — `ANTHROPIC_API_KEY`, `ANTHROPIC_OPS_MODEL`, `OPENAI_API_KEY`, `POCKET_BRAIN_{URL,KEY,MODEL,TIMEOUT_MS,MAX_TOKENS}`, `POCKET_{COST_PER_JOB,CLOUD_EQUIV_USD,REFERRAL_RATE}`, `MEMBER_97_MONTHLY_TOKENS`, (`NVIDIA_*`, `OLLAMA_*` — documented, unused in `src`)
- **VERCEL** — `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_GIT_COMMIT_{REF,SHA}`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_PRODUCTION_URL`
- **PAYMENTS** — `NEXT_PUBLIC_GHL_CHECKOUT_*` (14). Stripe secret names are **not referenced in `src`** — `UNKNOWN` where the Stripe SDK gets its key.
- **ANALYTICS / OBSERVABILITY** — `NEXT_PUBLIC_MIXPANEL_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `SLACK_WEBHOOK_URL`
- **INTEGRATIONS** — `GHL_*` (25 names), `AIRTABLE_*` (5), `CLICKUP_*` (7), `TWILIO_*` (2), `TELEGRAM_*` (2), `IMESSAGE_*` (3), `PARTNER_APP_URL`, `AIXMOS_AGENT_HOST`, `TMMT_OPS_DEFAULT_ASSIGNEE`, `MISSION_GREETING_NAME`, `MONEY_METER_FREE_FOREVER_EMAILS`, `B3_KILL_SWITCH`
- **TEST** — `E2E_TMMT_{EMAIL,PASSWORD}`, `E2E_PILOT_{EMAIL,PASSWORD}`, `PARTNER_TEST_{EMAIL,PASSWORD}`, `MICHAEL_VENDOR_{EMAIL,PASSWORD}`, `AUDIT_{BASE_URL,EMAIL,PASSWORD,INGEST_KEY}`, `SMOKE_BASE_URL`, `PW_REUSE_WEB_SERVER`

### Documentation drift (CONFIRMED)

**Used in `src` but missing from `.env.example` (36):**
`AIRTABLE_LEADS_TABLE`, `AIRTABLE_OPS_LOCATIONS_TABLE`, `ANTHROPIC_OPS_MODEL`, `CLICKUP_DEFAULT_LIST_ID`, **`CRON_SECRET`**, `GHL_CF_{CASE_REF,LOGIN_URL,PORTAL_URL,TRACK_URL}_KEY`, `GHL_CONVERSATION_PROVIDER_ID`, `GHL_DEFAULT_ASSIGNEE_EMAIL`, `GHL_EMAIL_FROM`, `GHL_KPI_{STRATEGY_APPOINTMENT,SUBSCRIBER_TAG}_PATTERNS`, **`GHL_LOCATION_ID`**, `GHL_RESTORATION_LOCATION_ID`, `MEMBER_97_MONTHLY_TOKENS`, `MISSION_GREETING_NAME`, `NEXT_PUBLIC_AFFILIATE_APPLY_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CUBE_DEMO_CONTROLS`, `NEXT_PUBLIC_GHL_CHECKOUT_{COMMAND,DEALER,OPS}_MONTHLY`, **`NEXT_PUBLIC_SENTRY_DSN`**, `NEXT_PUBLIC_SITE_URL`, `PARTNER_APP_URL`, `POCKET_BRAIN_{URL,MODEL,TIMEOUT_MS,MAX_TOKENS}`, `POCKET_{COST_PER_JOB,REFERRAL_RATE}`, `SUPABASE_URL`, `TMMT_OPS_DEFAULT_ASSIGNEE`

`CRON_SECRET` and `GHL_LOCATION_ID` being undocumented is the sharpest edge here: a fresh deployment that omits `CRON_SECRET` makes **both Vercel cron routes return 401 forever** and nothing surfaces the failure.

**Documented in `.env.example` but unused in `src` (18):** `AIRTABLE_BASE_NAME`, `AIRTABLE_PEOPLE_TABLE`, `CREDIT_ENGINE_{AUTO_POLISH,INFERENCE,SECRET}`, `E2E_*` (4), `NEXT_PUBLIC_CUBE_PERSISTENCE`, `NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_GHL_FORM_EMBED`, `NEXT_PUBLIC_WORKFORCE_URL`, `NVIDIA_{API_KEY,NIM_BASE_URL,NIM_MODEL}`, `OLLAMA_{URL,CREDIT_MODEL}` — some are used by `scripts/`; `NVIDIA_*` and `CREDIT_ENGINE_*` appear to be residue from a retired path.

---

## 12. Vercel Architecture

**Project:** `tmmt-ops` (from `.vercel/project.json`; `projectId`/`orgId` present and deliberately not reproduced here). A `.vercel/project.json.bak-audit-20260903` backup sits beside it.

| Setting | Value |
|---|---|
| Deploy branches | `master: true`, `swarm-coord: false` — swarm coordination branch is explicitly barred from deploying |
| Ignored build step | `bash scripts/vercel-ignore.sh` — skips deploys unless `src public packages package.json package-lock.json next.config.* tsconfig.json postcss.config.mjs sentry.*.config.ts instrumentation.ts vercel.json` changed. Docs/scripts/tools ship freely without burning build quota. Falls back to **build** when no base ref exists (fail-safe direction). |
| Crons | `/api/cron/marketing-kpi-ghl` Mondays 13:00 UTC · `/api/cron/journey-recompute` daily 04:00 UTC |
| Headers | `Cache-Control: no-store` on `/api/webhooks/*` (vercel.json); full security header set incl. **CSP** in `next.config.ts` |
| Rewrites/redirects | in both `vercel.json` (2) and `next.config.ts` (11 rewrites + 6 redirects) |
| `.vercelignore` | excludes `.aixmos/face/` (2 GB+ local ML assets) |
| Server Actions | `bodySizeLimit: "20mb"` |
| Regions / runtimes | not specified — Vercel defaults |

**CSP (from `next.config.ts`):** `default-src 'self'`; `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.mxpnl.com`; `img-src 'self' data: blob: https://*.supabase.co`; `connect-src 'self' https://*.supabase.co https://*.sentry.io https://api.mixpanel.com https://api-js.mixpanel.com`; `frame-ancestors 'self'`. `CONCERN` — `'unsafe-eval'` + `'unsafe-inline'` in `script-src` substantially weakens the CSP's XSS value.

### Will behave differently locally vs on Vercel

1. **Rate limiting.** `src/lib/rate-limit.ts` is an in-process `Map`. Locally that is one process; on Vercel it is per-lambda-instance and resets on every cold start. The 5-per-hour limit on public form/lead endpoints is effectively `5 × (number of warm instances)`. The file says "sufficient for low-traffic admin tool" — it is now also guarding the public revenue funnel.
2. **Node version.** Local `v26.5.0`, declared `>=24 <25`, CI `24`. Three different runtimes.
3. **Crons.** Only fire on Vercel; locally the routes are unreachable without a manual secret-bearing request.
4. **`POCKET_BRAIN_URL`.** The file itself warns that a home-only tailnet IP is unreachable from a Vercel lambda.
5. **`ignoreCommand`.** Only runs on Vercel — a local build always builds.
6. **Middleware deprecation.** The build prints: *"The `middleware` file convention is deprecated. Please use `proxy` instead."* Build output labels it `ƒ Proxy (Middleware)`. Still functional in 16.2.x; a forward-compat migration is owed.

---

## 13. AI Architecture

Two deliberately separate AI paths.

### A. Sales agent (paid, Anthropic) — `src/lib/agent/`

```
Inbound SMS (Twilio)  →  /api/agent/sms/inbound   [HMAC verified]
   → agent/guard.ts            license/kill-switch check
   → agent/compliance/*        quiet hours · opt-out · banned phrases · area-code timezone
   → agent/persona/*           base-prompt + bella-voice + tenant-overlay (per-tenant persona)
   → agent/redact-pii.ts       PII stripped before the model sees it
   → agent/llm-router.ts       Anthropic Messages API
   → agent/state-machine.ts    B/A/T qualification state
   → agent/handoff.ts          escalate_human
   → twilio-send.ts            outbound (rate-limited)
   → agent/audit.ts            audit_events
```

`llm-router.ts` specifics (CONFIRMED):
- Models: `sonnet: "claude-sonnet-4-6"`, `haiku: "claude-haiku-4-5-20251001"`; `pickModel()` routes `simple_route → haiku`, `qualify|close → sonnet`.
- **Structured output** enforced by a Zod schema (`message`, `assessment {B,A,T,confidence}`, `next_action` enum of 8) with markdown-fence stripping and **1 retry** on schema failure.
- **Timeout:** 8 s via `AbortController`, chosen against Twilio's ~15 s webhook retry window, surfaced as a typed `LlmTimeoutError` so the orchestrator can fall back rather than hang.
- **Cost control:** `max_tokens: 600`; per-call USD cost computed from a hardcoded price table (`sonnet 3.0/15.0`, `haiku 0.8/4.0` per Mtok).

`CONCERN` — model IDs and per-token prices are hardcoded constants with no verification against the current Anthropic model list or pricing. If either drifts, the app silently mis-reports cost or fails at call time. Worth verifying `claude-sonnet-4-6` is still a served model ID before the next deploy.

### B. Member assistant (free, self-hosted) — `src/lib/pocket-brain.ts` → `/api/pocket/chat`

Deliberately **not** Anthropic — the file states the point is that inference runs on the owner's own LiteLLM/Ollama hub so no per-token cost is paid to a third party; members pay in TMMT tokens (`src/lib/token-ledger.ts`). Speaks the OpenAI-compatible Chat Completions API. Defaults: model `qwen2.5:14b`, 30 s timeout (clamped 2–120 s), `max_tokens` 600 (clamped 64–4000), `MAX_HISTORY` 6 turns. Failures are typed (`not_configured | unreachable | empty | bad_response`) and never shown raw to members. The system prompt is compliance-locked (no "repair", "fix", "delete", "guarantee", "100%"; defers to licensed professionals).

`/api/pocket/chat` requires a session, meters TMMT tokens, and rate-limits.

### Other AI touchpoints
- `src/lib/agents/run-on-case.ts` — runs an agent against a case row (service-role).
- `src/lib/ops-ai.ts` — the only `OPENAI_API_KEY` reference in `src`. `UNKNOWN` whether live.
- `src/app/api/mission/generate` — daily Mission Control summary, delivered to Telegram by GitHub Action.

**Not present:** embeddings, vector search, RAG, tool/function calling, streaming responses, conversation memory beyond `agent_conversations`/`agent_messages` and Pocket's 6-turn window.

`CONCERN` — three AI abstractions (`llm-router`, `pocket-brain`, `ops-ai`) with three different clients, error models and cost models. Justified today by the paid/free split, but there is no shared interface.

---

## 14. Dependency Analysis

**33 runtime dependencies, 17 dev.** Small for an app this size.

| Category | Packages |
|---|---|
| Framework/runtime | `next` 16.2.11, `react` / `react-dom` 19.2.4 |
| UI | `lucide-react` (74 files), `clsx`, `tailwind-merge`, `tailwindcss` v4, `@tailwindcss/postcss`, `recharts`, `leaflet` + `react-leaflet` + `@types/leaflet`, `@dnd-kit/{core,sortable,utilities}` |
| Database | `@supabase/supabase-js`, `@supabase/ssr` |
| Auth | (Supabase Auth — no separate auth package) |
| AI | `@anthropic-ai/sdk` |
| Networking/API | `stripe`, `twilio` (GHL/Airtable/ClickUp via raw `fetch`) |
| State management | **none** |
| Validation | `zod` v4 |
| Testing | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test` |
| Build/dev | `typescript`, `eslint` 9, `eslint-config-next`, `tsx`, `@types/*` |
| Analytics/observability | `mixpanel-browser`, `@sentry/nextjs` |
| Utility | `date-fns` |

**`overrides` block:** `sharp ^0.35.0`, `postcss ^8.5.23`, `esbuild ^0.28.1`, `browserslist ^4.28.7` — `INFERRED` transitive-vulnerability pins. No comment explains why; when they can be dropped is undocumented.

### Flags

| Flag | Detail | Severity |
|---|---|---|
| `next` 16.2.11 declared, 16.2.10 installed | build banner disagrees with `package.json`; `eslint-config-next` is pinned to 16.2.10 | low |
| Three lockfiles | root, `apps/engine/`, `aria/` — three dependency graphs, no workspace linking | medium |
| `date-fns` (1 file), `@dnd-kit/*` (1), `leaflet`+`react-leaflet` (1), `mixpanel-browser` (1) | heavyweight deps with a single consumer each; `leaflet` also ships CSS/asset requirements | low |
| Two payment integrations | Stripe SDK + 14 GHL checkout URLs | medium (product question, not a bug) |
| `engines` vs local Node | `>=24 <25` vs `v26.5.0` | medium |
| No `npm audit` evidence | not run here (would not modify state, but was out of the executed scope) | UNKNOWN |

No deprecated packages were positively identified. Nothing was upgraded.

---

## 15. Testing

| Kind | Tool | Location | Count | Result |
|---|---|---|---|---|
| Unit + DOM | Vitest 3 + jsdom + Testing Library | co-located `*.test.ts(x)` in `src/` and `shared/` | **58 files, 483 tests** | ✅ **483 passed, 0 failed, 1.10 s** |
| E2E | Playwright | `e2e/smoke.spec.ts`, `e2e/dispatch-rls.spec.ts`, `e2e/net-only-refactor.spec.ts` | 3 specs | **NOT RUN** — needs a dev server + real credentials |
| Route audit crawl | Playwright project `audit` | `e2e/audit.spec.ts` + `scripts/audit-{login,reset,report}.mjs` | 106-route crawl, `workers: 1`, NDJSON output | **NOT RUN** — needs `AUDIT_EMAIL`/`AUDIT_PASSWORD` |
| Prod smoke | Playwright | `playwright.prod.config.ts` → `https://tmmt-ops.vercel.app` | 1 spec | **NOT RUN** — would hit production |
| CI | GitHub Actions `verify.yml` | brand-check · lint · test · build on every PR and push to `master` | — | CONFIRMED configured |

**Well covered:** `site-domains` (18 tests), `platform/tenant-resolve` (20), `ghl-payment-sync` (15), `program-applications-server` (10), `shared/compliance-gates/sms-gate` (10), `affiliates` (8), `aixmos-prequal-act` (9), `revenue` (9), `platform/tenant-org` (9), `agent/{redact-pii,twilio-send,tenant,guard,handoff}`, `auth-roles` (6), `compliance` (7), `verticals/registry` (7), brand components, `OnboardClient` (7).

**Not covered by any automated test (CONFIRMED by absence):**
- **`src/middleware.ts`** — the authorization core. `auth-roles.ts` is tested; the middleware that consumes it, with its 40+ path predicates and three overlapping public-path allowlists, is not.
- **All 28 API route handlers** — no route-handler tests exist. Webhook signature verification, cron auth, license provision/heartbeat, and the two public unauthenticated endpoints are covered only by whatever the E2E specs touch.
- **Server actions** — `app/forms/actions.ts` (741 ln), `app/workflow-actions.ts` (361 ln), `(command)/dispatch/actions.ts` (422 ln) — the largest business-logic files in the repo.
- **RLS policies** — one E2E spec (`dispatch-rls.spec.ts`) targets this and was not run.
- **`credit-dispute` letter generation** — regulated output, no tests found.

No coverage percentage is reported here because none was measured.

---

## 16. Build Health

All four checks were executed in this working tree. Nothing was installed, upgraded, or modified; `node_modules` was already present.

| Command | Result | Errors | Notes |
|---|---|---|---|
| `npx tsc --noEmit` | ✅ **PASS** | 0 | clean |
| `npm run lint` (`eslint`) | ✅ **PASS** | **0 errors, 40 warnings** | 34 × `react-hooks/set-state-in-effect`; 5 × unused vars/imports; 1 × unused `eslint-disable` |
| `npm test` (`vitest run`) | ✅ **PASS** | 0 | 58 files / 483 tests in 1.10 s |
| `npm run build` (`next build --webpack`) | ✅ **PASS** (exit 0) | 0 | ~17 s compile, TS 4.6 s, 140 static pages in 270 ms |
| `npm run test:e2e` (Playwright) | **NOT RUN** | — | requires a running dev server and real login credentials |
| `npm run smoke:prod` | **NOT RUN** | — | would hit production |
| `npm run verify` | **NOT RUN as a unit** | — | its three constituents were run individually and all passed |

### Build warnings (all non-fatal)

1. `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` — Next 16 forward-compat.
2. `A Node.js API is used (process.features) which is not supported in the Edge Runtime` — originates inside `@sentry/nextjs/build/esm/edge/index.js`, i.e. **vendor code, not app code**.
3. 3 × webpack `PackFileCacheStrategy` "serializing big strings (127–139 kiB)" — cache perf only.
4. `DeprecationWarning: module.register() is deprecated` — Node 26 vs the toolchain; would not appear on Node 24.

---

## 17. Security Observations

Non-destructive review only. No vulnerability was exploited, no authentication bypassed, and **no secret value is reproduced anywhere in this document.**

### Committed secrets

**None found at HEAD.** A scan of tracked files for `sk-ant-api03…`, `sk_live_…`, `sb_secret_…`, `AKIA…`, `ghp_…`, `xox[baprs]-…`, and Supabase JWT prefixes returned four hits, **all verified as pattern strings or documentation, not credentials**:

- `scripts/seat.sh`, `scripts/set-service-key.sh` — shell `case` patterns validating key *shape*
- `docs/security/GITLEAKS-PUSH-BLOCKED.md` — allowlist example
- `tools/wiki/index.html` — the gitleaks rule table rendered into the wiki

`.gitleaks.toml` documents one historical finding: an Airtable PAT committed in an early planning doc, redacted at HEAD, still present in ~80 historical commits, and **verified dead 2026-06-22** (tested against Airtable `/v0/meta/whoami` → 401). It is allowlisted so the guard stops blocking. That verification is the right call; a history scrub is cosmetic.

### Defences that are present and working

- Pre-commit hook: blocks `.env*`, `*.pem/p12/pfx/key`, `id_rsa/ed25519/dsa`, `*CREDENTIALS*` by filename, **plus** content patterns on added lines, **plus** gitleaks if installed.
- Pre-push hook: refuses to push if any secret file is tracked; protects `master`/`main` from force-push and delete; runs the full lint/test/build gate so broken code cannot be pushed.
- `timingSafeEqual` used in 5 of 6 secret-comparison sites, with an explicit length guard in `/api/ops/command` to avoid leaking length through exception timing.
- GHL webhooks carry signature verification **and** idempotency (`consumeGhlEventId` → 409 on replay).
- Twilio and Cal webhooks use HMAC.
- Middleware **fails closed** on Supabase error.
- `X-Robots-Tag: noindex, nofollow, noarchive` on every non-public response.
- `import "server-only"` on the service-role factory; the browser-client module documents why the factory was removed from it.
- PII redaction before any model call (`agent/redact-pii.ts`, tested).
- CORS is an explicit allowlist (`isAixmosCorsOrigin`), and `OPTIONS` returns 403 for unlisted origins.
- Inbound `x-org` headers are always stripped in middleware; an unknown host gets **no** org rather than a default one.

### Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| S1 | **Two `.env` files with production secrets are mode `644`** | `.env.vercel-prod` (52 vars), `.env.vercel-pulled` (21 vars) | **P1** |
| S2 | **`/api/license/heartbeat` authenticates by string equality on a client-supplied `hardware_uuid`** — the value is a bearer identifier, not a secret. Anyone with `organization_id` + `hardware_uuid` can heartbeat, keep a revoked-but-not-yet-wiped install looking alive, and read `kill_command`. The provision route's own docstring says the enrolled `enclave_pubkey_pem` "proves neither hardware provenance nor possession of the private key". | `src/app/api/license/{heartbeat,provision}/route.ts` | **P1** |
| S3 | **`session_token` returned by `/api/license/provision` is never verified anywhere** — `grep` finds exactly one occurrence in the whole tree: the line that creates and returns it. Clients may believe they hold a session credential that grants nothing and proves nothing. | `provision/route.ts:71` | **P2** |
| S4 | **Rate limiting is per-process in-memory** on public revenue endpoints (`/api/forms/submit`, `/api/leads/webhook`, `/forms` POST, login). On Vercel the effective limit is `5/hour × warm instances` and resets on every cold start. | `src/lib/rate-limit.ts` | **P2** |
| S5 | **`/api/audit/events` `JSON.parse` is not wrapped in try/catch** — `lines.map(line => JSON.parse(line))` throws on a single malformed NDJSON line, producing an unhandled 500 instead of a 400. Authenticated-only, so impact is availability of the audit ingest, not disclosure. | `audit/events/route.ts` | **P3** |
| S6 | **47 service-role call sites bypass RLS**, including two Pocket page components rendered for *any* signed-in tier. Every authorization decision at those sites is TypeScript-only. | 30 files | **P2** |
| S7 | **Two admin truth sources** — `app_metadata.role` (TS) vs `profiles.role` (`is_platform_admin()` in SQL). Verified in agreement on 2026-08-31; nothing keeps them in sync. | `auth-roles.ts` | **P3** |
| S8 | **CSP allows `'unsafe-inline'` and `'unsafe-eval'`** in `script-src`, which removes most of the CSP's XSS value. | `next.config.ts` | **P3** |
| S9 | **Two service-role factories**, only one with the `server-only` guard (`lib/supabase-service.ts` has it; `lib/agent/supabase-server.ts` `createServiceSupabase` needs checking). | both files | **P3** |
| S10 | **`CRON_SECRET` undocumented** in `.env.example`. If unset, `authorized()` returns `false` and both cron routes 401 silently forever. | cron routes vs `.env.example` | **P3** |
| S11 | **No rate limiting on `/api/license/provision`** — install-token guessing is unthrottled (bounded practically by sha256 preimage difficulty, so low real risk). | `provision/route.ts` | **P4** |

**Not found (checked):** SQL injection surface (all DB access goes through the Supabase client or RPC), `dangerouslySetInnerHTML`, `eval` in app code, open redirects taking a user-supplied URL, sensitive values in `console` output (only `console.error`/`console.warn`, 106 sites, none logging credentials in the sampled set).

---

## 18. Technical Debt

### High-confidence, objective

| Item | Measurement |
|---|---|
| 40 ESLint warnings | 34 `set-state-in-effect`, 5 unused vars/imports, 1 stale disable directive |
| `middleware` → `proxy` migration owed | Next 16 deprecation, printed on every build |
| Node version split three ways | local 26.5.0 / declared 24 / CI 24 |
| `next` version skew | 16.2.11 declared vs 16.2.10 installed |
| Three unlinked Next apps, three lockfiles | `src/`, `apps/engine/`, `aria/` |
| Env documentation drift | 36 used-but-undocumented, 18 documented-but-unused |
| 327 local branches | vs 80 remote |
| `.git` at 257 MB | for ~47 k lines of application code |
| 5 worktrees, 2 detached | see §2 |
| 4 untracked migrations + 1 rename mid-flight | see §2 |
| 176 top-level docs, 25 root-level `.md`/`.command` files | root directory has 70+ entries |
| Near-empty planning dirs | `workstream-{1,2,3}-*` (5/7/6 files) |
| Duplicate-looking components | `learn/workflow-banner.tsx` vs `program/WorkflowBanner.tsx` |
| `dist/` is tracked (23 files) | build-artifact-named directory in version control |

### Notably absent (this is the good news)

**Zero** `as any`. **Zero** `console.log`. **Zero** empty catch blocks. **Zero** real `TODO`/`FIXME`/`HACK` markers (the 3 grep hits are literal `XXXX-XXXX` and `XXX-XX-` placeholder strings in a login field and two letter templates). Only 7 `@ts-expect-error`/`eslint-disable` occurrences in 462 files. Largest file 741 lines.

### Subjective / style (listed separately on purpose)

- Route-group naming mixes concerns: `(admin)` is the rentals desk while `(command)` is the owner console — the distinction is real but not obvious from the names.
- `src/lib` has 24 subdirectories with overlapping-sounding names (`client-journey`, `client-rental`, `client-updates`, `crm-sync`, `intake`, `people`, `routing`).
- Comment style is unusually narrative — often several paragraphs of history above a small function. This is a genuine asset for onboarding an AI worker and a liability for diff review; treat it as intentional and preserve it.

---

## 19. Git / CI / Deployment Workflow

**Branching (INFERRED from 327 branch names):** `master` is production. Prefixes in use: `claude/*` (by far the most), `cursor/*`, `preview/*`, `swarm/*`, `carry/*`, `docs/*`, `chore/*`, `audit/*`, `backup/*`, `landing/*`, `rescue/*`. Merges land through GitHub PRs (`Merge pull request #187` in recent history).

**Hooks:** `git config core.hooksPath` = **`scripts/hooks`** (not the `.githooks/` directory that also exists — `CONCERN`, two hook directories with the same filenames; only `scripts/hooks` is live). Installed by `scripts/swarm-join.sh`.

- `pre-commit` — secret guard (filename rules + content patterns + gitleaks if present)
- `pre-push` — tracked-secret check, force-push/delete protection on `master`/`main`, gitleaks scan of pushed commits, and the **full lint/test/build gate**

**CI (`.github/workflows/`):**

| Workflow | Trigger | Does |
|---|---|---|
| `verify.yml` | every PR + push to `master` | Node 24, `npm ci`, brand-check → lint → test → build. Concurrency-grouped with `cancel-in-progress`. Explicitly needs no secrets. |
| `pii-guard.yml` | every push + PR | `./ultimatrix.sh scan` against a `PII_DENYLIST` repo secret |
| `session-autopilot.yml` | every 6 h + manual | **Zero-human branch management:** opens PRs for `claude/*` branches ahead of master, enables auto-merge on open `claude/*` PRs, deletes merged and stale branches. Its header notes the one-time branch-protection setup (require `verify` + `pii-scan`, allow auto-merge) that unlocks it. |
| `mission-daily.yml` | daily 13:00 UTC + manual | Calls `/api/mission/generate` with `CRON_SECRET`; a free replacement for a Vercel Pro cron |

**Deployment:** push to `master` → Vercel evaluates `scripts/vercel-ignore.sh` → builds only if app-relevant paths changed → deploys `tmmt-ops`. `scripts/ship.sh` refuses to deploy unless `scripts/verify.sh` passes. Preview deployments are implied by Vercel's git integration; `swarm-coord` is explicitly excluded.

**`scripts/verify.sh` is the designed single gate** — the same check runs for humans (`npm run verify`), git (`pre-push`), deploy (`ship.sh`) and CI (`verify.yml`). It takes a `.swarm/verify.lock`. This is a genuinely good design and any orchestration system should route through it rather than around it.

### Is this repository ready for multiple AI workers on isolated branches?

**Partially, and not safely today.**

Working in favour: a real gate (`verify.sh`) wired into four entry points; a branch-autopilot workflow; secret hooks on both commit and push; force-push protection on `master`; `sync-machine.sh` which **never force-pushes, never merges**, and (as of commit `71e86f9b6`) `die()`s loudly when a stash pop conflicts instead of continuing.

Working against: 327 branches with no visible retention policy; 5 worktrees sharing one `.git`; **no work-ownership lease or task lock anywhere in the repository**; `.swarm/machine` is a plain text file (`macbook-pro-3`) that any process can write, so node identity is spoofable and unverified; and `.swarm/mesh.tsv` does not exist in this worktree, so nothing enumerates the mesh.

---

## 20. Multi-Machine Orchestration Readiness

**Intended topology:** M1 (always-on control plane) · M5 (interactive workstation) · MUSCLE Windows (compute/build/test) · BRAINIAC Windows (analysis/browser verification).

### What already exists

| Capability | State |
|---|---|
| Deterministic verification gate | ✅ `scripts/verify.sh` — one command, four entry points, takes a lock file |
| Branch lifecycle automation | ✅ `session-autopilot.yml` — PR + auto-merge + branch GC every 6 h |
| Safe sync primitive | ✅ `scripts/sync-machine.sh` — stash → rebase → push, never force, never merge, dies on conflict |
| Swarm scaffolding | ⚠️ `scripts/swarm.sh`, `swarm-join.sh`, `swarm-doctor.sh`, `smoke-dispatch.sh`, `mesh/`, `dual-sync/` exist and are non-trivial, but were not executed here |
| Node identity | ❌ `.swarm/machine` is an unauthenticated plain-text file; `.swarm/mesh.tsv` is absent |
| Task queue | ❌ none in-repo. `.swarm/dispatch-log.tsv` is a log, not a queue |
| Work locking / branch ownership | ❌ nothing prevents two machines taking the same task or branch |
| Rollback | ⚠️ git revert + Vercel instant rollback exist; no scripted procedure found |
| Logging | ⚠️ `.swarm/*.log`, Sentry, `audit_events` — three sinks, no unified view |

### Blockers, in the order they must be solved

1. **Live processes are already writing to this working copy.** Right now: `scripts/hailmary-daemon.sh` (under `caffeinate -is`), `scripts/mesh/memory-sync.sh loop 300`, and a 30-second polling loop left over from a **prior Claude session** watching for this branch to land on `master`. A second machine acting on this tree today would be racing three unsupervised local processes. **This must be inventoried and quiesced before any orchestration is switched on.**
2. **No identity, no lease.** `.swarm/machine` says `macbook-pro-3`; nothing verifies it. Before task assignment can be trusted, a node needs a verifiable identity and a task needs an exclusive, expiring lease. The repository already contains a server-side device-identity plane (`organization_licenses`, `/api/license/{provision,heartbeat,revoke}`, `audit_events`) — **reuse it rather than inventing a second one**, but note S2/S3: it is not yet authenticated strongly enough to bear that weight.
3. **Windows/macOS parity is unproven.** Everything operational is bash: `verify.sh`, `ship.sh`, `swarm*.sh`, `sync-machine.sh`, `vercel-ignore.sh`, `.githooks`, all 260 `scripts/` entries. MUSCLE and BRAINIAC need **WSL2** (or Git Bash, which will not run all of these). `INFERRED` — no PowerShell equivalents of the gate were found in-repo. `AIXMOS/docker/docker-compose.yml` exists but is for the portal, not for CI.
4. **Node/package-manager consistency.** Pin one Node — the declared `>=24 <25` matching CI's 24 — via `.nvmrc`/Volta on all four machines. Local is currently 26.5.0. Use `npm ci` everywhere; never let two machines run `npm install` into the same tree.
5. **Worktrees vs clones.** Five worktrees share one `.git` on this machine, and `projects/` vs `Projects/` are the same directory on macOS. Cross-machine, use **separate clones**, not shared worktrees — a shared `.git` across machines has no locking story.
6. **Three lockfiles.** Any dependency step must name which of `/`, `apps/engine/`, `aria/` it targets, or workers will fight.
7. **Credentials.** Each machine needs its own scoped credentials. Do **not** copy `.env.vercel-prod` around — and fix its `644` mode first (S1). Preview deploys, browser verification and E2E all need distinct test accounts (`E2E_*`, `AUDIT_*`, `PARTNER_TEST_*` names already exist).
8. **Browser verification.** Playwright is configured and BRAINIAC is the natural host, but the browsers are not installed by `verify.sh`, the audit crawl is `workers: 1` by design (it appends NDJSON from inside the test process), and `playwright.prod.config.ts` points at **production** — that config must never be handed to an autonomous worker.
9. **Preview deployments.** `vercel.json` only pins `master: true` / `swarm-coord: false`. Whether every `claude/*` branch produces a preview URL is `UNKNOWN` from the repository; it is a Vercel project setting. Worth confirming before wiring browser verification to preview URLs.
10. **Uncommitted work is unprotected.** Four migrations and a test file currently exist only as untracked files. Any worker that resets or cleans this tree destroys them. **Commit or stash-and-record them before the first orchestrated run.**

### Verdict

**Not ready.** The *quality gate* is orchestration-ready — `verify.sh` is exactly the right primitive and should be the contract every worker satisfies. The *repository state* is not: no task queue, no lease, no verified node identity, live unsupervised daemons, unprotected uncommitted work, and an entirely bash-shaped tooling layer facing two Windows machines.

Minimum before a first multi-machine run: (a) quiesce and inventory the running daemons; (b) commit or safely park the untracked migrations; (c) fix `.env` file modes; (d) pin Node to 24 fleet-wide; (e) stand up a real task queue with leases keyed to a verified node identity; (f) prove `verify.sh` green on WSL2 on both Windows boxes.

---

## 21. Prioritized Findings

---

**ID:** F-01
**PRIORITY:** P0
**CATEGORY:** security / secret exposure
**CONFIDENCE:** CONFIRMED
**FILES:** `.env.vercel-prod` (mode 644, 52 vars), `.env.vercel-pulled` (mode 644, 21 vars)
**EVIDENCE:** `stat -f '%Lp'` returns `644` for both; the other five `.env` files are `600`.
**IMPACT:** ~73 production secrets — including `SUPABASE_SERVICE_ROLE_KEY`, GHL/Twilio/Anthropic/Airtable/ClickUp credentials — are readable by any local user account or unprivileged process on this machine. A service-role key is full database access with RLS bypassed.
**PROBABLE ROOT CAUSE:** `vercel env pull` writes with the process umask; the other files were hardened manually and these two were pulled afterwards.
**RECOMMENDED NEXT INVESTIGATION:** Confirm the modes, `chmod 600` both, then determine whether either file has ever been readable by a non-owner process. Given the exposure window is unknown, treat rotation of the contained credentials as the default and decide deliberately if not.

---

**ID:** F-02
**PRIORITY:** P1
**CATEGORY:** security / broken authentication
**CONFIDENCE:** CONFIRMED
**FILES:** `src/app/api/license/heartbeat/route.ts`, `src/app/api/license/provision/route.ts`
**EVIDENCE:** heartbeat's only credential check is `if (license.hardware_uuid !== hardware_uuid)` against a value the client supplies in the request body. `provision`'s own docstring: the enrolled `enclave_pubkey_pem` "proves neither hardware provenance nor possession of the private key, and is never sufficient for an authorization decision." `enclave_pubkey_pem` is written at provision and never read back anywhere.
**IMPACT:** Anyone who learns an `organization_id` + `hardware_uuid` pair can keep a revoked install's heartbeat alive, poll `kill_command`, and pollute `audit_events`. The identity plane the whole fleet story depends on is a bearer identifier, not a proof of possession.
**PROBABLE ROOT CAUSE:** v1 shipped enrollment before signing. The code is honest about it; the design was never finished.
**RECOMMENDED NEXT INVESTIGATION:** Decide the target scheme (a signed nonce challenge over a real hardware key — Secure Enclave P-256 on Macs, TPM 2.0 on Windows). Because existing keys have no hardware provenance, existing bindings need **re-provisioning**, not upgrading. Scope that migration before writing code.

---

**ID:** F-03
**PRIORITY:** P1
**CATEGORY:** data loss risk
**CONFIDENCE:** CONFIRMED
**FILES:** `supabase/migrations/2026090318563*`, `2026090319*`, `supabase/migrations/_staged/`, `supabase/migrations/20260827000001_org_ghl_connections.sql`, `src/lib/agent/tenant.test.ts`
**EVIDENCE:** `git status` shows 4 untracked migrations, an untracked `_staged/` directory, an untracked test file, and a tracked migration deleted as half of a timestamp rename. Three background processes are running against this working copy (§20).
**IMPACT:** Untracked files are invisible to git's safety net. Any `git clean`, worktree reset, or aggressive sync destroys this work irrecoverably. `src/lib/agent/tenant.test.ts` is untracked *and* currently executing as part of the green test suite — the passing result partly depends on a file that is not under version control.
**PROBABLE ROOT CAUSE:** Work in progress on a preview branch, with automation running concurrently.
**RECOMMENDED NEXT INVESTIGATION:** Before anything else touches this tree, copy the untracked set somewhere outside the repository, then decide whether the `20260827000000 → 20260827000001` rename is complete and commit it as one change.

---

**ID:** F-04
**PRIORITY:** P1
**CATEGORY:** orchestration / concurrency
**CONFIDENCE:** CONFIRMED
**FILES:** `scripts/hailmary-daemon.sh`, `scripts/mesh/memory-sync.sh`, plus a shell loop inherited from a prior agent session
**EVIDENCE:** `ps` shows `hailmary-daemon.sh` (wrapped in `caffeinate -is`), `mesh/memory-sync.sh loop 300`, and a 30-second polling loop watching for this branch to reach `master` — all rooted at `/Users/ceo.moe/Projects/TMMT`.
**IMPACT:** Any orchestrated worker acting on this repository is racing three unsupervised local processes for the same working tree. Nothing arbitrates.
**PROBABLE ROOT CAUSE:** Long-lived helpers started by earlier sessions and never reaped.
**RECOMMENDED NEXT INVESTIGATION:** Enumerate every process rooted at this path, decide which are load-bearing, and give the survivors a supervised lifecycle. This is a prerequisite for F-13, not a parallel task.

---

**ID:** F-05
**PRIORITY:** P2
**CATEGORY:** security / ineffective control
**CONFIDENCE:** CONFIRMED
**FILES:** `src/lib/rate-limit.ts` (consumed by `middleware.ts`, `api/forms/submit`, `api/leads/webhook`, `api/pocket/chat`, `(auth)/login/actions.ts`)
**EVIDENCE:** module-scope `const hits = new Map<string, number[]>()`; comment reads "In-memory rate limiter — resets on deploy, sufficient for low-traffic admin tool".
**IMPACT:** On Vercel the limiter is per-lambda-instance. Effective limit ≈ `5/hour × warm instances`, resetting on every cold start. It now guards public lead capture, public form submission and login — the revenue funnel and the auth surface, not an admin tool.
**PROBABLE ROOT CAUSE:** Written when the app was staff-only; the public funnel was added around it.
**RECOMMENDED NEXT INVESTIGATION:** Measure real request volume on `/api/leads/webhook` and `/api/forms/submit`, then decide between a durable store (a Supabase table is already available and costs nothing extra) and accepting the limit as best-effort — but document which.

---

**ID:** F-06
**PRIORITY:** P2
**CATEGORY:** security / dead credential
**CONFIDENCE:** CONFIRMED
**FILES:** `src/app/api/license/provision/route.ts:71`
**EVIDENCE:** `grep -rn "session_token" src` returns exactly one line — the one that creates and returns it. No consumer, no verification, no storage.
**IMPACT:** Provisioned clients receive something shaped like a session credential that authorizes nothing. Anything built on the assumption it is checked is built on nothing.
**PROBABLE ROOT CAUSE:** The inline comment says full JWT signing waits on a vault; the placeholder shipped and stayed.
**RECOMMENDED NEXT INVESTIGATION:** Decide with F-02 — either make it a real signed token or stop returning it. Do not leave a credential-shaped value unverified.

---

**ID:** F-07
**PRIORITY:** P2
**CATEGORY:** authorization surface
**CONFIDENCE:** CONFIRMED
**FILES:** 30 files, 47 call sites; notably `src/app/(pocket)/pocket/page.tsx:107`, `src/app/(pocket)/pocket/earn/page.tsx:51`
**EVIDENCE:** `createServiceRoleClient` / `createServiceSupabase` used across route handlers, server actions and **page components**. Middleware grants `/pocket/*` to every signed-in tier.
**IMPACT:** 47 places where the database will not second-guess the code. Row scoping in the Pocket pages is enforced only by the TypeScript in those files, for an audience of every signed-in user.
**PROBABLE ROOT CAUSE:** Service-role reached for whenever RLS was inconvenient; the pattern spread.
**RECOMMENDED NEXT INVESTIGATION:** Audit the two Pocket page components line-by-line for user-scoping first (widest audience, highest reach), then triage the remaining 45 by audience breadth.

---

**ID:** F-08
**PRIORITY:** P2
**CATEGORY:** test coverage gap
**CONFIDENCE:** CONFIRMED
**FILES:** `src/middleware.ts`, all 28 `src/app/api/**/route.ts`, `src/app/forms/actions.ts`, `src/app/workflow-actions.ts`, `src/app/(command)/dispatch/actions.ts`
**EVIDENCE:** 58 test files cover libs and components; no test imports `middleware.ts` or any route handler. The three largest business-logic files have no tests.
**IMPACT:** The single file that decides who may reach what — 282 lines, 40+ path predicates, three overlapping allowlists — has no regression net. Its own comments record two authorization bugs already found and fixed by reading. The next one will be found the same way.
**PROBABLE ROOT CAUSE:** Vitest is configured for jsdom/unit work; route handlers and middleware need a request-level harness that was never set up.
**RECOMMENDED NEXT INVESTIGATION:** Prototype one table-driven test over `pathAllowedForTier(pathname, tier)` — pure, no mocks, immediate value. If that lands, extend to a request-level harness for webhook signature verification.

---

**ID:** F-09
**PRIORITY:** P3
**CATEGORY:** correctness / error handling
**CONFIDENCE:** CONFIRMED
**FILES:** `src/app/api/audit/events/route.ts`
**EVIDENCE:** `const rows = lines.map((line) => { const evt = JSON.parse(line); … })` — no try/catch, while every sibling route wraps its parse.
**IMPACT:** One malformed NDJSON line from any fleet client throws, and the whole batch 500s instead of returning 400. Authenticated-only, so the impact is audit-ingest availability, not disclosure.
**PROBABLE ROOT CAUSE:** The single-JSON path was guarded; the NDJSON path was added without the same guard.
**RECOMMENDED NEXT INVESTIGATION:** Confirm intended semantics — reject the batch, or skip bad lines and report a count. The route already returns `{accepted: n}`, which suggests partial acceptance was the intent.

---

**ID:** F-10
**PRIORITY:** P3
**CATEGORY:** configuration / silent failure
**CONFIDENCE:** CONFIRMED
**FILES:** `.env.example` vs `src/app/api/cron/*/route.ts` (and 35 other undocumented names — §11)
**EVIDENCE:** `authorized()` returns `false` when neither `CRON_SECRET` nor `OPS_COMMAND_SECRET` is set; `CRON_SECRET` is absent from `.env.example`.
**IMPACT:** A deployment missing `CRON_SECRET` makes both Vercel crons 401 forever. Nothing alerts — journey recomputation and weekly marketing KPIs simply stop. `GHL_LOCATION_ID` and `NEXT_PUBLIC_SENTRY_DSN` are undocumented the same way; a missing Sentry DSN means errors stop being reported, silently.
**PROBABLE ROOT CAUSE:** `.env.example` was not updated as features landed.
**RECOMMENDED NEXT INVESTIGATION:** Regenerate `.env.example` from the 36-name list in §11, then extend `scripts/check-env.mjs` to fail on any `process.env` reference in `src` that has no `.env.example` entry.

---

**ID:** F-11
**PRIORITY:** P3
**CATEGORY:** forward compatibility
**CONFIDENCE:** CONFIRMED
**FILES:** `src/middleware.ts`, build output
**EVIDENCE:** `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` Route table already labels it `ƒ Proxy (Middleware)`.
**IMPACT:** Works on 16.2.x. Will break on a future major. Because this file is the entire authorization layer, the migration is high-stakes and should not be done under time pressure — which is an argument for doing it while it is optional, and for doing F-08 first.
**PROBABLE ROOT CAUSE:** Next 16 renamed the convention.
**RECOMMENDED NEXT INVESTIGATION:** Read the official `middleware-to-proxy` guide, confirm the `matcher` config translates unchanged, and land it behind the tier tests from F-08.

---

**ID:** F-12
**PRIORITY:** P3
**CATEGORY:** environment consistency
**CONFIDENCE:** CONFIRMED
**FILES:** `package.json` (`engines.node: ">=24 <25"`), local `node -v` → `v26.5.0`, `.github/workflows/verify.yml` (`node-version: 24`)
**EVIDENCE:** three values, no two the same. The Node 26 `module.register()` deprecation warning appears in the local build and would not appear on 24.
**IMPACT:** Local green does not prove CI green. A Node-26-only behaviour would pass here and fail in CI, or worse, pass both and differ on Vercel.
**PROBABLE ROOT CAUSE:** Machine Node upgraded; `engines` and CI left alone.
**RECOMMENDED NEXT INVESTIGATION:** Decide the fleet-wide version (24 matches CI and the declared range), add `.nvmrc`, and apply on all four machines before orchestration.

---

**ID:** F-13
**PRIORITY:** P4
**CATEGORY:** architecture / orchestration prerequisites
**CONFIDENCE:** CONFIRMED
**FILES:** `.swarm/machine`, absent `.swarm/mesh.tsv`, `scripts/swarm*.sh`, 5 worktrees, 327 branches
**EVIDENCE:** `.swarm/machine` is a plain text file containing `macbook-pro-3`, writable by anything; `mesh.tsv` does not exist in this worktree; no lease, lock or queue construct is present in the repository.
**IMPACT:** Nothing prevents two machines from claiming the same task or branch, and nothing proves which machine did what.
**PROBABLE ROOT CAUSE:** The swarm scripts were built for sequential single-operator handoffs, not concurrent workers.
**RECOMMENDED NEXT INVESTIGATION:** Design the lease on top of the existing `organization_licenses` / `installations` device plane rather than inventing a second identity system — but sequence it after F-02, since that plane's authentication is what a lease would rest on.

---

**ID:** F-14
**PRIORITY:** P4
**CATEGORY:** repository hygiene
**CONFIDENCE:** CONFIRMED
**FILES:** repository root, `.git`, `apps/engine/`, `aria/`
**EVIDENCE:** 327 local branches vs 80 remote; `.git` 257 MB for ~47 k lines; three Next apps with three lockfiles and no workspace tool; 70+ root entries including 25 `.md`/`.command` files; tracked `dist/`; near-empty `workstream-*` directories.
**IMPACT:** Slow clones on every new machine, ambiguous "which app?" for any dependency task, and a root directory that costs an AI worker real context on every session.
**PROBABLE ROOT CAUSE:** Accumulation across many sessions with no retention policy.
**RECOMMENDED NEXT INVESTIGATION:** Let `session-autopilot.yml` do the branch GC it was written for (it needs the one-time branch-protection setup its header documents), then decide whether `apps/engine` and `aria` should be workspaces, separate repositories, or deleted.

---

**ID:** F-15
**PRIORITY:** P4
**CATEGORY:** cost / correctness of AI configuration
**CONFIDENCE:** CONCERN
**FILES:** `src/lib/agent/llm-router.ts`
**EVIDENCE:** `MODELS = { sonnet: 'claude-sonnet-4-6', haiku: 'claude-haiku-4-5-20251001' }` and a hardcoded `PRICE_PER_TOKEN` table, neither validated against anything.
**IMPACT:** A retired model ID fails at call time inside a Twilio webhook (8 s timeout, 1 retry, then error). Stale prices make the recorded `costUsd` — which feeds the money meter and token ledger — quietly wrong.
**PROBABLE ROOT CAUSE:** Values pinned at build time; nothing re-checks them.
**RECOMMENDED NEXT INVESTIGATION:** Verify both IDs against the current Anthropic model list and the prices against current published pricing. If either has moved, treat the recorded cost history as suspect from that date forward.

---

**ID:** F-16
**PRIORITY:** P5
**CATEGORY:** code quality
**CONFIDENCE:** CONFIRMED
**FILES:** 34 client components (incl. `ThemeToggle.tsx:11`, `VoiceCapture.tsx:39`), `credit-dispute/engine/deep-audit.ts:1,37,38`
**EVIDENCE:** `npm run lint` → 0 errors, 40 warnings.
**IMPACT:** Cascading re-renders on mount; three unused constants. Cosmetic today.
**PROBABLE ROOT CAUSE:** `react-hooks/set-state-in-effect` is a newer React 19 rule applied to older code.
**RECOMMENDED NEXT INVESTIGATION:** Batch-fix mechanically, but only after F-08 gives the affected surfaces a net — 34 component edits with no component tests is a poor trade.

---

**Counts:** **P0 ×1 · P1 ×3 · P2 ×4** · P3 ×4 · P4 ×3 · P5 ×1 — **16 findings**.

---

## 22. Unknowns / Missing Information

Answering these needs either a human, a live credential, or a system outside this repository.

1. **Stripe configuration.** No Stripe secret key name is referenced in `src`. Where does the SDK get its key — and is the Stripe rail live, or vestigial next to GHL checkout?
2. **Realtime subscriber.** `/api/leads/webhook` says "downstream realtime subscriber triggers first outbound SMS", but no `.channel()`/`.subscribe()` exists in `src`. Where does it run?
3. **Vercel preview deployments.** Does every `claude/*` branch get a preview URL? Is Deployment Protection on? Both are dashboard settings, invisible here.
4. **Production migration state.** Which of the 45 tracked migrations are actually applied? `docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md` is untracked and unread by this pass.
5. **RLS effectiveness.** 137 policies exist in SQL. Whether they are enabled and correct on the live database cannot be determined from files.
6. **`apps/engine` and `aria`.** Live products, abandoned experiments, or references? Nothing builds or deploys them.
7. **`_parked/` (4) and `_staged/` (5) migrations.** What are they waiting on?
8. **`ops-ai.ts` / OpenAI.** Live path or residue?
9. **`B3_KILL_SWITCH`.** Referenced 5× in `src`. Semantics undocumented.
10. **Branch protection on `master`.** `session-autopilot.yml` documents a required one-time setup (require `verify` + `pii-scan`, allow auto-merge). Was it done? If not, the autopilot cannot merge and 327 branches is the visible symptom.
11. **The 6 unpushed commits.** Intended for `master`, or preview-only?
12. **`PII_DENYLIST` secret.** `pii-guard.yml` needs it; whether it is set is invisible here.
13. **Windows machines.** WSL2 present? Node version? Do the bash scripts run? None of this is knowable from the repo.
14. **`.env.vercel-prod` exposure window.** How long has it been `644`, and has anything read it?

---

## 23. Recommended Next Investigation

In dependency order. Nothing here has been done.

**Before anything else touches this tree**
1. `chmod 600` the two `644` env files (F-01) and decide on rotation.
2. Copy the untracked migrations + `tenant.test.ts` outside the repository, then commit or deliberately park them (F-03).
3. Inventory and quiesce the three daemons running against this working copy (F-04).

**Then, to make the baseline trustworthy**
4. Answer unknowns 3, 4, 5, 10 — they gate any deploy or migration decision and none can be answered from files.
5. Pin Node 24 fleet-wide, add `.nvmrc` (F-12).
6. Regenerate `.env.example`; extend `check-env.mjs` to fail on drift (F-10).

**Then, the security work**
7. Design the license identity scheme end-to-end — F-02 and F-06 together, including the re-provisioning migration. Do not start coding until the scheme is agreed.
8. Audit the two Pocket page components for user scoping (F-07).
9. Decide on durable rate limiting for the public funnel (F-05).

**Then, the coverage that makes everything after it safe**
10. Table-driven tests over `pathAllowedForTier` (F-08). This is the highest-leverage single item in the document: it is pure, needs no mocks, and it is what makes the `middleware → proxy` migration (F-11) and the 34 component fixes (F-16) safe to attempt.

**Only then, orchestration**
11. Prove `verify.sh` green on WSL2 on MUSCLE and BRAINIAC.
12. Design node identity + task leases on the existing device plane (F-13) — after F-02, since that is what a lease would rest on.
13. Let `session-autopilot.yml` reduce 327 branches (F-14).

**Explicitly not recommended yet:** upgrading dependencies, refactoring the three-app layout, or scrubbing git history. None of them is the constraint, and each would churn the baseline this dossier exists to establish.

---

## 24. Machine-Readable Project Snapshot

```json
{
  "project": {
    "name": "tmmt-app",
    "version": "0.1.0",
    "private": true,
    "display_name": "TMMT Rentals / AIXMOS Ops",
    "root": "/Users/ceo.moe/Projects/TMMT",
    "purpose": "Owner-operated business OS: vehicle-rental admin + command/dispatch + credit-funding program + operator network + member app + investor/vendor portals, in one Next.js deployment",
    "structure": "single-app",
    "is_monorepo": false,
    "workspace_tool": null,
    "extra_apps_in_repo": ["apps/engine (@aixmos/engine)", "aria", "packages/aixmos-core (@aixmos/core)"],
    "source_files": 462,
    "source_lines_ts_tsx": 47091
  },
  "git": {
    "provider": "github",
    "remote": "https://github.com/AIXMOS537/TMMT.git",
    "branch": "preview/rename-moe-legacy-to-aixmos-credit",
    "head": "b748f7bcb1d45e5695e9c96d2359833d41d3617c",
    "head_subject": "naming: attestation_hash -> binding_hash; stop claiming attestation",
    "production_branch": "master",
    "ahead_of_origin_master": 6,
    "behind_origin_master": 0,
    "local_branches": 327,
    "remote_branches": 80,
    "worktrees": 5,
    "stashes": 0,
    "git_dir_size": "257MB",
    "working_tree_clean": false,
    "uncommitted_paths": 13,
    "untracked_migrations": 5,
    "hooks_path": "scripts/hooks",
    "hooks": ["pre-commit", "pre-push"],
    "secret_scanning": ".gitleaks.toml + hook patterns + PII guard workflow"
  },
  "framework": {
    "name": "next",
    "version_declared": "16.2.11",
    "version_installed": "16.2.10",
    "router": "app",
    "bundler": "webpack (explicit --webpack flag)",
    "react": "19.2.4",
    "typescript": "^5",
    "css": "tailwindcss v4 via @tailwindcss/postcss",
    "middleware": "src/middleware.ts (deprecated convention; Next 16 wants 'proxy')"
  },
  "runtime": {
    "node_declared": ">=24 <25",
    "node_local": "v26.5.0",
    "node_ci": "24",
    "npm_local": "12.0.1",
    "mismatch": true
  },
  "package_manager": {
    "name": "npm",
    "lockfiles": ["package-lock.json", "apps/engine/package-lock.json", "aria/package-lock.json"],
    "ci_command": "npm ci",
    "overrides": ["sharp@^0.35.0", "postcss@^8.5.23", "esbuild@^0.28.1", "browserslist@^4.28.7"]
  },
  "deployment": {
    "platform": "vercel",
    "project_name": "tmmt-ops",
    "deploy_branches": {"master": true, "swarm-coord": false},
    "ignore_command": "bash scripts/vercel-ignore.sh",
    "crons": [
      {"path": "/api/cron/marketing-kpi-ghl", "schedule": "0 13 * * 1"},
      {"path": "/api/cron/journey-recompute", "schedule": "0 4 * * *"}
    ],
    "rewrites_vercel_json": 2,
    "rewrites_next_config": 11,
    "redirects_next_config": 6,
    "security_headers": ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"],
    "csp_weaknesses": ["script-src 'unsafe-inline'", "script-src 'unsafe-eval'"],
    "server_actions_body_limit": "20mb",
    "regions": null,
    "preview_deploys_confirmed": "unknown"
  },
  "database": {
    "engine": "postgresql",
    "provider": "supabase",
    "orm": null,
    "access": "@supabase/supabase-js + @supabase/ssr",
    "clients": {
      "browser": "src/lib/supabase.ts (lazy Proxy singleton)",
      "server": "src/lib/supabase-server.ts (createSSRClient, createMiddlewareClient)",
      "service_role": ["src/lib/supabase-service.ts (server-only)", "src/lib/agent/supabase-server.ts (createServiceSupabase)"]
    },
    "service_role_call_sites": 47,
    "service_role_files": 30,
    "migrations_tracked": 45,
    "migrations_parked": 4,
    "migrations_staged_untracked": 5,
    "migration_range": "2026-03-31 to 2026-09-03",
    "rls_migrations": 7,
    "rls_policies": 137,
    "tables_referenced_in_code": 60,
    "top_tables": ["cases", "incoming_leads", "crm_sync_records", "units", "sync_events", "profiles", "organizations", "incidents", "vendor_jobs", "time_clock_entries"],
    "edge_functions": ["intake"],
    "storage": true,
    "realtime_in_repo": false,
    "multi_tenancy": "host-based; tenant header for brand, org header for data scope; no default org for unknown hosts; inbound org header always stripped"
  },
  "authentication": {
    "provider": "supabase-auth",
    "methods": ["email+password"],
    "oauth_providers": [],
    "session": "cookies via @supabase/ssr",
    "enforcement": "src/middleware.ts (fails closed on Supabase error)",
    "role_source": "app_metadata.role",
    "db_role_source": "profiles.role via is_platform_admin()",
    "roles": ["admin", "internal_team", "va", "executive_va", "executive", "operator", "investor", "partner", "vendor", "customer"],
    "tiers": ["owner", "executive", "operator", "staff", "investor", "vendor", "none"],
    "default_tier": "none",
    "owner_hub_host_env": "NEXT_PUBLIC_OWNER_HUB_HOST",
    "middleware_tested": false
  },
  "ai": {
    "paths": [
      {
        "name": "sales-agent",
        "provider": "anthropic",
        "sdk": "@anthropic-ai/sdk@^0.104.1",
        "file": "src/lib/agent/llm-router.ts",
        "models": {"sonnet": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5-20251001"},
        "structured_output": "zod schema, 1 retry, markdown-fence stripping",
        "timeout_ms": 8000,
        "max_tokens": 600,
        "cost_tracking": "hardcoded price table, per-call USD computed",
        "pipeline": ["guard", "compliance", "persona", "redact-pii", "llm", "state-machine", "handoff", "twilio-send", "audit"]
      },
      {
        "name": "pocket-brain",
        "provider": "self-hosted OpenAI-compatible (LiteLLM/Ollama)",
        "file": "src/lib/pocket-brain.ts",
        "default_model": "qwen2.5:14b",
        "timeout_ms": 30000,
        "max_tokens": 600,
        "max_history_turns": 6,
        "billing": "TMMT tokens via src/lib/token-ledger.ts",
        "compliance_locked_prompt": true
      },
      {"name": "ops-ai", "provider": "openai", "file": "src/lib/ops-ai.ts", "status": "unknown"}
    ],
    "rag": false,
    "embeddings": false,
    "vector_search": false,
    "tool_calling": false,
    "streaming": false,
    "conversation_storage": ["agent_conversations", "agent_messages"]
  },
  "routes": {
    "pages": 110,
    "layouts": 16,
    "api_routes": 28,
    "build_entries": 140,
    "route_groups": ["(admin)", "(auth)", "(command)", "(executive)", "(investor)", "(learn)", "(operator)", "(partner)", "(pocket)", "(program)", "(vendor)"],
    "public_forms": 18,
    "dynamic_segments": ["/lp/[org]/[sku]", "/forms/[slug]", "/pocket/academy/[slug]", "/operator/training/[moduleId]", "/command/credit-dispute/[id]", "/dispatch/incident/[id]", "/api/agent/stripe/webhook/[slug]", "/api/agent/cal/webhook/[slug]"]
  },
  "apis": [
    {"path": "/api/health", "auth": "none", "kind": "monitor"},
    {"path": "/api/agent/health", "auth": "none", "kind": "monitor"},
    {"path": "/api/agent/sms/inbound", "auth": "hmac-timingsafe", "kind": "webhook", "provider": "twilio"},
    {"path": "/api/agent/voice/ghl", "auth": "secret", "kind": "webhook", "provider": "ghl"},
    {"path": "/api/agent/stripe/webhook/[slug]", "auth": "signature", "kind": "webhook", "provider": "stripe"},
    {"path": "/api/agent/cal/webhook/[slug]", "auth": "hmac-timingsafe", "kind": "webhook", "provider": "cal"},
    {"path": "/api/audit/events", "auth": "x-audit-key-timingsafe", "kind": "ingest"},
    {"path": "/api/auth/callback", "auth": "session", "kind": "auth"},
    {"path": "/api/cron/journey-recompute", "auth": "cron-secret", "kind": "cron"},
    {"path": "/api/cron/marketing-kpi-ghl", "auth": "cron-secret", "kind": "cron"},
    {"path": "/api/cube/application", "auth": "token-or-session", "kind": "data"},
    {"path": "/api/forms/submit", "auth": "none", "kind": "public-write", "protections": ["cors-allowlist", "rate-limit"]},
    {"path": "/api/leads/webhook", "auth": "none", "kind": "public-write", "protections": ["cors-allowlist", "rate-limit", "org-slug", "license-guard"]},
    {"path": "/api/license/provision", "auth": "one-time-install-token", "kind": "fleet"},
    {"path": "/api/license/heartbeat", "auth": "hardware-uuid-equality", "kind": "fleet", "concern": "bearer identifier, not a secret"},
    {"path": "/api/license/revoke", "auth": "admin-key-timingsafe", "kind": "fleet"},
    {"path": "/api/mission/generate", "auth": "cron-secret", "kind": "notify"},
    {"path": "/api/offline/merge", "auth": "session", "kind": "sync"},
    {"path": "/api/ops/command", "auth": "ops-secret-timingsafe", "kind": "admin"},
    {"path": "/api/pocket/chat", "auth": "session+token-metering+rate-limit", "kind": "ai"},
    {"path": "/api/webhooks/ghl", "auth": "signature+idempotency", "kind": "webhook"},
    {"path": "/api/webhooks/ghl/contact", "auth": "signature+idempotency", "kind": "webhook"},
    {"path": "/api/webhooks/ghl/form", "auth": "signature+idempotency", "kind": "webhook"},
    {"path": "/api/webhooks/ghl/appointment", "auth": "signature+idempotency", "kind": "webhook"},
    {"path": "/api/webhooks/ghl/program", "auth": "secret", "kind": "webhook"},
    {"path": "/api/webhooks/ghl/overdue", "auth": "secret", "kind": "webhook"},
    {"path": "/api/webhooks/airtable", "auth": "secret", "kind": "webhook"},
    {"path": "/api/webhooks/airtable/locations", "auth": "secret", "kind": "webhook"}
  ],
  "env_names": {
    "note": "NAMES ONLY - no values were read from any .env file or reproduced anywhere",
    "public": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_AIXMOS_SITE_URL", "NEXT_PUBLIC_AIXMOS_LEARN_BASE_URL", "NEXT_PUBLIC_OWNER_HUB_HOST", "NEXT_PUBLIC_SUPPORT_EMAIL", "NEXT_PUBLIC_SUPPORT_PHONE", "NEXT_PUBLIC_AFFILIATE_APPLY_URL", "NEXT_PUBLIC_CLICKUP_WORKSPACE_URL", "NEXT_PUBLIC_CUBE_SAME_ORIGIN", "NEXT_PUBLIC_CUBE_WORK_URL", "NEXT_PUBLIC_CUBE_LEARN_URL", "NEXT_PUBLIC_CUBE_COMMAND_URL", "NEXT_PUBLIC_CUBE_FLEET_URL", "NEXT_PUBLIC_CUBE_DEMO_CONTROLS", "NEXT_PUBLIC_CUBE_PERSISTENCE", "NEXT_PUBLIC_ENGINE_URL", "NEXT_PUBLIC_WORKFORCE_URL", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "NEXT_PUBLIC_MIXPANEL_TOKEN", "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_ANALYTICS_ID", "NEXT_PUBLIC_GHL_CHECKOUT_97", "NEXT_PUBLIC_GHL_CHECKOUT_3750", "NEXT_PUBLIC_GHL_CHECKOUT_7500", "NEXT_PUBLIC_GHL_CHECKOUT_15000", "NEXT_PUBLIC_GHL_CHECKOUT_25000", "NEXT_PUBLIC_GHL_CHECKOUT_LLC", "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT", "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT_USB", "NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY", "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT", "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT_USB", "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_MONTHLY", "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE", "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY", "NEXT_PUBLIC_GHL_CONSULT_CALL", "NEXT_PUBLIC_GHL_CREDIT_GUIDANCE", "NEXT_PUBLIC_GHL_OPERATOR_APPLY", "NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL", "NEXT_PUBLIC_GHL_FORM_EMBED"],
    "database": ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "COMMAND_CENTER_SUPABASE_URL", "COMMAND_CENTER_SUPABASE_SERVICE_KEY", "SUPABASE_DB_URL", "SUPABASE_ACCESS_TOKEN", "DATABASE_URL"],
    "auth_secrets": ["ADMIN_KEY", "AUDIT_INGEST_KEY", "CRON_SECRET", "OPS_COMMAND_SECRET", "SYNC_WEBHOOK_SECRET", "GHL_WEBHOOK_SECRET", "GHL_VOICE_WEBHOOK_SECRET", "GHL_OVERDUE_WEBHOOK_SECRET", "AIXMOS_AGENT_TOKEN", "VAPID_PRIVATE_KEY"],
    "ai": ["ANTHROPIC_API_KEY", "ANTHROPIC_OPS_MODEL", "OPENAI_API_KEY", "POCKET_BRAIN_URL", "POCKET_BRAIN_KEY", "POCKET_BRAIN_MODEL", "POCKET_BRAIN_TIMEOUT_MS", "POCKET_BRAIN_MAX_TOKENS", "POCKET_COST_PER_JOB", "POCKET_CLOUD_EQUIV_USD", "POCKET_REFERRAL_RATE", "MEMBER_97_MONTHLY_TOKENS", "NVIDIA_API_KEY", "NVIDIA_NIM_BASE_URL", "NVIDIA_NIM_MODEL", "OLLAMA_URL", "OLLAMA_CREDIT_MODEL"],
    "vercel": ["VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_GIT_COMMIT_REF", "VERCEL_GIT_COMMIT_SHA", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "VERCEL_PROJECT_PRODUCTION_URL"],
    "integrations": ["GHL_API_KEY", "GHL_LOCATION_ID", "GHL_RESTORATION_LOCATION_ID", "GHL_EMAIL_FROM", "GHL_CONVERSATION_PROVIDER_ID", "GHL_DEFAULT_ASSIGNEE_EMAIL", "GHL_AUTO_OPS", "GHL_CLIENT_ALERTS", "GHL_FORM_AUTO_CASE", "GHL_CASE_STATUS_MAP_JSON", "GHL_PIPELINE_STAGE_MAP_JSON", "GHL_STAGE_OPS_JSON", "GHL_CF_CASE_REF_KEY", "GHL_CF_LOGIN_URL_KEY", "GHL_CF_PORTAL_URL_KEY", "GHL_CF_TRACK_URL_KEY", "GHL_KPI_STRATEGY_APPOINTMENT_PATTERNS", "GHL_KPI_SUBSCRIBER_TAG_PATTERNS", "AIRTABLE_PAT", "AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_BASE_NAME", "AIRTABLE_LEADS_TABLE", "AIRTABLE_PEOPLE_TABLE", "AIRTABLE_OPS_LOCATIONS_TABLE", "CLICKUP_API_TOKEN", "CLICKUP_TEAM_ID", "CLICKUP_DEFAULT_LIST_ID", "CLICKUP_LIST_FLEET", "CLICKUP_LIST_OPS", "CLICKUP_LIST_OPS_GENERAL", "CLICKUP_LIST_REPO", "CLICKUP_LIST_TICKETS", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_OWNER_CHAT_ID", "IMESSAGE_RELAY_URL", "IMESSAGE_RELAY_TOKEN", "IMESSAGE_NOTIFY_TO", "SLACK_WEBHOOK_URL", "PARTNER_APP_URL", "AIXMOS_AGENT_HOST", "TMMT_OPS_DEFAULT_ASSIGNEE", "MISSION_GREETING_NAME", "MONEY_METER_FREE_FOREVER_EMAILS", "B3_KILL_SWITCH", "CREDIT_ENGINE_SECRET", "CREDIT_ENGINE_INFERENCE", "CREDIT_ENGINE_AUTO_POLISH"],
    "test": ["E2E_TMMT_EMAIL", "E2E_TMMT_PASSWORD", "E2E_PILOT_EMAIL", "E2E_PILOT_PASSWORD", "PARTNER_TEST_EMAIL", "PARTNER_TEST_PASSWORD", "MICHAEL_VENDOR_EMAIL", "MICHAEL_VENDOR_PASSWORD", "AUDIT_BASE_URL", "AUDIT_EMAIL", "AUDIT_PASSWORD", "AUDIT_INGEST_KEY", "SMOKE_BASE_URL", "PW_REUSE_WEB_SERVER"],
    "used_in_src_but_undocumented": ["AIRTABLE_LEADS_TABLE", "AIRTABLE_OPS_LOCATIONS_TABLE", "ANTHROPIC_OPS_MODEL", "CLICKUP_DEFAULT_LIST_ID", "CRON_SECRET", "GHL_CF_CASE_REF_KEY", "GHL_CF_LOGIN_URL_KEY", "GHL_CF_PORTAL_URL_KEY", "GHL_CF_TRACK_URL_KEY", "GHL_CONVERSATION_PROVIDER_ID", "GHL_DEFAULT_ASSIGNEE_EMAIL", "GHL_EMAIL_FROM", "GHL_KPI_STRATEGY_APPOINTMENT_PATTERNS", "GHL_KPI_SUBSCRIBER_TAG_PATTERNS", "GHL_LOCATION_ID", "GHL_RESTORATION_LOCATION_ID", "MEMBER_97_MONTHLY_TOKENS", "MISSION_GREETING_NAME", "NEXT_PUBLIC_AFFILIATE_APPLY_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_CUBE_DEMO_CONTROLS", "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_MONTHLY", "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY", "NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY", "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SITE_URL", "PARTNER_APP_URL", "POCKET_BRAIN_MAX_TOKENS", "POCKET_BRAIN_MODEL", "POCKET_BRAIN_TIMEOUT_MS", "POCKET_BRAIN_URL", "POCKET_COST_PER_JOB", "POCKET_REFERRAL_RATE", "SUPABASE_URL", "TMMT_OPS_DEFAULT_ASSIGNEE"],
    "documented_but_unused_in_src": ["AIRTABLE_BASE_NAME", "AIRTABLE_PEOPLE_TABLE", "CREDIT_ENGINE_AUTO_POLISH", "CREDIT_ENGINE_INFERENCE", "CREDIT_ENGINE_SECRET", "E2E_PILOT_EMAIL", "E2E_PILOT_PASSWORD", "E2E_TMMT_EMAIL", "E2E_TMMT_PASSWORD", "NEXT_PUBLIC_CUBE_PERSISTENCE", "NEXT_PUBLIC_ENGINE_URL", "NEXT_PUBLIC_GHL_FORM_EMBED", "NEXT_PUBLIC_WORKFORCE_URL", "NVIDIA_API_KEY", "NVIDIA_NIM_BASE_URL", "NVIDIA_NIM_MODEL", "OLLAMA_CREDIT_MODEL", "OLLAMA_URL"],
    "env_files_present": [
      {"file": ".env", "vars": 25, "mode": "600"},
      {"file": ".env.local", "vars": 58, "mode": "600"},
      {"file": ".env.prod", "vars": 51, "mode": "600"},
      {"file": ".env.production.local", "vars": 25, "mode": "600"},
      {"file": ".env.vercel-prod", "vars": 52, "mode": "644"},
      {"file": ".env.vercel-pull", "vars": 7, "mode": "600"},
      {"file": ".env.vercel-pulled", "vars": 21, "mode": "644"}
    ],
    "env_files_tracked_in_git": [".env.example", ".env.legacy.example"]
  },
  "tests": {
    "unit_framework": "vitest",
    "unit_files": 58,
    "unit_tests": 483,
    "unit_result": "pass",
    "unit_duration_s": 1.10,
    "dom_testing": "@testing-library/react + jsdom",
    "e2e_framework": "playwright",
    "e2e_specs": ["e2e/smoke.spec.ts", "e2e/dispatch-rls.spec.ts", "e2e/net-only-refactor.spec.ts", "e2e/audit.spec.ts"],
    "e2e_result": "not_run",
    "e2e_reason": "requires dev server + real credentials",
    "audit_crawl_routes": 106,
    "typecheck": "pass",
    "lint": {"errors": 0, "warnings": 40},
    "build": "pass",
    "coverage_percent": null,
    "untested_critical": ["src/middleware.ts", "all 28 API route handlers", "src/app/forms/actions.ts", "src/app/workflow-actions.ts", "src/app/(command)/dispatch/actions.ts", "RLS policies"]
  },
  "integrations": ["supabase", "vercel", "gohighlevel", "airtable", "clickup", "twilio", "stripe", "anthropic", "openai", "self-hosted-llm", "sentry", "mixpanel", "telegram", "imessage-relay", "slack", "openstreetmap", "cal"],
  "critical_files": [
    "src/middleware.ts",
    "src/lib/auth-roles.ts",
    "src/lib/supabase-service.ts",
    "src/lib/supabase-server.ts",
    "src/lib/site-domains.ts",
    "src/lib/platform/tenant-resolve.ts",
    "src/lib/platform/tenant-org.ts",
    "src/lib/rate-limit.ts",
    "src/lib/agent/llm-router.ts",
    "src/lib/pocket-brain.ts",
    "src/app/forms/actions.ts",
    "src/lib/queries.ts",
    "src/app/api/leads/webhook/route.ts",
    "src/app/api/license/heartbeat/route.ts",
    "src/app/api/license/provision/route.ts",
    "next.config.ts",
    "vercel.json",
    "scripts/verify.sh",
    "scripts/vercel-ignore.sh",
    "scripts/sync-machine.sh",
    ".github/workflows/verify.yml",
    ".github/workflows/session-autopilot.yml"
  ],
  "findings": [
    {"id": "F-01", "priority": "P0", "category": "security", "confidence": "CONFIRMED", "summary": ".env.vercel-prod (52 vars) and .env.vercel-pulled (21 vars) are mode 644 — world-readable production secrets including the Supabase service-role key"},
    {"id": "F-02", "priority": "P1", "category": "security", "confidence": "CONFIRMED", "summary": "/api/license/heartbeat authenticates by string equality on a client-supplied hardware_uuid; enrolled enclave_pubkey_pem is never verified"},
    {"id": "F-03", "priority": "P1", "category": "data-loss", "confidence": "CONFIRMED", "summary": "5 untracked migrations + an untracked test file that the green suite executes, with a migration rename mid-flight and daemons running against the tree"},
    {"id": "F-04", "priority": "P1", "category": "orchestration", "confidence": "CONFIRMED", "summary": "Three unsupervised processes (hailmary-daemon, mesh/memory-sync, a prior session's polling loop) are live against this working copy"},
    {"id": "F-05", "priority": "P2", "category": "security", "confidence": "CONFIRMED", "summary": "In-memory rate limiter guards the public revenue funnel and login; per-instance and reset on cold start on Vercel"},
    {"id": "F-06", "priority": "P2", "category": "security", "confidence": "CONFIRMED", "summary": "session_token returned by /api/license/provision is never verified anywhere in the codebase"},
    {"id": "F-07", "priority": "P2", "category": "authorization", "confidence": "CONFIRMED", "summary": "47 service-role call sites bypass RLS, including two Pocket page components reachable by every signed-in tier"},
    {"id": "F-08", "priority": "P2", "category": "test-coverage", "confidence": "CONFIRMED", "summary": "middleware.ts, all 28 API routes and the three largest server-action files have no automated tests"},
    {"id": "F-09", "priority": "P3", "category": "correctness", "confidence": "CONFIRMED", "summary": "/api/audit/events JSON.parse is unguarded — one malformed NDJSON line 500s the batch"},
    {"id": "F-10", "priority": "P3", "category": "configuration", "confidence": "CONFIRMED", "summary": "36 env vars used in src are absent from .env.example; a missing CRON_SECRET silently 401s both cron routes forever"},
    {"id": "F-11", "priority": "P3", "category": "forward-compat", "confidence": "CONFIRMED", "summary": "Next 16 deprecates the middleware convention in favour of proxy; this file is the whole authorization layer"},
    {"id": "F-12", "priority": "P3", "category": "environment", "confidence": "CONFIRMED", "summary": "Node version differs three ways: local 26.5.0, declared >=24 <25, CI 24"},
    {"id": "F-13", "priority": "P4", "category": "architecture", "confidence": "CONFIRMED", "summary": "No task queue, no work lease, and node identity is an unauthenticated plain-text file; mesh.tsv absent"},
    {"id": "F-14", "priority": "P4", "category": "hygiene", "confidence": "CONFIRMED", "summary": "327 local branches, 257MB .git, three Next apps with three lockfiles and no workspace tool, tracked dist/"},
    {"id": "F-15", "priority": "P4", "category": "ai-config", "confidence": "CONCERN", "summary": "Anthropic model IDs and per-token prices are hardcoded and unverified; stale values fail inside a Twilio webhook or silently corrupt cost accounting"},
    {"id": "F-16", "priority": "P5", "category": "code-quality", "confidence": "CONFIRMED", "summary": "40 lint warnings: 34 setState-in-effect, 5 unused vars, 1 stale disable directive"}
  ],
  "unknowns": [
    "Where the Stripe SDK obtains its secret key; whether the Stripe rail is live alongside GHL checkout",
    "Location of the Supabase realtime subscriber referenced by /api/leads/webhook",
    "Whether Vercel preview deployments are enabled for claude/* branches; Deployment Protection state",
    "Which of the 45 migrations are actually applied to production",
    "Whether the 137 RLS policies are enabled and correct on the live database",
    "Whether apps/engine and aria are live products, experiments, or references",
    "What the 4 _parked and 5 _staged migrations are waiting on",
    "Whether src/lib/ops-ai.ts (OpenAI) is a live path",
    "Semantics of B3_KILL_SWITCH",
    "Whether master branch protection (require verify + pii-scan, allow auto-merge) was configured",
    "Whether the 6 unpushed local commits are intended for master",
    "Whether the PII_DENYLIST repo secret is set",
    "WSL2/Node/bash availability on MUSCLE and BRAINIAC",
    "How long .env.vercel-prod has been mode 644 and whether anything has read it"
  ]
}
```

---

*End of dossier. No application file was created, modified, or deleted during this reconnaissance. This document is the only file written.*
