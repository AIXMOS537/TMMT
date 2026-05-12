# TMMT Rentals

A custom vehicle rental management platform built to replace Airtable — giving the TMMT team a purpose-built admin system, structured customer data, and self-service intake forms under one roof.

## Why We Built This

TMMT Rentals previously managed its entire operation out of Airtable: tracking fleet, leads, background checks, waitlists, appointments, contracts, payments, tickets, and more. While Airtable worked as a starting point, it created friction:

- **No customer-facing forms** — staff manually entered every inquiry, background check, and inspection
- **No access control** — everyone saw everything; no auth layer
- **No custom workflow** — generic spreadsheet UI instead of a purpose-built rental management flow
- **Per-seat pricing** — costs scaled with team size, not with value delivered
- **No path to production features** — file uploads, email notifications, and role-based access weren't possible without expensive integrations

This app replaces all of that. The full Airtable dataset (1,453 records, 44 tables) was migrated into Supabase PostgreSQL and wrapped with a custom Next.js admin interface and public-facing intake forms.

## What It Does

**For the team (admin, auth-protected):**
- Dashboard with live KPIs: fleet status, lead pipeline, active customers, open tickets
- 17 admin pages covering every part of the rental operation
- Search, filters, status badges, and modal-based CRUD on every page
- Dark mode and mobile-responsive sidebar

**For customers (public forms, no login required):**
- Lead intake, background check, waitlist signup, appointment scheduling
- Vehicle inspection, full onboarding inspection, handover checklist, support ticket

## Features

