# Deploying TMMT Rentals to Vercel

TMMT Rentals is a Next.js app. It deploys to Vercel directly from this private
GitHub repo (`AIXMOS537/TMMT`).

## Vercel project (already connected)

| | |
|---|---|
| Vercel project name (internal, for CLI / `vercel link`) | `tmmt-c919` |
| **Live production URL** | **`https://tmmt-command-center.vercel.app`** (verified 2026-05-21 — `tmmt-c919.vercel.app` 404s) |
| Project ID | `prj_moZzMHYtwiZIS0TETOBOKODbp7eM` |
| Org ID | `team_UzatfZkJUpFKABaO6cZTQUq7` |
| Source repo | `AIXMOS537/TMMT` (`origin`) |
| Production branch | `master` |
| Root directory | `./` |
| Framework preset | Next.js (auto-detected) |
| Intended custom domains (not yet pointed at app) | `allinonemanagementsolutions.com`, `allinonemanagementsolutions.net` |

The project already exists, so there is **no fresh import to do**. Every push
to the production branch (`master`) auto-deploys; other branches get preview deployments.

⚠️ **Known stale deployment (2026-05-21):** `/forms/customer-intake` returns 404 in prod
despite existing in `master`. The Vercel deployment appears to be older than the
master tip. Trigger a manual redeploy from the Vercel dashboard (Project → Deployments →
top entry → ⋯ → Redeploy) or push a new commit to master to refresh.

See also [`docs/ONE-APP-CONSOLIDATION.md`](docs/ONE-APP-CONSOLIDATION.md) for how AIX Command Center docs merge into this single app.

## Routine deploy

1. Make sure the build passes locally (see "Verify" below).
2. Commit and push to the production branch — Vercel builds and deploys
   automatically.
3. Check the deployment in the Vercel dashboard under project `tmmt-c919`.

## Required environment variables

Set these in Vercel → Project → **Settings → Environment Variables**, for the
**Production** (and **Preview**, if you use it) environments.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (https) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only, keep secret** |
| `NEXT_PUBLIC_PUBLIC_SITE_HOST` | Public marketing domain (default: `allinonemanagementsolutions.com`) |
| `NEXT_PUBLIC_OWNER_HUB_HOST` | Private owner hub (default: `allinonemanagementsolutions.net`) |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | $97 membership checkout URL (feeds `prebuild` → `public/aixmos/ghl-config.js`) |
| `NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL` | GHL filtered view for owner hub “AIXMOS upsell queue” |
| `GHL_WEBHOOK_SECRET` | Validates `/api/webhooks/ghl` (see [`docs/GHL-WEBHOOK-SETUP.md`](docs/GHL-WEBHOOK-SETUP.md)) |

Sentry (error monitoring) is also wired in — see [`docs/SENTRY-SETUP.md`](docs/SENTRY-SETUP.md).

`npm run build` runs `prebuild` first to generate `public/aixmos/ghl-config.js` from `NEXT_PUBLIC_GHL_*` vars.

## Verify before deploying

Locally, from the repo root:

```bash
npm install
npm run build          # must succeed before pushing
```

## Domains on `tmmt-c919`

Attach both domains to **this project only**:

- `allinonemanagementsolutions.net` (+ optional `www`) — owner command hub
- `allinonemanagementsolutions.com` (+ optional `www`) — public / forms (see `docs/DOMAIN-SETUP.md`)

Do **not** create separate Vercel projects for ops or command center.

## Notes

- The repo is **private**. Keep the Vercel project private too.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security — never expose it to
  the browser and never commit it. `.env` is gitignored.
- Owner access on `.net` requires Supabase `app_metadata.role` = `"admin"`.
