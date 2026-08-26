# Environments & branches

One canon. One build lane. Everything else is temporary.

Written 2026-08-26 after reconciling a 15-ahead / 12-behind split between
production and `master`. Read this before creating a branch or deploying.

## The two lanes

| lane | branch | what it is | who deploys it |
|---|---|---|---|
| **Canon / production** | `master` | The single source of truth. Every shipped change ends up here. | Vercel `tmmt-ops` (see *Deploy wiring*) |
| **Develop / build** | `develop` | Integration lane. Feature branches merge here first, prove themselves, then go to `master`. | preview builds |

Feature branches: cut from `develop`, merge back to `develop`, delete after merge.
Never cut long-lived branches off anything but `develop` or `master`.

## Deploy wiring — read this before you deploy

Production currently deploys from **`m1/aixmos-credit-host`**, *not* `master`.
That is historical, not intentional. It is why the two drifted apart.

**Until the Vercel project is repointed to `master`, merging into
`m1/aixmos-credit-host` means shipping to production.** Treat it as a release
action, not a merge.

As of `c1ccc223`, `master` is a complete superset of that branch — 0 prod-only
commits remain — so repointing is safe whenever the Vercel account allows it.

### Repointing checklist (owner-gated)

1. Resolve the Vercel account restriction (see *Known blockers*).
2. Deploy `master` to a **preview** URL. Verify sign-in, the public intake
   forms, and the credit surfaces.
3. Repoint `tmmt-ops` production branch → `master`.
4. Delete `m1/aixmos-credit-host` only after the first successful `master`
   production deploy.

## How the drift happened — don't repeat it

Six commits existed on both `master` and the production branch with different
SHAs: the same work **cherry-picked between branches instead of merged**. Each
cherry-pick widened the split, because git cannot tell the copies are the same
change.

If you need a commit on another branch, **merge** it or open a PR. Reach for
`git cherry-pick` only for a genuine hotfix, and merge the branches back
together afterwards.

## Known blockers (2026-08-26)

- **Vercel account is not serving.** `READY` deployments return 503 at their own
  immutable URLs, and new production deploys land in `BLOCKED` with zero build
  log events. `unpause_project` returns 403. Only `tmmt-ops` still serves, frozen
  on `2bf09b1e`. Likely Hobby-plan commercial-use enforcement — the team plan is
  `hobby` and this is a commercial product. Owner must check the dashboard.

  **Correction, verified 2026-08-26.** That reading was too broad, and the
  Hobby-enforcement theory is unsupported. `tmmt-ops-aixmos537.vercel.app`
  answers **302** — alive — and so does the READY deployment `tmmt-pvfkndc1a`.
  Only `tmmt-command-center.vercel.app` returns **503**, and that is the project
  being retired. The serving project serves.

- **THE PUBLIC CANNOT REACH PRODUCTION.** `tmmt-ops` has Vercel SSO Deployment
  Protection switched on:

  ```
  ssoProtection: { enabled: true, deploymentType: "all_except_custom_domains" }
  ```

  Every route — including `/forms/waitlist`, `/forms/lead-intake` and
  `/legal/privacy` — answers `302 → vercel.com/sso-api`. A customer meets a
  Vercel login wall, not the app. **No lead can be submitted.**

  This is why `fix(forms): keep public intake API off the login wall` and
  `fix(forms): serve AIXMOS-proxied credit forms without a bounce loop` did not
  settle it: Vercel intercepts *before* any app code runs, so no middleware or
  route change can open that door.

  The setting exempts custom domains. `tmmt-ops` has none attached — only
  `tmmt-ops-aixmos537.vercel.app` — and neither `tmmtrentals.net` nor
  `tmmtrentals.com` resolves at all. There is currently no public door.

  Two ways out, owner's call: attach the real custom domain (it bypasses SSO
  under the current setting), or switch SSO off. Attaching the domain is the
  better answer if the intent in `.env.example` still holds — *staff-only .net
  on Vercel, .com marketing on GHL* — because it opens the real URL while
  leaving preview URLs protected.

- **No Vercel CLI credentials on BRAINIAC-7.** `vercel whoami` → logged out. No
  token in env or config. Blocks any CLI-driven preview deploy.
- **`master` is not wired to Vercel.** Merging to `master` triggers no build.

## Stale branches — do not assume these are close to canon

All of these forked from the same ancient point and are **443 commits behind
`master`**. They are parallel histories, not stale-by-a-bit:

| branch | ahead | behind |
|---|---|---|
| `feat/credit-dispute-command` | 166 | 443 |
| `docs/test-status-update` | 152 | 443 |
| `claude/organize-chats-sessions-7t7zjy` | 147 | 443 |
| `merge/legal-pages-into-tmmt-os` | 119 | 443 |
| `main` | 104 | 443 |

