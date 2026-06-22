# Local-First — never hit the Vercel deploy limit again

> **What happened:** PR #72's checks went red with
> `Resource is limited … api-deployments-free-per-day (>100)`. **Not a code bug** —
> the Vercel **free tier caps deployments at 100/day**, and **5 Vercel projects**
> (`tmmt-ops`, `tmmt-command-center`, `aixmos-landing`, `aixmos-offer`,
> `tmmt-training-site`) all watch this one repo. So **every push = 5 deploys**, and
> ~40 branches of churn blew past 100/day.
>
> **The fix:** stop git from auto-deploying, and run everything **local on your own
> mesh** (the setup already in place — Tailscale + `scripts/tmmt`). Deploys to Vercel
> become **manual and owner-chosen**, never automatic.

## Layer 1 — git no longer auto-deploys (DONE, in this repo)

`vercel.json` now has:

```json
"git": { "deploymentEnabled": false }
```

This tells Vercel: **do not create a deployment on any git push** for every project
that reads this repo's `vercel.json`. No push, branch, or PR will ever trigger a cloud
build again → the daily cap can't be hit by automation.

- ✅ Public sites **stay up** — existing live deployments are untouched; this only stops
  *new automatic* ones.
- ✅ Build/test/lint/CI in your own gates are unaffected (they don't deploy).
- 🔁 Reversible: set it back to `true`, or to `{ "master": true }` for production-only
  auto-deploy, if you ever want automation back.

## Layer 2 — run it all LOCAL (the daily driver)

```bash
bash scripts/tmmt local          # build + serve TMMT OS on this machine
bash scripts/tmmt local bg       # same, in the background
bash scripts/tmmt local tailnet  # expose it over Tailscale (tailnet-only HTTPS)
bash scripts/tmmt local down     # stop the background serve
```

`scripts/local-up.sh` builds (`next build`) and serves (`next start`) here, and prints
the **MagicDNS / tailnet URL** so every device on the mesh reaches it — no Vercel in the
loop. The live app needs `.env` (`vercel env pull .env --environment=production`); build
and tests don't.

> This serves **this** app (TMMT OS / `tmmt-ops`). The other four apps are their own
> deploys — same pattern: in each repo, `next build && next start` behind Tailscale, or
> point that project's `vercel.json` at `deploymentEnabled: false` too.

## Layer 3 — when you DO want a public release (manual only)

Deploy on your terms, from your machine — this never touches the daily auto-deploy churn:

```bash
vercel --prod          # deploy current app to its production domain
# or the role-aware wrapper:
bash scripts/tmmt deploy owner
```

Manual CLI deploys still work with `deploymentEnabled: false`; you're only turning off
the *git-triggered* ones.

## Owner taps I can't do from here (Vercel dashboard)

Some projects may have a **Root Directory** set to a subfolder and read a *different*
`vercel.json` than this repo's root — for those, flip the toggle in the dashboard:

1. Vercel → each project → **Settings → Git**
   - Set **"Ignored Build Step"** to a command that skips, or
   - Under the connected repo, **disable preview/branch deployments**, keeping only the
     production branch (or disconnect Git entirely for fully-manual).
2. To never get surprised by the cap: **upgrade the team to Pro** (lifts 100/day), *or*
   keep this local-first setup and deploy manually. Both work; local-first is free.
3. Optional: reduce the **number of projects watching this repo** — if some of the 5
   don't need this repo, disconnect them so a push fans out to fewer deploys.

## TL;DR

- Auto-deploy is **off** in-repo → the limit can't be hit by pushes anymore.
- Daily work runs **local on the mesh** (`tmmt local`).
- Public releases are **manual** (`vercel --prod`) when *you* decide.
- If you want automation back later, it's a one-line toggle in `vercel.json`.
