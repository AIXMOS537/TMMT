# TMMT OS

A Next.js 14 + Supabase workflow engine. Every customer request becomes a **case**.
Cases move through a typed pipeline (intake → review → vendor work → approval → close).
Three role-gated portals share one schema:

- `/internal/*` — Internal Team (admin + internal_team)
- `/vendor/*`   — Outside Vendor (vendor)
- `/investor/*` — Investor (investor)

## Stack

- Next.js 14 App Router (Server Components + Server Actions)
- Supabase (Postgres + Auth + Storage + RLS)
- Tailwind + shadcn-style UI primitives
- Zod for input validation
- Deploys clean on Vercel

## Production (Vercel)

**URL:** https://tmmt-c919-two.vercel.app

Before relying on internal/vendor portals in production, complete  
[`docs/VERCEL_PRODUCTION_CHECKLIST.md`](docs/VERCEL_PRODUCTION_CHECKLIST.md) (env vars, Supabase Auth redirects, redeploy, admin promotion).

After changing `next.config.mjs` or any `NEXT_PUBLIC_*` variable, **redeploy** on Vercel.

## First-run checklist

1. **Install**
   ```bash
   cd tmmt-os
   npm install
   cp .env.example .env.local
   ```

2. **Create a Supabase project** at https://supabase.com, copy these into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role secret)
   - `INTAKE_WEBHOOK_SECRET` — any random string; used by `/api/intake`

3. **Apply the schema.** Either:
   - Paste `supabase/migrations/0001_init.sql` into the Supabase SQL Editor and run, **or**
   - Use the Supabase CLI: `supabase db push`

4. **Promote your first admin.** Sign up at `/login` (magic link or password), then in
   Supabase SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@tmmt.com';
   ```

5. **Run the dev server**
   ```bash
   npm run dev
   ```

   Then visit:
   - http://localhost:3000/intake — public intake form
   - http://localhost:3000/internal/dashboard — internal portal (after admin promotion)
   - http://localhost:3000/vendor/dashboard — vendor portal (after creating a vendor)
   - http://localhost:3000/investor/dashboard — investor portal

## Onboarding a vendor

1. They sign up at `/login` like any user.
2. In Supabase:
   ```sql
   update public.profiles set role = 'vendor' where email = 'vendor@example.com';
   insert into public.vendors (profile_id, company_name, services, email)
   values ('<their profile id>', 'Ace Mobile Detail', '{detail,inspection}', 'vendor@example.com');
   ```
3. From the internal case detail page, assign them a job. They'll see it in `/vendor/dashboard`.

## External intake webhook

For Airtable / GoHighLevel / Zapier / n8n to file a case:

```bash
curl -X POST https://YOUR-APP/api/intake \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: $INTAKE_WEBHOOK_SECRET" \
  -d '{
    "customer_name": "Jane Doe",
    "customer_email": "jane@example.com",
    "request_type": "tow",
    "subject": "Flat on the 405",
    "details": "Tire blew near La Cienega exit",
    "source": "ghl",
    "airtable_id": "recXXXXXX"
  }'
```

## Architecture map

```
src/
├── app/
│   ├── page.tsx                    Landing page
│   ├── intake/                     Public intake form
│   ├── api/intake/                 Public webhook for Airtable/GHL/Zapier
│   ├── login/                      Supabase magic-link + password
│   ├── auth/{callback,signout}/    Session lifecycle
│   ├── (internal)/internal/        Admin + internal_team portal
│   ├── (vendor)/vendor/            Vendor portal (RLS-scoped)
│   └── (investor)/investor/        Investor portal (RLS-scoped)
├── components/
│   ├── ui/                         shadcn-style primitives
│   ├── case-status-badge.tsx
│   ├── job-status-badge.tsx
│   └── portal-shell.tsx
├── lib/
│   ├── supabase/{server,client,middleware,service}.ts
│   ├── workflow/statuses.ts        Typed enums + transitions
│   ├── workflow/engine.ts          advanceCase / assignVendor / setJobStatus
│   ├── auth.ts                     getCurrentUser / requireRole
│   └── utils.ts
├── middleware.ts                   Role-gates /internal /vendor /investor
└── types/database.ts               Placeholder for generated types
```

## The workflow engine

`src/lib/workflow/statuses.ts` is the **single source of truth** for the pipeline
vocabulary — keep it in sync with `supabase/migrations/0001_init.sql`.

`src/lib/workflow/engine.ts` is intentionally thin. Each helper is a Server
Action that updates the DB, writes to `activity_logs`, optionally inserts a
`notifications` row, and revalidates the affected paths. Future automations
(SMS via GHL, ClickUp task creation, Slack pings) plug in here.

```ts
import { advanceCase, assignCaseToVendor, setVendorJobStatus } from "@/lib/workflow/engine";

