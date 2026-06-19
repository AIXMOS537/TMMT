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
| Testing | vitest + @playwright/test (dev) | Vitest unit tests (`src/lib/**/*.test.ts`); Playwright E2E smoke tests in `e2e/` |
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

## Production Gaps (ordered by priority)

1. ~~**Row-Level Security (RLS)**~~ — **DONE**: RLS enabled on all 20 tables via `supabase/migrations/20260331_enable_rls.sql`. Public form tables allow anon INSERT; admin tables require authenticated.
2. ~~**Input validation / server actions**~~ — **DONE**: All 8 public forms use zod-validated server actions (`src/app/forms/actions.ts`). All 17 admin pages use auth-gated server action (`src/app/(admin)/admin-actions.ts`).
3. ~~**Error handling**~~ — **DONE**: ErrorBanner replaces all alert() calls. Error boundaries at root and admin level. `.catch()` on all data fetches.
4. ~~**Rate limiting**~~ — **DONE**: In-memory rate limiter (5 req/hr per IP) in middleware for `/forms` POST.
5. ~~**Security headers**~~ — **DONE**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy in `next.config.ts`.
6. ~~**Error monitoring**~~ — **DONE**: Sentry SDK installed and configured. Set `NEXT_PUBLIC_SENTRY_DSN` in `.env` to activate.
7. ~~**Maintenance show/no-show toggle**~~ — **DONE**: inline `StatusPill` in the maintenance table (`src/components/ui.tsx`) saves status immediately via auth-gated `adminUpsert()`; No-Show/Late auto-set `NO_SHOW_FEE`. Reconciled the approved spec (`docs/superpowers/specs/2026-03-26-maintenance-toggle-design.md`) with current hardening (server action + ErrorBanner, not direct client write + alert()).
8. ~~**Password reset flow**~~ — **DONE**: self-service via Supabase Auth (PKCE). `/login/forgot` → `/api/auth/callback` (code exchange) → `/login/reset`. Enumeration-safe, relative-redirect guarded. "Forgot password?" link on login; `/api/auth/` is a public path in middleware.
9. **File uploads** — Airtable had photos/licenses/contracts not yet in Supabase Storage
10. **Email notifications** — no transactional email yet
11. **Reporting / analytics** — **PARTIAL**: CSV export on all 19 admin DataTable pages (`ExportButton` + `src/lib/csv.ts`, exports the filtered view). Aggregate/analytics views still TODO.
12. ~~**Testing infrastructure**~~ — **DONE (unit)**: Vitest installed (`vitest.config.ts`, `npm test`) with first suites for utils, csv, auth-roles, and the mission builder (`src/lib/**/*.test.ts`). Playwright E2E smoke tests still in `e2e/`. Component/DOM tests (jsdom) not yet added.

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
npm test         # Vitest unit tests (run once); npm run test:watch for watch mode
npm run test:e2e # Playwright E2E smoke tests (requires dev server or uses webServer config)

# Mesh / multi-machine ops (see docs/MESH-SWARM.md)
bash scripts/setup-mac.command   # fresh-Mac one-shot installer (tools, repo, .env via Vercel, join, audit)
bash scripts/swarm-join.sh       # onboard THIS machine to the mesh (unique name, per-account git id, hooks)
bash scripts/tmmt up|who|help|go|sync|fix|notify   # simple owner verbs
bash scripts/tmmt fix            # = swarm-doctor: readiness + security audit (PASS/WARN/FAIL)
npm run swarm -- up 2            # claim 2 tasks + launch 2 parallel Claude agents (git worktrees)
npm run sync:machine             # safe N-machine sync (stash → rebase → push)

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
- **Secret transport (2026-06-15): Vercel is the source of truth.** Pull `.env`
  on any machine with `vercel env pull .env --environment=production`. The old
  **key flashdrive is deprecated/lost** — `scripts/bootstrap-carry-mac.sh` and
  `CONTINUE-ON-CARRY-MAC.md` describe the retired flow. Note: `npm run build`,
  `test`, `lint`, and the agent swarm all run **without** `.env` (env is read
  lazily at request time) — `.env` is only needed to run the live app.
- **If the flashdrive is unaccounted for: rotate** `SUPABASE_SERVICE_ROLE_KEY`
  (Supabase → API Keys) + `GHL_WEBHOOK_SECRET` (GHL), update Vercel, redeploy,
  re-pull. Runbook in `docs/security/SUPABASE-ADVISORS-2026-06-15.md`.

### Vercel (deployment)

Three separate apps on Vercel team `aixmos537` — see `docs/THREE-APP-ECOSYSTEM.md` for the canonical topology and `docs/DEPLOY.md` for env-var / DNS routine:

