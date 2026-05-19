# Deploying TMMT Rentals to Vercel

TMMT Rentals is a Next.js app. It deploys to Vercel directly from this private
GitHub repo (`AIXMOS537/TMMT`).

## One-time setup — connect the repo to Vercel

You run these steps (they need your Vercel login).

1. Go to [vercel.com](https://vercel.com) and sign in.
2. **Add New… → Project** → import `AIXMOS537/TMMT`.
3. Framework preset: **Next.js** (auto-detected). Leave build settings default:
   - Build command: `next build`
   - Install command: `npm install`
   - Output: default (`.next`)
4. Add the environment variables below **before** the first deploy.
5. Deploy. After it succeeds, set the Vercel project to **private** /
   restrict preview deployments, since this app exposes admin and partner data.
6. Copy the production URL into the command center README
   (`AIX-Command-Center/README.md` → "Apps & Deployment").

After this, every push to the production branch auto-deploys; other branches
get preview deployments.

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
