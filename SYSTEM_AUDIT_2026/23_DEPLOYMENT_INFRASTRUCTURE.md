# 23 · DEPLOYMENT & INFRASTRUCTURE

## Environments
| Env | Reality |
|---|---|
| Development | `next dev`; env lazily read so build works without secrets |
| **Staging** | 🔴 **Does not exist.** No preview-specific project, no staging DB, no branch env |
| Production | Vercel `tmmt-ops` → Supabase `uapxakmlwnpfsftfeezx` |

**There is exactly one database.** Every migration, every test of a destructive change, every experiment runs against live production data. Supabase branching is available and unused.

## 🔴 D-1 · The deploy pipeline is jammed — CONFIRMED, ACTIVE
**All 20 most recent `tmmt-ops` deployments are `state: BLOCKED`.**

Every one: branch `swarm-coord`, author `swarm@tmmt`, message `"swarm: update coordination state"`, ~**3 minutes apart**, still firing during this audit (latest `dpl_FfprYvq1CUnmbZRi87fGJm5TGhAD`).

An automation is pushing a coordination-state commit to a branch Vercel builds, roughly 480 times a day. **Consequences:** deploy quota burn, no clean deployment history, and real deploys buried in noise.
**Fix:** stop the loop, or add `swarm-coord` to `scripts/vercel-ignore.sh` (the `ignoreCommand` hook already exists).

## 🟠 D-2 · The repo points at the wrong Vercel project
`.vercel/project.json` → `prj_FNLAscEEU8pryngrSsIubHqzhUKc` = **`tmmt-command-center`**, which is **not git-linked**.
Production is `prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV` = **`tmmt-ops`**, linked to `AIXMOS537/TMMT`.
A `vercel` CLI deploy from this checkout targets the wrong project.

## 🟠 D-3 · Production env vars are unmanaged
The 2,197-error outage was **caused** by `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel Production. `/operators` threw the same error 6 times (2026-08-29→31). Tooling exists (`npm run check-env`, `ghl:sync-vercel`) but is not enforced pre-deploy.

## CI/CD — 🟢 genuinely good
| Workflow | Trigger | Does |
|---|---|---|
| `verify.yml` | PR + push to master | lint + **472 tests** + production build; no secrets needed; concurrency-cancelling |
| `pii-guard.yml` | push + PR | scans against `PII_DENYLIST` |
| `mission-daily.yml` | daily 13:00 UTC | free replacement for Vercel Pro cron |
| `session-autopilot.yml` | every 6h | auto-PR / auto-merge / prune `claude/*` branches |

`verify.yml` is the right gate. **Note:** it requires branch protection to be *enabled* to be a hard gate — the workflow comments say so explicitly, and whether it is enabled is **UNKNOWN** (not checkable read-only from here).

> `session-autopilot.yml` auto-merging branches is very likely a contributor to the **404 branches** and the swarm noise.

## Cron
| Schedule | Job |
|---|---|
| `0 4 * * *` | `/api/cron/journey-recompute` (Vercel) |
| `0 13 * * 1` | `/api/cron/marketing-kpi-ghl` (Vercel) |
| `0 13 * * *` | mission digest (GitHub Actions) |
| `0 */6 * * *` | session autopilot |
| daily | `generate_va_tasks()` (DB) — **the runaway generator** |

## Missing
- ❌ Staging environment
- ❌ Documented backup/restore or rollback drill (Supabase has PITR; untested)
- ❌ Uptime monitoring / alerting on `/api/health` — **the 2,197-error outage ran 13 days undetected**
- ❌ Migration application through the repo (the root of the 214-vs-41 drift)

**The strongest single infrastructure improvement available: an uptime check on `/api/leads/webhook` that pages a human.** It would have caught the outage on day one instead of day thirteen.