- `tmmt-ops` → TMMT Ops (TMMT OS proper) at https://tmmt-ops.vercel.app
- `tmmt-command-center` → owner + leadership portfolio hub at https://tmmt-command-center.vercel.app
- `aixmos-landing` → AIXMOS public funnel at https://aixmos-landing.vercel.app

Legacy `tmmt-c919` and `tmmt` projects are retired (`tmmt-c919.vercel.app` returns HTTP 404 as of 2026-06-08). Run `scripts/retire-vercel-duplicates.sh --apply` to delete the empty project shells from the Vercel team once env-var + domain pre-flight in `docs/THREE-APP-ECOSYSTEM.md` is signed off. Local `.vercel/project.json` should point at `tmmt-ops` (`prj_g80HsnBcQ34tukCFCGPxcP5cmQF1`) — not the old `tmmt-c919` ID.

## Mesh Operations Layer (multi-machine + agent swarm) — SHIPPED 2026-06-15

A git-coordinated layer so the owner runs the business from any machine (carry
Mac, work Mac, a Surface — each on its own account) and a swarm of Claude agents
works in parallel. **Git is the only coordination layer** (no server). Full guide:
`docs/MESH-SWARM.md`.

- **Swarm:** `scripts/swarm.sh` — shared task board on a remote-only `swarm-coord`
  branch with **atomic claims**; each task runs in its own **git worktree** on
  `swarm/<machine>/<id>`; agents launch in tmux (mac/linux/wsl) or a Windows
  Terminal tab (Surface). `scripts/lib/swarm-common.sh` holds shared helpers.
- **Sync:** `scripts/sync-machine.sh` (npm `sync:machine`) — stash → rebase →
  push; never force-push, never merge; fails clean on conflict.
- **Mesh presence + remote assist:** `scripts/mesh/presence.sh` (heartbeat + live
  roster) and `scripts/mesh/link.sh` (operator `serve`/`request`, owner
  `who`/`assist` over **Tailscale SSH**, SOS via Slack/Telegram `.env.notify`).
- **Onboarding/security:** `scripts/swarm-join.sh` (idempotent per-device onboard,
  per-account git identity), `scripts/swarm-doctor.sh` (readiness+security audit),
  `scripts/hooks/{pre-commit,pre-push}` (secret guard via `core.hooksPath`,
  installed by swarm-join — blocks `.env`/keys/service-role/GHL/Stripe/etc.),
  `scripts/setup-mac.command` (fresh-Mac one-shot installer).
- **Simple UX:** `scripts/tmmt` (one-word verbs), `TMMT-MENU.command` (double-click
  → press a number), `docs/cheatsheets/*` (picture PDF + phone wallpaper +
  new-Mac card, regenerate with `scripts/make-cheatsheet.py`).
- **Machine identity:** `.swarm/machine` (gitignored); each machine MUST have a
  unique name. Branches `swarm/<machine>/*` prevent cross-machine collision.
- **Auth resilience:** `middleware.ts` **fails closed** — if Supabase is
  unreachable/misconfigured (e.g. a preview deploy without env), it treats the
  request as signed-out (redirect to /login) instead of a 500. Never fails open.

## Agents: HAILMARY + AIXMOS + Unison — SHIPPED 2026-06-16

The owner-only agent layer. Both agents are **owner-only (PROJECT X HAILMARY),
local-first, never-sold**, share the same guardrails, and the same memory of
record (git + Obsidian vault on BRAINIAC). Charters are the law:

- **HAILMARY** (`docs/HAILMARY-CHARTER.md`) — the Owner's personal "big-play /
  break-glass" agent. **Activation word: `booyah`.** `scripts/hailmary`:
  `booyah` (boot + self-audit + absorb + macOS always-on), `absorb` (touch &
  absorb git/docs/mesh context into `.hailmary/memory/` snapshots — owner-local,
  **secret values skipped AND scrubbed** by regex at capture), `hit [n]` (launch
  swarm), `status`, `standby`. `.hailmary/` is gitignored.
- **AIXMOS** (`docs/AIXMOS-CHARTER.md`) — the operations/network brain that runs
  the swarm + TMMT operatives. Peer to HAILMARY: AIXMOS runs the network,
  HAILMARY serves the Owner.
- **Memory loop** (Phase 3, `scripts/mesh/memory-sync.sh`) — **push-only**
  (M1 → vault) rsync of memory snapshots into BRAINIAC's Obsidian vault over
  Tailscale. Set `HAILMARY_VAULT` (Tailscale SSH `host:path`, off git); `install`
  lays a macOS LaunchAgent (`com.tmmt.memory-sync`).
- **Unison** (`scripts/mesh/unison.sh`) — the single switch that boots the whole
  home base as one: HAILMARY `booyah` → memory loop → always-on presence.
  Launcher verbs: **`bash scripts/tmmt unison|booyah|memory`**.
