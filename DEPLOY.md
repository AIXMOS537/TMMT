# Deploying TMMT Rentals to Vercel

TMMT Rentals deploys from the private GitHub repo `AIXMOS537/TMMT`.

**Three separate Vercel apps** work together — see [`docs/THREE-APP-ECOSYSTEM.md`](docs/THREE-APP-ECOSYSTEM.md):

| App | Vercel project | URL |
|-----|----------------|-----|
| TMMT Ops | `tmmt-ops` | https://tmmt-ops.vercel.app |
| TMMT Command Center | `tmmt-command-center` | https://tmmt-command-center.vercel.app |
| AIXMOS | `aixmos-landing` | https://aixmos-landing.vercel.app |

This doc focuses on **Command Center** deploy settings (also the main monorepo checkout). Ops and AIXMOS have their own Vercel project settings — same repo, different env/host routing.

## Vercel project — Command Center

| | |
|---|---|
| **Operator URL** | **`https://tmmt-command-center.vercel.app`** |
| Vercel project name | **`tmmt-command-center`** |
| Legacy name (retire) | `tmmt-c919` — migrate env/domains here, then delete |
| Source repo | `AIXMOS537/TMMT` (`origin`) |
| Production branch | **`master`** |
| Root directory | `./` (confirm in Vercel → Settings → Git) |

Every push to **`master`** triggers deploys on all connected projects. Fix build failures on **each** app you keep; do not delete Ops or AIXMOS thinking they are duplicates.

## Retire legacy duplicates only

Extra projects **`tmmt-c919`** and **`tmmt`** re-deploy the same repo and cause parallel failed builds. **Do not delete** `tmmt-ops`, `tmmt-command-center`, or `aixmos-landing`.

```bash
bash scripts/retire-vercel-duplicates.sh          # dry-run
bash scripts/retire-vercel-duplicates.sh --apply  # removes tmmt-c919 + tmmt only
```

Before `--apply`: copy env vars and custom domains off `tmmt-c919` onto the correct app in the table above.


## Routine deploy

1. `npm run build` locally (must pass).
2. Merge to `master` — Vercel builds automatically **only when the diff touches app paths**
   (`src`, `public`, `packages`, `shared`, `config`, and the build/config files listed in
   `scripts/vercel-ignore.sh`). Docs-only and script-only merges are skipped on purpose; they
   show as CANCELED in Vercel, which is not a failure.
3. Confirm in the Vercel dashboard → `tmmt-ops` (the only git-linked project). To undo a deploy,
   an env change, or a migration, see `docs/ROLLBACK.md`.

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
npm run smoke:prod   # hits tmmt-ops.vercel.app by default (public pitch pages)
SMOKE_BASE_URL=https://tmmt-ops.vercel.app bash scripts/smoke-prod.sh
npm run test:e2e:prod
curl -sI https://tmmtrentals.net/login | grep -i x-robots-tag   # after DNS cutover
npm run ghl:test-webhook payment   # against production URL via GHL_TEST_BASE_URL
```

## Domains on Command Center + Ops

Attach staff domains to the **correct** app (see [`THREE-APP-ECOSYSTEM.md`](docs/THREE-APP-ECOSYSTEM.md)):

- `tmmtrentals.net` → typically **Command Center** or **Ops** (confirm in Vercel Domains)
- `admin.tmmtrentals.net` (optional alias)

Do **not** attach `.com` marketing domains to Ops/Command Center after GHL cutover — they belong on **AIXMOS** / GoHighLevel.

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
