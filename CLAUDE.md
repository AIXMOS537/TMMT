# TMMT Rentals — Claude Code Context

## Project

TMMT Rentals is a **production-grade vehicle rental management system** built with Next.js 16 App Router, TypeScript, Tailwind CSS 4, and Supabase. It replaced an Airtable-based workflow. The goal is a fully production-ready admin platform.

**Repo:** https://github.com/Metavibez4L/TMMT

## Engineering Philosophy

- **Agentic workflows first** — use `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` for all non-trivial work
- **Production quality, not prototype quality** — every feature ships with proper error handling, TypeScript correctness, and accessibility
- **YAGNI + DRY** — build exactly what's needed, no speculative abstractions
- **TDD where testable** — Playwright installed for E2E; build verification (`npm run build`) is the primary gate
- **Frequent commits** — one logical unit per commit, descriptive messages

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) | |
| Language | TypeScript 5 (strict mode) | |
| Styling | Tailwind CSS 4 | Class-based dark mode via `html.dark`; no tailwind.config.js — all config in `globals.css` |
| Database | Supabase PostgreSQL | 44 tables, 1,453 migrated records |
| Auth | Supabase Auth + `@supabase/ssr` v0.9.0, `supabase-js` v2.97.0 | Email + password, middleware-protected |
| Icons | lucide-react | |
| Monitoring | @sentry/nextjs | Inactive until `NEXT_PUBLIC_SENTRY_DSN` set |
| Testing | @playwright/test (dev) | E2E smoke tests in `e2e/` |
| Validation | zod | Server action input validation |
| Utilities | date-fns, clsx, tailwind-merge | |

## Current Architecture

```
middleware.ts                  — auth gate (getUser) + rate limiter for /forms POST
src/app/
  layout.tsx                   — sets metadata, injects blocking theme script (dark mode init), suppressHydrationWarning required
  (admin)/                     — protected, requires auth
    layout.tsx                 — renders Sidebar
    actions.ts                 — signOut server action
    admin-actions.ts           — adminUpsert() auth-gated write (table allowlist)
    page.tsx                   — dashboard (StatCard metrics, getDashboardData)
    [17 admin pages]
  (auth)/
    layout.tsx                 — centered, no sidebar
    login/page.tsx + actions.ts
  forms/
    actions.ts                 — 8 zod-validated server actions for public forms
    [8 public form pages]      — no auth required
src/lib/
  supabase.ts                  — browser anon client (singleton, read-only usage via queries.ts)
  supabase-server.ts           — createSSRClient (async), createMiddlewareClient
  rate-limit.ts                — in-memory rate limiter (5 req/hr per IP)
  queries.ts                   — read fetchers only (writes go through server actions, not here)
  utils.ts                     — cn(), formatCurrency(), formatDate(), formatDateTime(), statusColor()
src/components/
  Sidebar.tsx                  — nav + logout button ("use client")
  ThemeToggle.tsx
  ui.tsx                       — full UI component library
```

## Critical Patterns

### Supabase SSR (Next.js 15+)
- `cookies()` from `next/headers` returns a **Promise** — always `await` it
- Use `createSSRClient()` in server actions (from `@/lib/supabase-server`)
- Use `createMiddlewareClient(req, res)` in middleware
- **Never** use `getSession()` for auth decisions — use `getUser()` (verified)
- `supabase.ts` is imported by `"use client"` components — never add `next/headers` imports there

### Route Groups
- `(admin)/` — all protected admin pages, gets Sidebar via layout
- `(auth)/` — login page, minimal layout, no Sidebar
- `forms/` — public, outside both route groups

### Server Actions
- Must have `"use server"` directive
- Import `createSSRClient` from `@/lib/supabase-server`, not `@/lib/supabase`
- `createSSRClient` is async — always `await createSSRClient()`
- Public form writes: `src/app/forms/actions.ts` (zod-validated, anon insert)
- Admin writes: `src/app/(admin)/admin-actions.ts` (auth-gated upsert with table allowlist)
- Do NOT add writes to `queries.ts` — that file is read-only fetchers

