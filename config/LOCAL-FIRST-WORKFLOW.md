# Local-First Workflow — build local, deploy by CLI, never burn the quota

**Owner preference (standing):** do everything **locally** — code, edit, create
projects/sites/apps/full-stack, contracts, documents — and **deploy to Vercel
from the terminal**, not by relying on git auto-deploys.

## Why this exists
The CI "failure" on PR #45 was Vercel's free plan limit: *>100 deployments/day*.
Cause: Vercel's **git integration auto-deploys every push**, and this repo feeds
**4 Vercel projects** — so each push = up to 4 deployments. A few dozen pushes
maxed the daily quota. The fix: stop auto-deploying non-production branches and
deploy on demand via the CLI.

## The fix (already in the repo)
- **`scripts/vercel-ignore-build.sh`** + `vercel.json` `"ignoreCommand"`:
  git auto-deploy now runs **only for the production branch** (`master`/`main`).
  Every other branch is **skipped** (exit 0) — pushes no longer burn deploys.
  Per-project override: set `VERCEL_PROD_BRANCH` in that project's env.
- **`bin/ship`**: local-first deploy. Builds locally, uploads prebuilt output —
  one controlled deployment.

### Belt-and-suspenders (do once, in the Vercel dashboard)
For each of the 4 projects → **Settings → Git**: set the **Production Branch**
and turn **off** "Automatically deploy all branches" / preview deployments, or
rely on the ignore step above. Either way, previews stop auto-firing.

## Deploying from the terminal
One-time per project (this repo → multiple projects, so link each):
```bash
npm i -g vercel
vercel login
vercel link            # run in the project dir; pick the right project
```
Then:
```bash
bin/ship               # preview deploy
bin/ship prod          # production deploy
```
Raw equivalent: `vercel pull --yes --environment=production && vercel build --prod && vercel deploy --prebuilt --prod`.
`--prebuilt` builds on your machine and uploads the output, so it's fast and
bypasses the remote build/ignore step.

## Spinning up anything on the fly (you / team / clients)
All local, deploy when ready:
- **New site/app:** `npx create-next-app@latest <name>` → `npm run dev` → `cd <name> && vercel link && bin/ship`.
- **Static site / landing:** any framework; `vercel deploy --prebuilt` after a local build.
- **Full-stack:** add Supabase (`@supabase/ssr`) like this repo; keep secrets in
  `.env.local` and Vercel env (never commit).
- **Contracts / documents:** generate locally (Markdown → PDF via your tooling),
  store artifacts on the NAS, reference them in the brain
  (`memory_entities.external_refs`) so HAILMARY can recall them.
- **HAILMARY help:** `hailmary recall "<context>"` before, `hailmary remember
  "<what you built>"` after, and `hailmary do "<task>"` to plan it.

## Rules of thumb
- **Code & test locally first** (`npm run dev`, `npm run build`).
- **Commit/push freely** — pushes no longer trigger preview deploys.
- **Deploy intentionally** with `bin/ship` (preview) / `bin/ship prod`.
- **Production** still auto-deploys on `master` (keep that, or also go manual).
- Secrets stay in env, never shipped (see `docs/SECURITY-LICENSING.md`).
