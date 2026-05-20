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

Every push to the production branch auto-deploys; other branches get preview deployments.

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

## Vendor onboarding (Michael / preferred vendors)

After migration + deploy:

```bash
npm run onboard:vendor -- --email michael@real-email.com --contact "Michael Bibbs"
```

Vendor signs in at `/login` → `/vendor`. Staff assigns jobs from `/workflow-vendors`.
