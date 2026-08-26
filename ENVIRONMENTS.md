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
