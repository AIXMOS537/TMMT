# 14 — Current state snapshot

Source: SPEC §0.4, §0.5, §28, §32, §33; READINESS REPORT §0–§11; ROADMAP §2, §5 · **Snapshot date: 2026-09-21, reconciled 2026-09-22 (final consistency review)** · canon `origin/master` @ `4cca6835`

> **CURRENT** = everything in this file except "First milestone" (which is TARGET: the PM-00 → PM-01 plan). Nothing in the PM- plan has started by being written down.

This file goes stale. Re-verify anything you rely on (`git log`, prod catalog read-only, the task's `file:line`).

## Where repo and prod diverge (SPEC §0.4 labels)

| Label | What is there today |
|---|---|
| **CODE ON MASTER** (`4cca6835`, deployed) | 127 pages + 30 API routes; staff desk; lead store; `bookings` hold-only writer; `ghl-payment-sync.ts` (capability, never fired); middleware redirecting `/api/cron/*`; credit owner desk (CROA-gated); SMS agent (never ran live). **Not** here: the `partner_acquisition` fix, the profiles fix's CI regression, any GHL M-series code, any Credit C1 code |
| **CODE ON ACTIVE DEV BRANCH** (not deployed, no prod effect) | GHL router M0–M13 (`feat/ghl-router-m*`; positions per E6 2026-09-21: M0–M2 branch-only, M1 migration not applied; M3 dev-only; M4 dev CLI; M5/M6 design; M7–M13 planned — **the GHL track's latest integrated milestone report supersedes this**: the owner reports M0–M6 progressed on branches and M7 authorized as of 2026-09-22, not re-verified here, still nothing on master or prod; outbound GHL writes frozen); Credit C1 (`wt-credit-c1`, uncommitted; C2 = the next credit iteration, active on the credit branch per the owner, DESIGN/ACTIVE DEVELOPMENT, not on master); Phase 2A `sec/2a-profiles-regression` (A3/A4/A12 open); `sec/partner-acquisition-rls` @ `620e100e` (its migration **is** on prod; the branch is not on master) |
| **PRODUCTION DATABASE STATE** | `partner_acquisition` least-privilege policies (ledger `20260922005007`, REMEDIATED 2026-09-22 00:50Z, baton 9); `profiles` protected columns (ledger `20260921234148`, REMEDIATED 2026-09-21 23:41Z, baton 8); `lead_to_active_customer_trg` **enabled**; `bookings_no_overlap` live; `change_log` authenticated ALL `true` (OPEN); 279 migrations vs 89 repo files; `automation_outbox` 35 queued / 0 sent; 0 bookings; 0 GHL-sourced payment rows; `ghl_webhook_events` 0 |
| **PRODUCTION DEPLOYMENT STATE** | 2 Vercel crons whose handlers never run (307 to `/login`); 7 deployed edge functions, 1 in repo (`intake` v7 deployed unsafe, B-4); GHL env kill switches unset (V1/V4 default on); `session-autopilot.yml` LATENT RISK (auto-merge off, master unprotected); `mission-daily.yml` dead-green with a latent team broadcast; preview deploys use the prod DB; no staging DB |
| **DESIGN ONLY** | rental state machine, transition function, event log, hold expiry; payment architecture; e-sign; customer tier + portal; comms gateway/drainer; PM-05…PM-19 new build; GHL M5–M13; Credit S1–S7 |
| **PRESERVED-RESCUED HISTORICAL WORK** | customer portal (15), dealer desk (10), Fast Track core + migration, T08 invite flow, LOTOS docs (all UNIQUE AND RELEVANT); T06/0033/property-marketplace pages (UNIQUE BUT DEFERRED); T01a/T09 (DUPLICATE); 8 SUPERSEDED; 14 HISTORICAL REFERENCE; 8 NEEDS MANUAL REVIEW (T02, T03, T07 admin/GHL-notify/credit files, T10, T12, A02). Nothing rescued is automatically canonical; no bundle is automatically merged (SPEC §33) |
| **UNKNOWN / not in canon** | Remote support / "HailMary": no route, module, table or evidence mentions it in `AIXMOS537/TMMT`; outside this extraction |

**Security-defect statuses (SPEC §0.5):** SEC-01 REMEDIATED (prod; follow-ups open) · profiles (2A-A1) REMEDIATED · SEC-02 OPEN / OWNER ACTION · SEC-04 OPEN — LATENT RISK · SEC-06 OPEN / OWNER ACTION · SEC-25 OWNER ACTION · all others OPEN. Full per-defect table: `docs/product/_review/DEFECT_TRACEABILITY.md` (45 KD + 3 SEC-only ids, 0 orphans).

## In plain words

TMMT is a big, real app (127 pages + 30 API routes) that builds cleanly. It holds about 890 leads and has a carefully locked, owner-only credit engine. It **cannot run a rental end to end**: there are no bookings, no e-sign, no proof of payment, no customer login and no customer messaging (35 emails are queued; none was ever delivered).

## What works

- Staff sign-in and the 29-screen rentals desk (28 reachable by staff; RLS reads, allow-listed `adminUpsert` writes).
- Lead capture: `web-lead-intake` and the off-repo GHL poller (the only 2 of 27 intake surfaces carrying traffic).
- Background-check queue and decision trail.
- Quote, price floor and hold with the live overlap guard (tested; never exercised: 0 bookings).
- The credit owner desk on the gated path; the CROA gate refuses letter storage as designed.
- Webhook signature checks (GHL, Stripe, Twilio, Cal).
- The rescue dispatch cockpit.
- Internal notifications (Slack/Telegram), fire-and-forget. **Internal only — this is not customer messaging.**
- pg_cron jobs (7-day history clean). **Not** the Vercel crons.
- RLS fails closed everywhere. Profiles columns are protected (REMEDIATED on prod 2026-09-21). `partner_acquisition` is least-privilege (REMEDIATED on prod 2026-09-22).

## What is broken

1. No customer path (`/status/[token]`, `/intake*` login-walled; `customer` → `/no-access`) (KD-08).
2. 8 machine APIs 307'd to `/login`; both Vercel crons' handlers never run (KPI last written 2026-05-20) (KD-11). Fixing it is not one line: mission-daily pairing (KD-12), duplicate recompute (KD-36), `/api/license/*` has no credential.
3. The operator sign-in loops (KD-15).
4. 7 screens read 14 ghost tables (KD-16).
5. Silent data loss: intake audit (ghost `activity_logs`), un-awaited side effects, GHL events consumed before processing (FS-01…FS-23).
6. Column drift: `amount_past_due`, `active_customers.email`, `vin_number` (KD-17).
7. 25/31 payments Overdue by a date sweep (KD-20).
8. Empty GHL stage map → every stage `inquiry` (KD-21).
9. Credit `[id]` ungated generator (KD-28).
10. Voice agent 500 without an org slug (KD-27).
11. Twilio inbound: 0/9 orgs have a number.
12. "Dashboard" → marketing; the portal nav leaks owner links + `__MARKETING_SITE__` (KD-30).
13. mission-daily green while doing nothing (KD-12).
14. 2 unit tests fail on Windows; one guard passes vacuously (KD-39).
15. `lead_to_active_customer_trg` is enabled on prod and fabricates "Active" rows from lead text (KD-07); it is not a rental lifecycle.

## What is missing

The rental state machine, e-sign, processor-verified payments, customer messaging delivery, customer login + per-person access, the person spine, vehicle owners, extensions/returns/tolls/reconditioning, per-org GHL, credit tracking/outcome/customer pages, isolation tests in CI, a non-prod DB, and a repo that can rebuild prod.

## Build / test baseline (this worktree, 2026-09-21)

install PASS · lint PASS (0 errors, 39 warnings) · `tsc --noEmit` PASS · `next build` PASS (no env; 151 static pages; 122 dynamic routes not executed) · vitest **2320 pass / 2 fail (Windows-only: `git ls-files` quoting, CRLF) / 14 skip** · SQL rehearsals 8/11 (2 undetermined path args, 1 red by design) · CI = vitest + lint + typecheck + build (+ brand:check) only; **E2E not in CI**. Compiling ≠ healthy.

## Production readiness checklist (SPEC §32)

| # | Item | State |
|---|---|---|
| 1 | P0/HIGH security findings closed | OPEN (profiles REMEDIATED 09-21; **SEC-01 REMEDIATED on prod 09-22, branch not landed**; SEC-02 OWNER ACTION; SEC-03…SEC-07 OPEN) |
| 2 | Public signup closed / invite server-side | OPEN / OWNER ACTION REQUIRED (unverified) |
| 3 | Auto-merge removed; mission-daily neutered | OPEN (LATENT RISK; owner) |
| 4 | Crons/machine APIs reachable with secrets only | OPEN |
| 5 | Isolation + privilege tests in CI | OPEN |
| 6 | Non-production DB | OPEN (GHL B-7) |
| 7 | Repo can rebuild prod | OPEN |
| 8 | Rental state machine | MISSING |
| 9 | Processor-verified payments | MISSING |
| 10 | E-sign with audit trail | MISSING |
| 11 | Customer auth + per-person RLS | MISSING |
| 12 | Gated send gateway + drainer + consent test | MISSING |
| 13 | GHL per-org, webhook inbox, no GHL-set state | PLANNED ONLY (GHL track) |
| 14 | Live lead feed in-repo with health alert | OFF-REPO |
| 15 | Observability (scrubbed Sentry, health, reconciliation) | PARTIAL |
| 16 | ⚖️ Legal (CROA/VDACS, FCRA, TCPA, agreements, adverse action) | OPEN |
| 17 | Rollback runbook | EXISTING FOUNDATION |
| 18 | Backups/restore verified | UNKNOWN |

## Top blockers

**Security:** SEC-01 `partner_acquisition` REMEDIATED on prod (branch still to land; exposure not proven absent) · AUTH-SIGNUP-001 (OWNER ACTION, unverified) · unprotected master + latent auto-merge (LATENT RISK) · middleware/mission-daily pairing · GHL-tag payments (capability, latent) · DNC bypass on GHL writes · open redirect · global `is_staff()` · no isolation tests in CI.
**Product:** no state machine (plus an enabled trigger that fabricates rentals) · no verified payments · no e-sign · no customer login · no safe messaging (queued ≠ delivered) · two vehicle tables / 9+ person tables · repo cannot rebuild prod.

## Owner decisions needed soonest

Signup toggle · session-autopilot and mission-daily · GHL kill-switch env values · read-only catalog access · `/api/license/*` option · canonical vehicle table and the fate of the 43 `fleet` rows · role source of truth · customer portal URL shape · payment processor · signing provider · D-22b (credit) · a non-production Supabase · `internal_team` access to `partner_acquisition` (product decision, not the P0).

## Open PRs (2026-09-21)

#255 `feat/partner-acquisition` (**hold** until `sec/partner-acquisition-rls` lands on master and the owner releases it) · #251 `feat/inspection-walkaround` · #243 DRAFT `comms/g02-internal-destinations` (G-02) · #232 `carry/tmmt-front-door-on-master`.

## First milestone

**PM-00 Security containment** (`FORGE_TASKS/INDEX.md`, tasks TMMT-SEC-001…008, TMMT-DATA-001), in this order:
1. Owner decisions: signup (00-b), session-autopilot (00-c), mission-daily (00-d), kill-switch env (00-e).
2. Land branch `sec/partner-acquisition-rls` @ `620e100e` on master (00-a is REMEDIATED on prod; TMMT-SEC-008 records the ledger version; nobody re-does the policy).
3. One small code PR each: open redirect (00-i), GHL payment guard (00-f), DNC before outbound GHL writes (00-h), the V4 precedence fix (00-e), with tests. The GHL track reviews the webhook-file changes.
4. Prepared + rehearsed for owner + baton: trigger disable (00-g), `change_log` policy (00-j).

**Then PM-01** (reproducible build / CI truth). The middleware machine-route fix ships **only after** mission-daily is made safe.
