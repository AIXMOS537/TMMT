# Deploy Policy — owner-gated, no automatic deploys (LAW, 2026-06-18)

Set by the owner (Muhammad Taha — "Project X HAILMARY") after the `swarm-coord`
branch silently burned Vercel's free-tier 100-deploys/day limit and blocked all
production deploys.

## The rule

**Nothing reaches a live site automatically. Ever.**
Build locally → the owner verifies & **accepts** → then, and only then, ship.

## What is in place

1. **Vercel git auto-deploy is DISCONNECTED on every project.** On 2026-06-18 the
   GitHub link was removed from all five Vercel projects
   (`tmmt-ops`, `tmmt-command-center`, `aixmos-landing`, `aixmos-offer`,
   `tmmt-training-site`). A `git push` to **any** branch can no longer create a
   deployment — which also kills the swarm-coord quota bleed at the root
   (all four app projects were watching the same repo, so every swarm push made
   4 deployments). See [[project-swarm-coord-vercel-quota-bleed]].
   - Reconnect (only if ever needed): `vercel git connect` in a project-linked dir,
     or re-add the GitHub link in the Vercel dashboard. **Do not do this without
     the owner's explicit say-so.**

2. **Backstops in case a git link is ever re-added:**
   - `vercel.json` → `git.deploymentEnabled: false` (disables auto-deploy for all branches).
   - The swarm coordination commit carries `[skip ci]` (`scripts/swarm.sh`) so
     coordination pushes never trigger a build.

3. **The ONE blessed deploy path: `scripts/ship`.**
   ```
   bash scripts/ship                 # tmmt-ops (default)
   bash scripts/ship aixmos-landing  # or tmmt-command-center | aixmos-offer
   bash scripts/ship --dry-run       # build + verify only, no deploy
   ```
   Gates, in order: **Owner Seal** (`auth/OWNER.seal`) → **local `npm run build`**
   (never spend a deploy on broken code) → **type `DEPLOY`** to confirm → CLI
   `vercel deploy --prod` (builds with the project's own env).

## For agents / future sessions

- Never re-enable Vercel git auto-deploy.
- Never run `scripts/ship` on the owner's behalf — it requires the owner's seal
  passphrase, which only the owner has. Build and verify locally, then hand off
  to the owner to ship.
- The swarm builds and edits **locally** (its own worktrees/branches); deploying
  is a separate, deliberate, owner-run step.
