# 03 · GIT FORENSICS — 2026

## Headline
**525 commits are reachable from `master`. 13,313 exist in the repository. 404 branches.**
The mainline was rewritten; four months of history is orphaned but recoverable.

## Commit distribution
| Month | Reachable from HEAD | All refs |
|---|---:|---:|
| 2026-02 | 0 | 9 |
| 2026-03 | 0 | 100 |
| 2026-04 | 0 | 36 |
| 2026-05 | 0 | 184 |
| 2026-06 | 353 | 5,676 |
| 2026-07 | 59 | 6,794 |
| 2026-08 | 98 | 255 |
| 2026-09 | 15 | 259 |

**Reading the numbers:** the Jun/Jul all-refs spike (12,470 commits) is **automation, not work** — the documented swarm/worktree leak that produced 1,151 `.coord-init-*` worktrees. The honest human-authored volume is the reachable column plus the 329 orphaned Feb–May commits.

## Genesis — CONFIRMED
```
f96102263  2026-02-17  Initial commit
0c3d478b9  2026-02-18  Initial commit from Create Next App
bff7389a0  2026-02-18  TMMT Rentals app: 18 admin pages, 8 public forms, Supabase integration
a41d3d233  2026-02-18  Fix waitlist column names: date_added_to_waitlist → date_added
9aa2c185a  2026-02-18  Add docs: architecture, status, pipeline flow, and database schema
```
The project's own first substantive commit calls it **"TMMT Rentals app"**. Any later claim that this was always a platform is contradicted by its origin.

## The rewrite — CONFIRMED
- `master` history begins **2026-06-04**.
- 331 commits dated 2026-01-01 → 2026-06-04 exist only on unreferenced branches.
- Commits appear as **near-exact duplicate pairs** (identical message + date, different SHA) — e.g. `6c7769bbf` / `011942248` "feat(dispatch): /dispatch routes". This is the fingerprint of a history rewrite where pre- and post-rewrite objects both survive.
- Corroborated by branch `claude/history-scrub-runbook` and the documented 2026-07-04 sovereignty scrub.

**Risk:** 12,788 unreachable commits are one `git gc --prune=now` from permanent loss. If the Feb–May history has any value — and it contains the original rentals app and the auth design — it should be tagged before any repo maintenance.

## Reverts and rework
115 merge commits. Explicit reverts include:
- `f6ad091e5` / `3053f3f2e` — `Revert "feat(dispatch): UI components — map, queue, override panel, address, status bar"` (duplicated, both sides of the rewrite)
- `354ec2a84` — `revert: drop duplicate outreach-drainer — scripts/drain-queue.mjs already ships it` — an explicit duplicate-implementation revert
- `604c25ece` — Mapbox → Leaflet swap ("zero-signup map"), a cost-driven re-implementation

## Most-churned files (rework hotspots)
| Churn | File | Reading |
|---:|---|---|
| 58 | `scripts/tmmt` | CLI entrypoint, constantly rewritten |
| 29 | `CLAUDE.md` | Instructions churn more than most code |
| 27 | `scripts/go` | Second CLI entrypoint |
| 25 | `package.json` / `.gitignore` | — |
| 16+12 | `middleware.ts` **and** `src/middleware.ts` | **Two middleware files churned separately — 28 combined edits.** See `25_…ABANDONED_WORK.md` |
| 11 | `src/lib/queries.ts` | The data layer |
| 8 | `src/app/api/webhooks/ghl/route.ts` | GHL webhook instability |

## Deleted files
72 distinct files deleted across history — consistent with normal refactoring, no evidence of destructive loss.

## Current automation state — CONFIRMED, ACTIVE
Branch `swarm-coord` receives a commit **every ~3 minutes** authored `swarm@tmmt` ("swarm: update coordination state"). Each triggers a Vercel build. **The last 20 builds are all `BLOCKED`.** This was live during the audit.
