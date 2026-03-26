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
```

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
    ├── supabase.ts           # Browser client
    ├── supabase-server.ts    # SSR client (server actions + middleware)
    ├── queries.ts            # Data fetchers + CRUD
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
