# TMMT Rentals — Claude Code Context

## Project

TMMT Rentals is a **production-grade vehicle rental management system** built with Next.js 16 App Router, TypeScript, Tailwind CSS 4, and Supabase. It replaced an Airtable-based workflow. The goal is a fully production-ready admin platform.

**Repo:** https://github.com/Metavibez4L/TMMT

## Engineering Philosophy

- **Agentic workflows first** — use `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` for all non-trivial work
- **Production quality, not prototype quality** — every feature ships with proper error handling, TypeScript correctness, and accessibility
- **YAGNI + DRY** — build exactly what's needed, no speculative abstractions
- **TDD where testable** — no test framework is installed yet; build verification (`npm run build`) is the current gate
- **Frequent commits** — one logical unit per commit, descriptive messages

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) | |
| Language | TypeScript 5 (strict mode) | |
| Styling | Tailwind CSS 4 | Class-based dark mode via `html.dark` |
| Database | Supabase PostgreSQL | 44 tables, 1,453 migrated records |
| Auth | Supabase Auth + `@supabase/ssr` v0.9.0, `supabase-js` v2.97.0 | Email + password, middleware-protected |
| Icons | lucide-react | |
| Utilities | date-fns, clsx, tailwind-merge | |

## Current Architecture

```
middleware.ts                  — auth gate (getUser, not getSession)
src/app/
  layout.tsx                   — bare shell only
  (admin)/                     — protected, requires auth
    layout.tsx                 — renders Sidebar
    actions.ts                 — signOut
    page.tsx                   — dashboard (StatCard metrics, getDashboardData)
    [17 admin pages]
  (auth)/
    layout.tsx                 — centered, no sidebar
    login/page.tsx + actions.ts
  forms/                       — 8 public forms, no auth required
src/lib/
  supabase.ts                  — browser anon client + service role client
  supabase-server.ts           — createSSRClient (async), createMiddlewareClient
  queries.ts                   — read fetchers only; writes use inline supabase.from().upsert() in each page's handleSave
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

## Production Gaps (ordered by priority)

1. **Maintenance show/no-show toggle** — spec approved (`docs/superpowers/specs/2026-03-26-maintenance-toggle-design.md`); `StatusPill` component and inline save not yet implemented
2. **Row-Level Security (RLS)** — all tables currently open; anon key has full access
   - Public forms rely on RLS being OFF for inserts — enabling RLS requires explicit anon INSERT policies for: `incoming_leads`, `background_checks`, `waitlist`, `appointments`, `tickets`, `customer_inspection_photos`, `vehicle_handovers`
3. **Password reset flow** — no forgot password; admins reset via Supabase dashboard
4. **File uploads** — Airtable had photos/licenses/contracts not yet in Supabase Storage
5. **Email notifications** — no transactional email yet
6. **Reporting / analytics** — no export or aggregate views
7. **Testing infrastructure** — no Jest/Playwright; build is the only gate

## Admin Page Pattern

Every admin page follows the same structure — respect it when adding new pages:

```tsx
"use client"
// 1. useEffect → fetch data → setState
// 2. useMemo → filter by search + status
// 3. DataTable with columns config
// 4. onRowClick → Modal → FormField inputs
// 5. handleSave → supabase.from("table_name").upsert(record) → reload (do NOT add writes to queries.ts)
```

## Commands

```bash
npm run dev      # dev server (Turbopack) on http://localhost:3000
npm run build    # production build — only CI gate currently
npm run start    # serve production build locally
npm run lint     # ESLint

# Airtable → Supabase one-time sync
node scripts/sync-airtable.mjs           # live run
node scripts/sync-airtable.mjs --dry-run # preview only (no writes)
```

## Env

- `.env` at project root (gitignored via `.env*`)
- Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional (sync only): `AIRTABLE_PAT` — required for `scripts/sync-airtable.mjs`

## Docs

- `docs/ARCHITECTURE.md` — tech stack, directory structure, auth flow diagrams
- `docs/DATABASE-SCHEMA.md` — all 44 tables with field specs
- `docs/PIPELINE-FLOW.md` — customer and vehicle lifecycle state machines
- `docs/STATUS.md` — feature status, known issues, codebase stats
- `docs/superpowers/specs/` — design specs (supabase-auth, airtable-sync, maintenance-toggle)
- `docs/superpowers/plans/` — implementation plans (supabase-auth, airtable-sync)