## Dispatch Core (Subproject #1 of Rescue Dispatch SaaS) — SHIPPED

Plan: `docs/superpowers/plans/2026-05-27-rescue-dispatch-core.md`
Spec: `docs/superpowers/specs/2026-05-27-rescue-dispatch-core-design.md`
Migration: `supabase/migrations/20260530120000_rescue_dispatch_core.sql`
Routes: `/dispatch/*` under `(command)` (owner-only on .net)
Tenancy: per-tenant via `org_roles` + new `is_org_dispatcher(org_id)` helper. `is_staff()` bypass preserved.
Agents: CAPTAIN refinement via `captain_dispatch` prompt (JSON output) in `~/AIXMOS-AGENTS/agents/prompts.js`. Fail-open at 1.5s.

## Memory Fabric (org-wide shared memory) — Phase 0–2 SHIPPED

Spec: `docs/superpowers/specs/2026-06-16-memory-fabric-design.md`
Plan: `docs/superpowers/plans/2026-06-16-memory-fabric.md`
Migration: `supabase/migrations/20260616000000_memory_fabric.sql` (pgvector + `memory_entities`, `memory_events`, `memory_facts`; RLS via `is_staff()`/`is_owner()`; backfill from `activity_logs`).

A single store that captures **every actor** — AI agents, operators, team, owners, and outside parties — and lets any agent recall it. `memory_events` uses a polymorphic actor (`ai_agent|operator|team|owner|external|system`), unlike the narrow `activity_logs`.

- **Capture:** `logMemoryEvent()` / `logMemoryEventForUser()` in `src/lib/memory.ts` (service-role, never blocks the primary write). Wired into `admin-actions.ts` (upserts) and `forms/actions.ts` (public submissions, actor = external).
- **Recall:** `recallMemory()` in `src/lib/memory.ts`; HTTP entry `POST /api/memory` (Bearer `MEMORY_API_TOKEN`), ops `remember` / `recall`. Optional MCP bridge: `scripts/memory-mcp-server.mjs`.
- **Discipline for agents:** `recall()` relevant context BEFORE acting; `remember()` what you did AFTER. This is what makes memory persist across sessions.
- **Vendor-neutral:** the `remember/recall` interface is stable; ranking is recency+keyword now, pgvector semantic in Phase 4 — callers don't change.
- **Airtable is a permanent, first-class source** (its in-table agent automations) — NOT to be retired. This supersedes the "Airtable replaced" framing below.
- New env: `MEMORY_API_TOKEN` (gates `/api/memory`).

## Quo Support → Brain → Dispatch (Phase 3a/3b) — SHIPPED

Spec: `docs/superpowers/specs/2026-06-16-quo-support-dispatch-design.md`
Migration: `supabase/migrations/20260616100000_quo_support_dispatch.sql` (`customer_services` opt-in model + `cases.agent_draft`).

Quo is the **sole backend customer-support channel** — one number clients call/text for urgent help with the service they opted into at setup.

- **Inbound:** `POST /api/webhooks/quo` (header `x-quo-webhook-secret` = `QUO_WEBHOOK_SECRET`, fail-closed). Handles OpenPhone `message.received` / `call.completed`.
- **Ingestor:** `src/lib/quo/inbound.ts` — `parseQuoWebhook()` + `ingestQuoInbound()`: resolve caller `memory_entity` by `external_refs->>primary_phone`, **gate by `customer_services` (opted-in)**, `logMemoryEvent(source=quo, actor=external)`, classify via `detectWorkFromEvent()`, create a support `cases` row. Idempotent via `dedupe_key` (`quo:msg:<id>`/`quo:call:<id>`). Service-role; never throws to the webhook.
- **Routing (Phase 3d) — SHIPPED** via a new full-pool layer (NOT `executeRouting`, which needs the absent `ops_locations`/`dispatch_loads`). Migration `20260616200000_work_routing.sql`: `verticals`, `routing_candidates` (unified pool: employee|agent|vendor|unit, capability_tags + vertical_slugs + load), `work_assignments`, `cases.required_capabilities`; SQL `rank_work_candidates(case)` + `assign_work(...)`; seeded from `vendors`/`profiles`/`units`. `routeWork(caseId)` in `src/lib/routing/assign.ts` ranks + assigns the best candidate and remembers it; wired into `ingestQuoInbound` for covered requests. Deterministic ranking is the fail-open baseline (agent/CAPTAIN can refine later). Verified end-to-end against live DB.
- **Poll fallback + notify (Phase 3e) — SHIPPED:** `/api/cron/quo-poll` (CRON_SECRET; needs `QUO_API_KEY` + optional `QUO_PHONE_NUMBER_ID`) sweeps missed inbound and ingests idempotently; `notifyTelegram()` (`src/lib/notify.ts`) pings the assignee from `routeWork`.
- New env: `QUO_WEBHOOK_SECRET`, `QUO_API_KEY`, `QUO_PHONE_NUMBER_ID`.