- **Owner taps remaining:** run `bash scripts/hailmary booyah` (or `tmmt unison`)
  **on the M1**; set `HAILMARY_VAULT`; share BRAINIAC into the assistant's
  tailnet (least-privilege). See `docs/AIXMOS-MESH-BLUEPRINT.md` Phases 2–5.

## One-word command system — SHIPPED 2026-06-16

Front door: `START-HERE.md`. Every word routes through `scripts/tmmt`; `scripts/go`
installs role-aware aliases into `.zshrc`/`.bashrc` so each is a bare word.

- **`booyah`** = THE start word → full base boot (`scripts/mesh/unison.sh up`).
  `wake` = HAILMARY only. `menu` = colorful board (`scripts/menu`, role-aware).
- **Watch (Cyborg):** `watchtower` (`scripts/watchtower` — League roster + live
  vertical health), `health` (`scripts/health.sh` — pings `watch/targets.tsv`;
  401/403 = UP🔒, 000/5xx = DOWN), `whoami` (`scripts/whoami-tmmt`).
- **Clients:** `onboard` (`scripts/aixmos onboard`), `aixmos` (cast).
- **You first:** `compass` (`scripts/compass` — protect-first, toward God; exempt
  from DARK). **Protect/kill:** `dark`/`light` (`scripts/godark` — anyone stops,
  only owner seal lifts; `dark hard` = `tailscale down`), `fix`, `seal`.
- **Deploy:** `scripts/deploy [owner|operator]` — role-aware (owner needs the
  Owner Seal `auth/OWNER.seal`; operators fenced). `scripts/install-desktop.sh`
  (Mac icons), `scripts/make-wallpaper.py` + `make-pocket-card.py` (cheatsheets).
- **Roster (the League):** `docs/WATCHTOWER-ROSTER.md` — Boss (PROJECT X HAILMARY, Ops
  + the word), Cyborg (Watchtower = AIXMOS/HAILMARY), Red Hood (Umar, Credit
  Guidance), The Crew (rentals + verticals + operators), Batman (e-commerce).
- **DARK guards** in tmmt/hailmary/aixmos/go/unison; `.hailmary/` + `.swarm/`
  gitignored; `auth/OWNER.seal` is a salted hash (no secret), safe to commit.

## Docs

- `WHAT-YOU-HAVE.md` — whole-stack master map (repo + Slack + Drive + Gmail)
- `docs/MESH-SWARM.md` — the mesh/swarm system: setup, daily flow, security model
- `docs/security/SUPABASE-ADVISORS-2026-06-15.md` — security audit + key-rotation runbook
- `docs/security/GO-GHOST-PROTOCOL.md` — personal privacy / identity-compartmentalization protocol (GHOST = the real you; X = the one public node). Companions: `GHOST-EVERYDAY-DEFAULTS.md` (daily-driver stack), `FOOTPRINT-CLEANUP-TRACKER.md` (working tracker), `X-NODE-DEFINITION.md` (**X = AIXMOS**)
- `docs/FLEET-ROSTER.md` — canonical device map (mesh node + ghost endpoint per machine); brain = M1 `brainiac-mac` (primary) + Windows `brainiac-win` (compute/backup)
- `docs/BRAINIAC-MAC-SETUP.md` — one-page runbook to stand up the M1 as the always-on assistant the carry Mac talks to/texts. One-shots: `scripts/setup-home-brain.command` (M1) + `scripts/setup-home-brain.ps1` (Windows backup) — family-member-runnable, remote access via Tailscale+SSH
- `docs/BRAINIAC-RESILIENCE.md` — make the brain never let you down: UPS/power, tower failover, heartbeat tripwire, encrypted offsite backup (`scripts/mesh/vault-backup.sh`), owner-only `tag:brain` ACL
- `docs/HOMELAND-HQ-AND-OPERATOR-SEATS.md` — owner intent: home HQ → office expansion; per-operator subaccount + one-shot device seats ($97/mo); tier pricing as stated, with a flagged reconciliation vs `OFFER-STACK.md` (monthly vs one-time)
- `docs/ARCHITECT-COCKPIT.md` — the 3D "go virtual" cockpit (`bash scripts/hologram` → `tools/hologram-cockpit/index.html`): orbit/zoom/click-to-dissect the whole empire; WebXR/Vision-Pro + live-data upgrade path; cross-operator learning-brain vision
- `docs/DMV-CLUBHOUSE-OFFICE.md` — the Virginia office buildout: the Ultimate Clubhouse (Traphouse) for TMMT Rentals + DMV operators; systems/network blueprint (same tailnet, fenced seats, office brain node, MRR tie-in)
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
