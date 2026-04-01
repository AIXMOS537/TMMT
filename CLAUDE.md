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

## Docs

- `docs/ROADMAP.md` — tiered project roadmap with owner assignments and completion status
- `docs/ARCHITECTURE.md` — tech stack, directory structure, auth flow diagrams
- `docs/DATABASE-SCHEMA.md` — all 44 tables with field specs
- `docs/PIPELINE-FLOW.md` — customer and vehicle lifecycle state machines
- `docs/STATUS.md` — feature status, known issues, codebase stats
- `docs/SENTRY-SETUP.md` — Sentry activation guide (account setup, DSN, alert config)
- `docs/superpowers/specs/` — design specs (supabase-auth, airtable-sync, maintenance-toggle)
- `docs/superpowers/plans/` — implementation plans (supabase-auth, airtable-sync, tier2-hardening)
- `supabase/migrations/` — RLS migration (`20260331_enable_rls.sql`)