`main` is **not** a second canon — `master` is the default branch. `main` is a
dormant fork kept for history.

**The Desktop `TMMT-LIVE` checkout sits on `feat/credit-dispute-command`**, so
it is 443 commits behind canon. Do not treat it as current. `C:\dev\TMMT` sits
on `main` and is likewise far behind; its unpushed work is preserved on
`origin/backup/windows-dev-TMMT-2026-08-25`.

Rebasing any of these onto `master` is a project, not a chore. Decide
per-branch whether the work is still wanted before spending the effort.

## Vercel project inventory (audited 2026-08-26)

Five projects on team `aixmos537` (plan: `hobby`). **None is git-linked** — every
deploy has been pushed from a local checkout via `cursor-cli`, which is how the
sources drifted apart.

| project | serving | deploys from | source branch today |
|---|---|---|---|
| `tmmt-ops` | **200** | `m1/aixmos-credit-host` @ `2bf09b1e` | exists |
| `tmmt-command-center` | **200** | `cursor/tmmt-management-initial-setup` @ `0cfcadd`, **`gitDirty=1`** | **DELETED** — project **RETIRED**, see below |
| `tmmt-training-site` | 503 | `swarm-coord` (bot loop, 20 straight `BLOCKED`) | **DELETED** |
| `aixmos-landing` | 503 | — | — |
| `aixmos-offer` | 503 | — | — |

### `tmmt-ops` and `tmmt-command-center` are the same app

Both redirect to `/login`, both serve `<title>Sign in · Partner portal &
operations</title>` and `<h1>Sign in to TMMT Rentals</h1>`. They are not an
"ops engine" and a separate "owner cockpit" — they are **one codebase deployed
twice from two different stale branches**. The owner-vs-operator split is a role
inside the app, not a second deployment.

**Consolidate to `tmmt-ops`.** It is the only one of the two whose source branch
still exists, so it is the only one that can be rebuilt from source.

### Two deployments are unreproducible

`tmmt-command-center` and `tmmt-training-site` both deploy from branches that
have since been **deleted from the repo**, and command-center's was additionally
built from a dirty working tree (`gitDirty=1`). No commit in the repository
reproduces what is currently running on either. They cannot be rebuilt as-is —
only replaced from `master`.

This is the concrete meaning of "the apps are out of sync": not version drift,
but deployments pinned to code that no longer exists.

### Rebuild order, once Vercel deploys are possible again

1. Point `tmmt-ops` at `master` and deploy (see *Repointing checklist* above).
2. Rebuild `tmmt-training-site` from `master` — the training surfaces already
   live there at `src/app/(operator)/operator/training/**` and `src/app/try`.
   Do **not** try to resurrect `swarm-coord`.
3. Retire `tmmt-command-center` once `tmmt-ops` serves canon, or repoint it at
   `master` too if a second hostname is genuinely wanted.
4. Decide whether `aixmos-landing` and `aixmos-offer` are still wanted before
   spending effort on them.

## `tmmt-command-center` is RETIRED (decided 2026-08-26)

`tmmt-ops` is the single app. Do not deploy to `tmmt-command-center`, and do not
recreate it. The owner-vs-operator distinction is a **role inside `tmmt-ops`**,
not a second deployment — both hostnames served a byte-identical sign-in page.

### Its history was orphaned — and is now tagged

The commit it deployed, `0cfcadd`, has **no common ancestor with `master`**. It is
the tip of a **separate ~100-commit lineage** running from 2026-03-25 to
2026-05-18 ("Add Supabase Auth implementation plan" through "Add 24/7 office dev
server LaunchAgent"), including a portfolio command center with venture-scoped
routes, an ops command assistant, GHL auto-ops, and a client rental hub.

**No branch pointed at it.** It survived only because Vercel pinned a deployment
to that SHA, which meant it was one garbage-collection away from being gone.

It is now preserved as an immutable tag:

    archive/command-center-2026-05-18  ->  0cfcadd

Recover any of that work with `git log archive/command-center-2026-05-18`, or
cherry-pick from it. **Never delete that tag.** Because the build was also made
from a dirty tree (`gitDirty=1`), the tag is the closest reproducible record —
it is not byte-identical to what was served.

### Teardown steps (owner — needs the Vercel dashboard)

The MCP toolset exposes no pause or delete for projects, so this is manual:

1. Confirm nothing you care about points at `tmmt-command-center.vercel.app`.
2. Vercel → project `tmmt-command-center` → Settings → **Pause** (reversible)
   rather than Delete, until `tmmt-ops` has served canon for a while.
3. Only then Delete, if you want the name freed.
4. Leave the archive tag alone regardless.
