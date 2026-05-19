# Deploying TMMT Rentals to Vercel

TMMT Rentals is a Next.js app. It deploys to Vercel directly from this private
GitHub repo (`AIXMOS537/TMMT`).

## Vercel project (already connected)

| | |
|---|---|
| Vercel project name | `tmmt-c919` |
| Project ID | `prj_moZzMHYtwiZIS0TETOBOKODbp7eM` |
| Source repo | `AIXMOS537/TMMT` (`origin`) |
| Framework preset | Next.js (auto-detected) |

The project already exists, so there is **no fresh import to do**. Every push
to the production branch auto-deploys; other branches get preview deployments.

## Routine deploy

1. Make sure the build passes locally (see "Verify" below).
2. Commit and push to the production branch — Vercel builds and deploys
   automatically.
3. Check the deployment in the Vercel dashboard under project `tmmt-c919`.

## If you ever need to re-link or check the project

You run these (they need your Vercel login):

- Dashboard: [vercel.com](https://vercel.com) → project `tmmt-c919`.
- CLI: `npx vercel link` then enter project ID `prj_moZzMHYtwiZIS0TETOBOKODbp7eM`.
- Build settings should stay default: build `next build`, install `npm install`,
  output `.next`.
- Keep the Vercel project **private** — this app exposes admin and partner data.

## Required environment variables

Set these in Vercel → Project → **Settings → Environment Variables**, for the
**Production** (and **Preview**, if you use it) environments.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (https) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only, keep secret** |

Sentry (error monitoring) is also wired in — see [`docs/SENTRY-SETUP.md`](docs/SENTRY-SETUP.md)
for its `NEXT_PUBLIC_SENTRY_DSN` and source-map upload token.

The first three are the ones validated by `npm run check-env`.

## Verify before deploying

Locally, from the repo root:

```bash
cp .env.example .env   # if an example exists; otherwise create .env
npm install
npm run check-env      # validates the 3 vars + Supabase reachability
npm run build          # must succeed before pushing
```

## Notes

- The repo is **private**. Keep the Vercel project private too.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security — never expose it to
  the browser and never commit it. `.env` is gitignored.
- This repo is a fork of `Metavibez4L/TMMT` (`upstream`). Deploy from
  `origin` (`AIXMOS537/TMMT`).