## Backend Lock & Installation Licensing — SHIPPED (off by default)

Doc: `docs/SECURITY-LICENSING.md`
Migration: `supabase/migrations/20260616300000_installation_licensing.sql`.

Gate backend access behind the **full $50k installation** (paid + setup + comprehension + active), hardware-bound. `installations` table + `backend_unlocked_for(user)` (SECURITY DEFINER; **owner `role='admin'` always exempt**). Middleware redirects non-owner, non-activated users to `/locked` — **only when `BACKEND_LOCK_ENABLED=true`** (off by default so it can't lock the running app before licenses are seeded).

True source secrecy is a **deployment posture** (ship no source / server-side host / sealed encrypted appliance / hardware-bind), NOT the DB lock — see the doc. Supercomputer ships locked until activation. New env: `BACKEND_LOCK_ENABLED`.

## Communication Channel Topology — SHIPPED

Doc: `docs/CHANNEL-TOPOLOGY.md`
Migration: `supabase/migrations/20260616400000_comm_channels.sql` (`comm_channels` registry + seeded 4 channels).

Each number has one job + a policy: **GHL** = campaigns/ads/leads; **Quo** (+15714508727) = customer support + internal vendor contact; **work cell** (+15713265611, `escalation_only`) = owner's working-hours line bridged to Mac M1 (top-tier assistant); **personal** (+15713519690, `do_not_contact`) = gets nothing.

- Policy lib `src/lib/channels.ts`: `isDoNotContact()` (call before ANY outbound — protects the personal line), `getEscalationChannel()`, `isWithinWorkingHours()`.
- `escalateToOwner()` (`src/lib/escalate.ts`): work-cell escalation, working-hours aware, transport via Tailscale-exposed Mac iMessage bridge (`IMESSAGE_BRIDGE_URL`) else queued in the brain; **never** contacts a `do_not_contact` number. Wired into `routeWork` no-candidate path.
- New env: `IMESSAGE_BRIDGE_URL`, `IMESSAGE_BRIDGE_TOKEN`.

## Production Gaps (ordered by priority)

1. ~~**Row-Level Security (RLS)**~~ — **DONE**: RLS enabled on all 20 tables via `supabase/migrations/20260331_enable_rls.sql`. Public form tables allow anon INSERT; admin tables require authenticated.
2. ~~**Input validation / server actions**~~ — **DONE**: All 8 public forms use zod-validated server actions (`src/app/forms/actions.ts`). All 17 admin pages use auth-gated server action (`src/app/(admin)/admin-actions.ts`).
3. ~~**Error handling**~~ — **DONE**: ErrorBanner replaces all alert() calls. Error boundaries at root and admin level. `.catch()` on all data fetches.
4. ~~**Rate limiting**~~ — **DONE**: In-memory rate limiter (5 req/hr per IP) in middleware for `/forms` POST.
5. ~~**Security headers**~~ — **DONE**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy in `next.config.ts`.
6. ~~**Error monitoring**~~ — **DONE**: Sentry SDK installed and configured. Set `NEXT_PUBLIC_SENTRY_DSN` in `.env` to activate.
7. **Maintenance show/no-show toggle** — spec approved (`docs/superpowers/specs/2026-03-26-maintenance-toggle-design.md`); **not started**
8. **Password reset flow** — no forgot password; admins reset via Supabase dashboard
9. **File uploads** — Airtable had photos/licenses/contracts not yet in Supabase Storage
10. **Email notifications** — no transactional email yet
11. **Reporting / analytics** — no export or aggregate views
12. **Testing infrastructure** — Playwright installed with smoke tests (`e2e/`); no unit test framework yet

## Admin Page Pattern

Every admin page follows the same structure — respect it when adding new pages:

```tsx
"use client"
// 1. useEffect → fetch data → setState (with .catch() for error handling)
// 2. useMemo → filter by search + status
// 3. DataTable with columns config
// 4. onRowClick → Modal → FormField inputs
// 5. handleSave → setSaving(true) → adminUpsert("table_name", record) → setSaving(false) → reload
// 6. ErrorBanner in Modal for inline error display
// 7. Submit button: disabled={saving}, shows "Saving..." while in flight
```

## Commands

```bash
npm run check-env # validate `.env` + Supabase Auth/REST reachability (no secrets printed)
npm run dev      # dev server on http://localhost:3000 (Turbopack — default in Next.js 16, no flag needed)
npm run build    # production build — primary CI gate
npm run start    # serve production build locally
npm run lint     # ESLint
npm run test:e2e # Playwright E2E smoke tests (requires dev server or uses webServer config)

# Airtable → Supabase one-time sync
node scripts/sync-airtable.mjs           # live run
node scripts/sync-airtable.mjs --dry-run # preview only (no writes)
```

## Env

- `.env` at project root (gitignored via `.env*`)
- Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `NEXT_PUBLIC_SENTRY_DSN` — Sentry error monitoring (inactive when empty)
- Optional (sync only): `AIRTABLE_PAT` — required for `scripts/sync-airtable.mjs`
- Personal Claude overrides: use `.claude.local.md` (gitignored) — not shared with team

### Vercel (deployment)

Three separate apps on Vercel team `aixmos537` — see `docs/THREE-APP-ECOSYSTEM.md` for the canonical topology and `docs/DEPLOY.md` for env-var / DNS routine:

- `tmmt-ops` → TMMT Ops (TMMT OS proper) at https://tmmt-ops.vercel.app
- `tmmt-command-center` → owner + leadership portfolio hub at https://tmmt-command-center.vercel.app
- `aixmos-landing` → AIXMOS public funnel at https://aixmos-landing.vercel.app

Legacy `tmmt-c919` and `tmmt` projects are retired (`tmmt-c919.vercel.app` returns HTTP 404 as of 2026-06-08). Run `scripts/retire-vercel-duplicates.sh --apply` to delete the empty project shells from the Vercel team once env-var + domain pre-flight in `docs/THREE-APP-ECOSYSTEM.md` is signed off. Local `.vercel/project.json` should point at `tmmt-ops` (`prj_g80HsnBcQ34tukCFCGPxcP5cmQF1`) — not the old `tmmt-c919` ID.

## Docs

- `docs/ROADMAP.md` — tiered project roadmap with owner assignments and completion status
- `docs/ARCHITECTURE.md` — tech stack, directory structure, auth flow diagrams
- `docs/DATABASE-SCHEMA.md` — all 44 tables with field specs
- `docs/PIPELINE-FLOW.md` — customer and vehicle lifecycle state machines
- `docs/STATUS.md` — feature status, known issues, codebase stats
- `docs/SENTRY-SETUP.md` — Sentry activation guide (account setup, DSN, alert config)
- `docs/PARTNER-PORTAL.md` — investor read-only portal: RLS migration, `app_metadata.role`, `partner_fleet_access`
- `docs/superpowers/specs/` — design specs (supabase-auth, airtable-sync, maintenance-toggle)
- `docs/superpowers/plans/` — implementation plans (supabase-auth, airtable-sync, tier2-hardening)
- `supabase/migrations/` — RLS migration (`20260331_enable_rls.sql`)