- **Dashboard** — KPI stats (fleet, leads, customers, tickets, payments) with recent activity
- **17 Admin Pages** — Full CRUD with search, filters, status badges, and modals
- **8 Public Forms** — Customer-facing intake forms (lead, background check, waitlist, appointment, inspection, onboarding, handover, ticket)
- **Authentication** — Supabase Auth, email + password, middleware-protected admin routes
- **Dark Mode** — Toggle with localStorage persistence and system preference fallback
- **Responsive** — Mobile sidebar with hamburger menu

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # ESLint
npm run check-env  # validate .env + Supabase reachability (optional)
```

## Release: partner portal & staff-only RLS (May 2026)

This version adds an **investor/partner read-only area** at `/partner`, **role-based routing** in middleware, and a **Supabase migration** that restricts `authenticated` users to **staff-only** data access unless they use the safe `get_partner_fleet()` RPC.

**Docs:** [docs/PARTNER-PORTAL.md](docs/PARTNER-PORTAL.md) (invites, `app_metadata.role`, verification).

### What changed (application)

| Area | Change |
|------|--------|
| Routes | `(partner)/partner` — partner dashboard; middleware sends `role=partner` users here |
| Auth | `src/lib/auth-roles.ts` — `partner` vs staff from `user.app_metadata.role` |
| Middleware | `middleware.ts` — root `/` matcher, partner path allowlist, staff blocked from `/partner` |
| Admin writes | `src/app/(admin)/admin-actions.ts` — rejects non-staff; allowlist includes `partner_fleet_access` |
| Login | `src/app/(auth)/login/actions.ts` — redirects partners to `/partner` after sign-in |
| Fleet UI | Optional **Partner portal notes** field (`partner_portal_notes`) on fleet edit modal |
| Playwright | [`playwright.config.ts`](playwright.config.ts) — `PW_REUSE_WEB_SERVER=1` to reuse an existing dev server; otherwise a fresh server is started |
| E2E | Extra smoke: `/partner` requires login; lead form success assertion tightened |

### What changed (database)

New migration: [`supabase/migrations/20260503120000_partner_portal_rls.sql`](supabase/migrations/20260503120000_partner_portal_rls.sql)

- Table `partner_fleet_access` (links `auth.users.id` → `fleet.id`)
- Column `fleet.partner_portal_notes`
- Functions `is_staff()`, `is_partner()`, `app_auth_role()`, `get_partner_fleet()`
- Replaces broad `auth_all_*` RLS policies with **`staff_all_*`** (`is_staff()`) on the same tables as [`supabase/migrations/20260331_enable_rls.sql`](supabase/migrations/20260331_enable_rls.sql)

**Important:** Until this migration is applied in Supabase, production DB behavior is unchanged. After it is applied, **only** users with `app_metadata.role` of `admin` or `va` (or **empty/missing role**, treated as staff for legacy) can read/write operational tables; **`partner`** users only get data via `get_partner_fleet()`.

### Rollback (Git / app)

1. Note the current commit: `git rev-parse HEAD`
2. Revert or reset to the commit **before** the partner-portal work, e.g. `git revert <merge_commit_sha>` or `git checkout <good_sha> -- .` (then commit), or restore from a branch/tag you created before deploying.

Redeploy the previous app build so middleware and routes match whatever DB policies you restore.

### Rollback (Supabase)

Only needed if **`20260503120000_partner_portal_rls.sql`** was already executed. There is no automated down-migration in-repo; options:

1. **Restore** the database from a Supabase backup taken **before** that migration (simplest if available).
2. **Manual SQL** (sketch — run in SQL editor after review; adjust if you renamed objects). **Order matters:** policies reference `is_staff()`, so drop/replace policies before dropping functions.
   - Drop every `staff_all_*` policy created in `20260503120000_partner_portal_rls.sql`, and drop `staff_all_partner_fleet_access` on `partner_fleet_access`.
   - **Recreate** the original `auth_all_*` policies from [`20260331_enable_rls.sql`](supabase/migrations/20260331_enable_rls.sql) (copy the `CREATE POLICY "auth_all_..."` statements), plus `auth_all_fleet` on `fleet`.
   - `DROP FUNCTION IF EXISTS public.get_partner_fleet();` (add argument/return signature if your Postgres version requires it).
   - `DROP FUNCTION IF EXISTS public.is_partner();`, `public.is_staff();`, `public.app_auth_role();` (same caveat).
   - `DROP TABLE IF EXISTS public.partner_fleet_access;`
   - `ALTER TABLE public.fleet DROP COLUMN IF EXISTS partner_portal_notes;`

After DB rollback, remove `role: "partner"` from any Auth users if you no longer want them treated as partners once you deploy old app code.

### Rollback checklist

- [ ] Revert or redeploy **application** to pre-partner commit
- [ ] Revert **Supabase** policies/objects (backup restore or manual SQL above)
- [ ] Confirm internal users can still log in and load `/` (staff)
- [ ] Confirm public `/forms/*` still work (anon INSERT policies unchanged)

## Environment Variables

Create `.env` at project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional — only needed for Airtable sync script
AIRTABLE_PAT=your-airtable-personal-access-token
```

## Airtable Sync

A one-time migration script syncs all Airtable data into Supabase:

```bash
node scripts/sync-airtable.mjs           # live run
node scripts/sync-airtable.mjs --dry-run # preview only, no writes
```

Covers 18 main tables and 19 junction tables.

## Project Structure

```
src/
├── app/
│   ├── (admin)/              # Protected — requires auth
│   │   ├── page.tsx          # Dashboard
│   │   ├── fleet/
│   │   ├── leads/
│   │   ├── background-checks/
│   │   ├── waitlist/
│   │   ├── appointments/
│   │   ├── customers/
│   │   ├── payments/
│   │   ├── tickets/
│   │   ├── expenses/
│   │   ├── insurance/
│   │   ├── inspections/
│   │   ├── maintenance/
│   │   ├── contracts/
│   │   ├── vendors/
│   │   ├── operation-costs/
│   │   ├── do-not-rent/
│   │   └── former-customers/
│   ├── (auth)/login/         # Login page
│   └── forms/                # 8 public intake forms (no auth)
├── components/
│   ├── Sidebar.tsx           # Navigation (5 groups)
│   ├── ThemeToggle.tsx       # Dark/light mode
│   └── ui.tsx                # Reusable UI library
└── lib/
    ├── supabase.ts           # Browser anon client (singleton)
    ├── supabase-server.ts    # SSR client (server actions + middleware)
    ├── queries.ts            # Read fetchers only; writes inline in pages
    └── utils.ts              # Formatting + status colors
```

## Database

- **44 tables** in Supabase (25 main + 19 junction)
- Migrated from Airtable (1,453 records, 368 junction links)
- See [docs/DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md) for full schema

## Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Tech stack, component design, auth flow, data flow diagrams |
| [Status](docs/STATUS.md) | Migration status, record counts, feature checklist |
| [Pipeline Flow](docs/PIPELINE-FLOW.md) | Customer lifecycle, vehicle flow, status state machines |
| [Database Schema](docs/DATABASE-SCHEMA.md) | ER diagram, all tables, junction tables, status enums |
| [Partner portal](docs/PARTNER-PORTAL.md) | Investor `/partner` rollout, RLS migration, invites, verification |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + `@supabase/ssr` |
| Icons | lucide-react |
| Utilities | date-fns, clsx, tailwind-merge |