await advanceCase(caseId, "internal_review", "ready for triage");
await assignCaseToVendor({ caseId, vendorId, title: "Brake inspection", offeredPrice: 250 });
await setVendorJobStatus(jobId, "accepted");
```

## RLS in plain English

| Role            | Can read                                              | Can write                                        |
|-----------------|-------------------------------------------------------|--------------------------------------------------|
| `admin`         | everything                                            | everything                                       |
| `internal_team` | everything (no destructive admin)                     | cases, tasks, vendor_jobs, approvals, vendors    |
| `vendor`        | only `vendor_jobs.vendor_id = me`; case/files for those | own job status, own job_updates, own files       |
| `investor`      | own `investor_account`; published updates in own org  | nothing                                          |
| `customer`      | nothing (no portal yet — they get email/SMS via GHL)  | inserts into `customer_intake_forms` (anonymous) |

All policies are in `0001_init.sql`. The DB enforces them — even if the Next layer
forgets a check, vendors cannot see other vendors' work.

## Storage

One private bucket: `vendor-files`. Path convention is `{vendor_job_id}/{filename}`.
Storage policies use the first path segment to match against the vendor's jobs.

## Three portals (Client · Team · Admin)

One login, role-based portals, package-based entitlements. See **[docs/PORTALS.md](docs/PORTALS.md)**.

- `/client/dashboard` — paying customers (Starter / Growth / Elite)
- `/team/dashboard` — internal team (department-scoped)
- `/admin/dashboard` — owners & leadership (admin scope)
- `/portals` — switch when you have access to more than one

Apply migration: `supabase/migrations/0005_portals_entitlements.sql`

## AIXMOS / TMMT ecosystem map

| Layer | In this repo |
|-------|----------------|
| **Dashboard** | `/internal/dashboard` (ops), `/vendor/dashboard` (operators/vendors), `/investor/dashboard` |
| **Onboarding** | `/onboarding` — profile setup after login |
| **Learn** | `/learn` — education module scaffold |
| **Marketplace** | `/marketplace` — services + vehicles catalog (`0004` migration) |
| **Admin** | `/internal/admin` — admin-only console |
| **CRM / webhooks** | `/api/webhooks/ghl`, `/api/webhooks/airtable`, `/api/webhooks/n8n` |
| **Intake** | `/intake` + `/api/intake` |
| **AI agents** | VISION · TANK · FLY GUY · BOB · STICKS — `/api/agents/evaluate` (3-of-5 votes) |
| **Activity log** | `activity_logs` + `sync_events` on every webhook transition |

Apply `supabase/migrations/0004_aixmos_ecosystem.sql` for bookings, payments, rewards, and the agent panel tables.

### Agent evaluation (3-of-5)

```bash
# Open a panel for a case
curl -X POST https://YOUR-APP/api/agents/evaluate \
  -H "Content-Type: application/json" \
  -H "X-Agent-Secret: $AGENT_WEBHOOK_SECRET" \
  -d '{"action":"open","subject_type":"case","subject_id":"CASE-UUID"}'

# Cast a vote (repeat for each agent)
curl -X POST https://YOUR-APP/api/agents/evaluate \
  -H "Content-Type: application/json" \
  -H "X-Agent-Secret: $AGENT_WEBHOOK_SECRET" \
  -d '{"action":"vote","session_id":"SESSION-UUID","agent":"vision","vote":"approve","rationale":"Policy OK"}'
```

### n8n webhook

```bash
curl -X POST https://YOUR-APP/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -H "X-N8N-Secret: $N8N_WEBHOOK_SECRET" \
  -d '{"event":"booking.confirmed","entity":"booking","entity_id":"UUID","open_agent_evaluation":true}'
```

## Deployment (Vercel)

1. `npm run build` must pass locally (uses `.env.local`).
2. Set all variables from `.env.example` in Vercel → Settings → Environment Variables.
3. Run migrations `0001` → `0002` (if using CRM sync) → `0004` in Supabase SQL Editor.
4. Configure Supabase Auth redirect URLs (see `docs/VERCEL_PRODUCTION_CHECKLIST.md`).
5. `vercel deploy --prod` or push to the connected Git branch.
6. Promote first admin via `supabase/PROMOTE_FIRST_ADMIN.sql`.
7. Point GHL / Airtable / n8n webhooks at your production host.

Never commit `.env.local`, `.env.vercel`, or service-role keys.

## Where to go next

- Wire ClickUp: in `engine.ts → assignCaseToVendor`, POST to the ClickUp API
  and save the returned `task_id` / `url` into `cases.clickup_task_id` / `clickup_task_url`
  and `clickup_tasks`.
- Wire Airtable sync: read/write `cases.airtable_id`, and add a route
  `/api/airtable/sync` similar to `/api/intake`.
- Wire GoHighLevel: send SMS/email on case status transitions from the engine.
- Customer portal: add a `(customer)` route group and an RLS policy on `cases`
  matching `cases.customer_email = (select email from public.profiles where id = auth.uid())`.
- Generate types: `npm run db:types` after `supabase login && supabase link`.
