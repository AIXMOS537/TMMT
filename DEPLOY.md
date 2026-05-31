# Deploying TMMT Rentals to Vercel

TMMT Rentals is a Next.js app. It deploys to Vercel directly from this private
GitHub repo (`AIXMOS537/TMMT`).

## Vercel project (already connected)

| | |
|---|---|
| Vercel project name | **`tmmt-c919`** (use this — not `tmmt`, `tmmt-ops`, or `tmmt-command-center`) |
| Project ID | `prj_moZzMHYtwiZIS0TETOBOKODbp7eM` |
| Source repo | `AIXMOS537/TMMT` (`origin`) |
| Root directory | `./` |
| Framework preset | Next.js (auto-detected) |

Every push to **`master`** auto-deploys production; other branches get preview deployments.

## Retire duplicate Vercel projects

The same GitHub repo (`AIXMOS537/TMMT`) was connected to **multiple** Vercel projects. That causes failed parallel deploys and a stale public URL. **Keep one project only.**

| Project | Action |
|---------|--------|
| **`tmmt-c919`** | **KEEP** — production, env vars, custom domains |
| `tmmt-command-center` | **DELETE** after renaming `tmmt-c919` → `tmmt-command-center` (see below) |
| `tmmt` | **DELETE** |
| `tmmt-ops` | **DELETE** |
| `aixmos-landing` | **DELETE** if it deploys the same TMMT repo root (landing lives in GHL / `AIXMOS/public`) |

**Operator URL (`tmmt-command-center.vercel.app`):** Vercel assigns `{project-name}.vercel.app`. Rename **`tmmt-c919`** → **`tmmt-command-center`** in dashboard (Settings → General → Project Name), confirm latest `master` production deploy, then delete the **old** empty `tmmt-command-center` project shell.

Automated checklist (dry-run by default):

```bash
bash scripts/retire-vercel-duplicates.sh          # print steps
bash scripts/retire-vercel-duplicates.sh --apply  # run vercel project rm for safe duplicates
```

After retirement, only one GitHub deployment status should show for production pushes.

## Routine deploy

1. `npm run build` locally (must pass).
2. Commit and push to the production branch — Vercel builds automatically.
3. Confirm in Vercel dashboard → project `tmmt-c919`.

## Required environment variables

Set in Vercel → **Settings → Environment Variables** (Production + Preview).

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — webhooks, admin scripts |
| `NEXT_PUBLIC_OWNER_HUB_HOST` | Staff domain — **`tmmtrentals.net`** (after DNS cutover) |
| `GHL_WEBHOOK_SECRET` | Validates `/api/webhooks/ghl` |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | $97 membership checkout (GHL) |
| `NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL` | Owner hub upsell queue filter |
| `NEXT_PUBLIC_GHL_CREDIT_GUIDANCE` | Credit guidance checkout |
| `NEXT_PUBLIC_GHL_OPERATOR_APPLY` | Operator apply funnel |
| `CLICKUP_API_TOKEN` | Create tasks from cases + GHL webhooks |
| `CLICKUP_LIST_FLEET` | Default `901318986996` (FLEET TASKS) |
| `CLICKUP_LIST_OPS` | Default `901318985770` (CUSTOMER POLICY) |
| `NEXT_PUBLIC_CUBE_SAME_ORIGIN` | `true` |
| `NEXT_PUBLIC_CUBE_PERSISTENCE` | `supabase` |
| `NEXT_PUBLIC_AIXMOS_SITE_URL` | Public AIXMOS origin on GHL |

Public marketing (`.com`) lives on **GoHighLevel**, not this Vercel project.

Run `npm run ghl:check` locally after updating env vars.

## Post-deploy verification

```bash
npm run smoke:prod   # if configured for your domain
curl -sI https://tmmtrentals.net/login | grep -i x-robots-tag
npm run ghl:test-webhook payment   # against production URL via GHL_TEST_BASE_URL
```

## Domains on `tmmt-c919`

Attach staff domains only:

- `tmmtrentals.net`
- `admin.tmmtrentals.net` (optional alias)

Do **not** attach `.com` domains after GHL cutover — they point to GoHighLevel.

See [`docs/superpowers/plans/2026-05-20-aixmos-domain-architecture.md`](docs/superpowers/plans/2026-05-20-aixmos-domain-architecture.md).

## Supabase migrations before deploy

Apply new migrations in order:

```bash
supabase db push
# or run SQL from supabase/migrations/ in the Supabase dashboard
```

Required for latest revenue + vendor work:

- `20260520120000_aixmos_program_cube.sql`
- `20260520140000_vendor_service_verticals.sql`

## ClickUp integration

When `CLICKUP_API_TOKEN` is set:

| TMMT event | ClickUp action |
|------------|----------------|
| Customer intake form (`/forms/customer-intake`) | Creates task in FLEET or OPS list |
| Assign vendor on `/cases` | Comment on linked ClickUp task |
| GHL webhook (customer/fleet tags) | Creates task + logs URL in Supabase notes |

Verify: `npm run clickup:check`

List routing: `src/lib/clickup/config.ts` — maintenance → FLEET TASKS, rental/general → CUSTOMER POLICY.

**Requires** workflow tables (`cases`, `clickup_tasks`) — apply `20260516120000_workflow_engine.sql` on Supabase when ready.

## Vendor onboarding (Michael / preferred vendors)

After migration + deploy:

```bash
npm run onboard:vendor -- --email michael@real-email.com --contact "Michael Bibbs"
```

Vendor signs in at `/login` → `/vendor`. Staff assigns jobs from `/workflow-vendors`.
