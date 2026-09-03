# 37 · MASTER BACKLOG

Working list. `[E]` effort: XS <1h · S <½d · M 1–3d · L 1–2wk. Ordered by priority, then dependency.

## P0 — stop everything
| ID | Task | E | Evidence |
|---|---|---|---|
| P0-1 | Stop `swarm-coord` deploy loop (or add to `vercel-ignore.sh`) | XS | 20/20 deployments BLOCKED |
| P0-2 | Run the 3 read-only SELECTs (`00…` §7) | XS | Confirms root cause + traffic |
| P0-3 | Reconcile org identity: UUID everywhere, one place | S | `tenant-map.generated.ts:38,60,82` vs `tenant.ts:60` |
| P0-4 | Deploy and **verify a real lead lands** | S | 2,381 total failures |
| P0-5 | Uptime alert on `/api/leads/webhook` + `/api/health` | S | 13-day undetected outage |

## P1 — critical
| ID | Task | E | Evidence |
|---|---|---|---|
| P1-1 | Repoint `.vercel/project.json` → `tmmt-ops` | XS | wrong project id |
| P1-2 | `migrations-pull.mjs --dry-run` → review → commit ~173 | S | 214 applied / 41 in repo |
| P1-3 | Generated DB types + `createClient<Database>` in CI | S | kills silent-`undefined` bug class |
| P1-4 | REVOKE anon EXECUTE: 4 trigger fns + 3 identity helpers | S | 12 anon definer fns |
| P1-5 | Add `outreach_touches` RLS policy | XS | 0 rows, fails closed |
| P1-6 | Stop `generate_va_tasks()` | XS | 17,806 rows, +614/2d |
| P1-7 | Test: lead-webhook happy path | S | would have caught P0-3 |
| P1-8 | Audit `onboard_org_member`, `tmmt_token_grant`, `bg_check_decide` | M | privilege escalation unverified |
| P1-9 | **Owner decision:** `moe_legacy` tenant | — | `tenant-map.generated.ts:60` |
| P1-10 | **Owner action:** work the 81 approved + 104 waitlisted | ongoing | only near-term revenue |
| P1-11 | Rename duplicate migration `20260827000000` | XS | undefined apply order |

## P2 — important
| ID | Task | E |
|---|---|---|
| P2-1 | `amount_cents` + backfill 32 free-text rows | L |
| P2-2 | Arrears automation: grace, late fee, `PAYMENT_ISSUE` | L |
| P2-3 | Decide `fleet` vs `vehicles`; archive loser | M |
| P2-4 | Decide `active_customers` vs `bookings`; archive loser | M |
| P2-5 | Supabase branch as staging | M |
| P2-6 | Consolidate 2 middleware files → 1 | S |
| P2-7 | Consolidate 3 public-path allowlists → 1 | S |
| P2-8 | Move `customer_payments_snapshot_20260706` out of `public` | S |
| P2-9 | Remove `lead_pool` call sites (`queries.ts`, `lead-pool.ts`, `referrals.ts`) | M |
| P2-10 | Run one AI agent end-to-end (document chase), approval-gated | L |
| P2-11 | Pin `search_path` on 3 agent-job fns | XS |
| P2-12 | Enable leaked-password protection | XS |
| P2-13 | Verify branch protection is actually enabled on `master` | XS |
| P2-14 | Log the real reason on login failure (`auth failed: {}`) | S |

## P3 — strategic
| ID | Task | E |
|---|---|---|
| P3-1 | **Airtable decision:** retire or formalise as Leads owner | M |
| P3-2 | Dedupe 6 person models → `people` | L |
| P3-3 | Tag valuable branches, then prune (12,788 unreachable commits) | M |
| P3-4 | Archive dispatch / ClickUp / counselor / marketplace | M |
| P3-5 | **Legal review of the dispute pathway** — before any dispute code | — |
| P3-6 | Rewrite or date-stamp `ARCHITECTURE.md`, `DATABASE-SCHEMA.md` | M |
| P3-7 | RLS integration tests beyond `dispatch-rls` | L |

## P4 — when rentals restart (gated on vehicles existing)
| ID | Task | E |
|---|---|---|
| P4-1 | `bookings` wired up **with `tstzrange` EXCLUDE constraint** | L |
| P4-2 | Vehicle state machine + transition history | L |
| P4-3 | In-form camera capture → Supabase Storage | L |
| P4-4 | Real FK payments → `fleet.id` (replace name string-match) | M |
| P4-5 | E-signature + ID verification integrations | L |
| P4-6 | Deposit policy — **written by the owner first**, then coded | M |

## Frozen (do not start)
Multi-tenancy · dealer/white-label · dispute engine · new AI agents · new route groups · new docs.

## Owner-gated (never auto-executed)
Outbound sends · payments/refunds · `moe_legacy` decision · legal review · `git gc` · `~/HAILMARY` classification.
