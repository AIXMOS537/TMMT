# 33 · 90-DAY ROADMAP

**Governing rule: nothing new ships until something existing has a paying user.**

## WEEK 1 — Restore the pipe
| # | Objective | Why | Depends | Effort | Impact |
|---|---|---|---|---|---|
| 1 | Stop the `swarm-coord` deploy loop | 20/20 deploys BLOCKED — nothing can ship | — | 30 min | **Unblocks everything** |
| 2 | Run the 3 read-only SELECTs | Confirms P0-1 root cause + whether leads flow | — | 10 min | Evidence |
| 3 | Fix org-identity (UUID vs slug), deploy, **watch a lead land** | All inbound leads lost since 8-19 | 1,2 | 2–4 h | **Restores revenue path** |
| 4 | Uptime alert on `/api/leads/webhook` | Outage ran **13 days** undetected | 3 | 1 h | Prevents recurrence |
| 5 | Repoint `.vercel/project.json` → `tmmt-ops` | CLI deploys hit the wrong project | — | 5 min | Correctness |

**Week 1 exit test:** a lead submitted on the live site appears in `incoming_leads`, and an alert fires if it stops. **Nothing else counts.**

## WEEKS 2–4 — Harvest what you already own
| # | Objective | Why | Effort | Impact |
|---|---|---|---|---|
| 6 | **Call the 81 approved + 104 waitlisted** | Consented, in GHL, **needs zero code** | ongoing | **Only near-term revenue** |
| 7 | `migrations-pull.mjs --dry-run` → commit ~173 migrations | Repo cannot rebuild prod | 3 h | Reproducibility |
| 8 | Generated DB types + `createClient<Database>` in CI | Kills the silent-`undefined` bug class | 3 h | **Prevents repeat of Interfaces bug** |
| 9 | Revoke anon EXECUTE on 4 trigger fns + 3 identity helpers | Unauth writes; tenancy enumeration | 2 h | Security |
| 10 | Add `outreach_touches` RLS policy | Fails closed → outreach cannot record | 30 min | Unblocks outreach |
| 11 | Stop `generate_va_tasks()` | 17,806 rows, no consumer | 15 min | Signal clarity |
| 12 | One test: lead-webhook happy path | **Would have caught P0-1** | 2 h | Regression guard |
| 13 | Owner decision: `moe_legacy` tenant | Governance conflict | — | Sovereignty |

## MONTH 2 — Make money legible
| # | Objective | Why | Effort |
|---|---|---|---|
| 14 | `amount_cents` + backfill 32 free-text rows | **Nothing financial is automatable until this** | 1 wk |
| 15 | Collections/arrears: 3-day grace, $25/day, `PAYMENT_ISSUE` | **The failure that killed the business** | 1 wk |
| 16 | Audit `onboard_org_member`, `tmmt_token_grant`, `bg_check_decide` | Privilege escalation unverified | 3 d |
| 17 | Decide `fleet` vs `vehicles`, `active_customers` vs `bookings`; archive loser | Duplicate models caused the Interfaces bug | 3 d |
| 18 | Supabase branch as staging | Every change currently hits prod | 2 d |
| 19 | Run **one** AI agent end-to-end (document chase), draft-never-send | Proves the built pipeline works | 1 wk |
| 20 | Archive dispatch, ClickUp, counselor, marketplace | Dead weight | 2 d |

## MONTH 3 — Rebuild the rental core, only if there are cars
**Gate: are there vehicles and customers again?**

**If YES:**
| # | Objective | Effort |
|---|---|---|
| 21 | `bookings` wired up **with `tstzrange` EXCLUDE constraint** | 1 wk |
| 22 | Vehicle state machine + transition history | 1 wk |
| 23 | In-form camera capture → Storage | 1 wk |
| 24 | Real FK payments → `fleet.id` | 2 d |
| 25 | Tests for all of the above | ongoing |

**If NO:** do none of it. Spend Month 3 on credit/funding referral conversion (guidance-only, licensed-safe) against the 876 leads and 1,642 contacts, and consolidate the duplicate models so the eventual restart is clean.

## Explicitly NOT in 90 days
Multi-tenancy · dealer/white-label · dispute engine · new AI agents · new route groups · new documentation.

## Owner-gated (never auto-executed)
Any outbound send · any payment/refund · the `moe_legacy` decision · legal review of the dispute pathway · `git gc` on the 12,788 unreachable commits.
