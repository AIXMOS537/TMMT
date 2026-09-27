# DEFECT TRACEABILITY — every KD-xx / SEC-xx → status + owner (2026-09-22)

- **Source of ids:** `TMMT_MASTER_BUILD_SPEC.md` §28 (KD-01…KD-45) and §20.3 (SEC-01…SEC-25). Severity is the spec's original rating.
- **Status vocabulary (SPEC §0.5):** OPEN · REMEDIATED · MITIGATED · BLOCKED · OWNER ACTION · ACCEPTED LIMITATION · UNKNOWN. A fixed prod defect is REMEDIATED even if an evidence file predates the fix; an open defect stays OPEN even if a task exists for it.
- **Owner kinds:** PM milestone (+ Forge task) · explicit ROADMAP backlog item · security workstream · GHL Mx · Credit Sx/C1 · Phase 2A Ax · accepted limitation · explicit deferred item. **Rule: zero orphans.** Two ids had no owner before this review and were added to the roadmap: **KD-38 → PM-16a backlog**, **SEC-20 → PM-17 gate**.
- Verified facts used: `partner_acquisition` REMEDIATED on prod 2026-09-22 00:50Z (ledger `20260922005007`, baton 9, `620e100e`); `profiles` REMEDIATED 2026-09-21 23:41Z (ledger `20260921234148`, baton 8); AUTH-SIGNUP-001 unverified; auto-merge LATENT RISK; `lead_to_active_customer_trg` enabled; 0 GHL payment rows; 35 queued / 0 sent.

## 1. The 45 numbered defects (SPEC §28)

| KD | Sev | Defect (short) | SEC | Status | Owner (milestone / task / track) | Notes |
|---|---|---|---|---|---|---|
| KD-01 | P0 (hist.) | `partner_acquisition` authenticated ALL true (+ anon insert) | SEC-01 | **REMEDIATED** (prod 2026-09-22) | security workstream `sec/partner-acquisition-rls` → landing via PM-00 00-a / TMMT-SEC-008 | follow-ups tracked separately: branch landing, `KNOWN_UNAPPLIED` 54→53, `internal_team` access = owner product decision; exposure "no evidence found", not "no access" |
| KD-02 | HIGH | Public signup bypasses invite (AUTH-SIGNUP-001) | SEC-02 | **OPEN / OWNER ACTION** | owner via Phase 2A A4a (toggle) / A4b (server invite); PM-00 00-b; PM-19 TMMT-AUTH-004 integrates with A4b | unverified 2026-09-22; containment ≠ tenant authz |
| KD-03 | HIGH | `is_staff()` global → cross-org staff access | SEC-03 | **OPEN** | PM-02 #5 (TMMT-DATA-003 pilot) + GHL M9 (isolation matrix) | phased by table group |
| KD-04 | HIGH | master unprotected + latent auto-merge | SEC-04 | **OPEN — LATENT RISK** | PM-00 00-c (TMMT-SEC-004) + owner merge-control plan (SPEC §27 #3) | not an incident; not resolved |
| KD-05 | HIGH | GHL tag/event → "Paid" + commission + tokens | SEC-05 | **OPEN** (latent; code capability, never fired) | PM-00 00-f (TMMT-SEC-002) contain; PM-06 (TMMT-PAY-001) durable | |
| KD-06 | HIGH | GHL stage auto-verifies rental/case state (V1), default on; V4 payload override | – | **OPEN** (latent) | PM-00 00-e (TMMT-SEC-007) contain; PM-05 TMMT-RENT-006 (TMMT side); GHL M6/M7 (inbound side) | |
| KD-07 | HIGH | `lead_to_active_customer_trg` fabricates Active rentals (enabled on prod) | – | **OPEN** | PM-00 00-g (TMMT-DATA-001, baton) | not a rental lifecycle |
| KD-08 | HIGH | No customer path (`/status/[token]`, `/intake*` walled; tier `none`) | – | **OPEN** | PM-19 (TMMT-AUTH-001, AUTH-002) | |
| KD-09 | HIGH | Deployed edge `intake` v7 / `capture-drive` not in repo | SEC-06 | **OPEN / OWNER ACTION** | GHL track B-4/B-5 (owner decision); PM-00 00-k visibility | |
| KD-10 | HIGH | ANON-TENANT-001 (6 tables, caller-chosen org) | SEC-07 | **OPEN** | GHL M1 (B-6); `vehicle_handover` slice PM-08 TMMT-HAND-001 | M1 migration not applied |
| KD-11 | MEDIUM | Middleware 307s 8 machine APIs; crons' handlers never run | SEC-11 | **OPEN** | PM-01 #1 (TMMT-BUILD-001, after TMMT-SEC-005) | `/api/license/*` split out (SI-05) |
| KD-12 | MEDIUM | mission-daily green on 307; latent team broadcast | – | **OPEN** (latent) | PM-00 00-d (TMMT-SEC-005) | prerequisite of KD-11's fix |
| KD-13 | MEDIUM | DNC bypass on outbound GHL tag/field/stage + email branch | SEC-08 | **OPEN** | PM-00 00-h (TMMT-SEC-003); GHL M8 / PM-18 absorb later | |
| KD-14 | MEDIUM | Open redirect in auth callback | SEC-09 | **OPEN** | PM-00 00-i (TMMT-SEC-001) | |
| KD-15 | MEDIUM | Operator sign-in redirect loop (R2) | – | **OPEN** | PM-19 (TMMT-AUTH-003) | |
| KD-16 | MEDIUM | 14 ghost tables; 7 screens broken at runtime | – | **OPEN** | PM-02 #7 (TMMT-ADR-001 ADR-05, TMMT-DATA-002) | per-table owner decision |
| KD-17 | MEDIUM | Column drift (`amount_past_due`, `email`, `vin_number`) | – | **OPEN** | PM-02 #7 (TMMT-DATA-002) | |
| KD-18 | MEDIUM | GHL event id consumed before processing → lost events | – | **OPEN** | GHL M6 (webhook inbox) | no PM task by design |
| KD-19 | MEDIUM | Payment dedupe by `notes ILIKE`; `payments.external_id` not unique | – | **OPEN** | PM-06 (TMMT-PAY-001 decides; PM-06 build) | |
| KD-20 | MEDIUM | `sweep_overdue_payments` Overdue by date only | – | **OPEN** | PM-06 (TMMT-PAY-002) | |
| KD-21 | MEDIUM | Stage map empty → every stage `inquiry` | – | **OPEN** | GHL M4 / M7 | no PM task by design |
| KD-22 | MEDIUM | Outbox 35 queued, no drainer; enqueue without DNC | – | **OPEN** | PM-18 (TMMT-COMM-001, COMM-004) consuming GHL M8 design | queued ≠ delivered |
| KD-23 | MEDIUM | Lead webhook anonymous overwrite + duplicate breeding | SEC-14 | **OPEN** | GHL M8 (lp-leads-webhook, one of the 8 unsafe writers) | |
| KD-24 | MEDIUM | `change_log` authenticated ALL true | SEC-12 | **OPEN** | PM-00 00-j (TMMT-SEC-006, baton) | |
| KD-25 | MEDIUM | `org_roles` 42P17 recursion | SEC-13 | **OPEN** | **Phase 2A A12** (PM-02 #6 = reference only, SI-09) | |
| KD-26 | MEDIUM | Staff sign any `staff-documents` path cross-org | SEC-15 | **OPEN** | PM-02 #9 (TMMT-DATA-005); PM-07 consumes (SI-03) | |
| KD-27 | MEDIUM | Voice agent nil-UUID fallback → 500; no owner hold | SEC-18 | **OPEN** | PM-15 (TMMT-AI-001) | |
| KD-28 | MEDIUM | Credit `[id]` ungated; arbitrary payload; CPN ban unenforced | SEC-17 | **OPEN** | **Credit C1** (credit track) | no PM task by design |
| KD-29 | MEDIUM | `is_internal_ops()` includes investor; `rental_ledger` investor writes | SEC-19 | **OPEN** | PM-02 #4/#8 (TMMT-DATA-004; tell C1) | |
| KD-30 | MEDIUM | Portal nav leaks owner links + `__MARKETING_SITE__`; Dashboard → marketing | – | **OPEN** | PM-19 (TMMT-AUTH-003) | |
| KD-31 | MEDIUM | `vehicle_handover` anon insert (typed-name signature) | – | **OPEN** | PM-08 (TMMT-HAND-001) coordinated with GHL M1 | |
| KD-32 | MEDIUM | Repo cannot rebuild prod (279 vs 89; no rental-core DDL; 6/7 edge fns missing) | – | **OPEN** | PM-01 #4 (TMMT-BUILD-003) + GHL M2 (intake/GHL tables) | edge functions: owner decision per function (SPEC §30 #4) |
| KD-33 | MEDIUM | Single live lead feed = off-repo laptop job, silent 5,000 cap | – | **OPEN** | PM-17 (TMMT-OPS-002 visibility) + GHL M5/M6 (retire the poller) | poller itself is owner-operated (M1 sync boundary) |
| KD-34 | MEDIUM | Default ACL re-grants TRUNCATE to anon/authenticated on new `supabase_admin` tables | SEC-16 | **OPEN** → MITIGATED when TMMT-BUILD-007 lands | PM-01 #6 (checklist + static test); DB-level default-ACL change = owner decision (explicit deferred item) | |
| KD-35 | LOW | `cases` double status-history triggers | – | **OPEN** | PM-10 (TMMT-MAINT-001) | |
| KD-36 | LOW | Journey recompute runs twice (pg_cron + Vercel) | – | **OPEN** | PM-01 #2 (TMMT-BUILD-006) | must land with/before BUILD-001 |
| KD-37 | LOW | Contract PDF replace deletes previous version | – | **OPEN** | PM-07 (TMMT-DOC-001) | |
| KD-38 | LOW | `/learn/status` invents `AIX-STUB-` references | – | **OPEN** | **ROADMAP PM-16a backlog item (added 2026-09-22)**; credit track owns any real content behind it | was the only orphan; now owned |
| KD-39 | LOW | Windows CRLF / glob test fragility; vacuous guard | – | **OPEN** | PM-01 #5 (TMMT-BUILD-004) | |
| KD-40 | LOW | PII in logs; no Sentry scrubber | SEC-21 | **OPEN** | PM-17 (TMMT-OPS-001) | |
| KD-41 | LOW | Stale comments (`BOOKING_GUARD_NOTE`, `rate-limit-durable.ts`, `(admin)/layout.tsx`) | SEC-24 | **OPEN** | PM-01 #6 (TMMT-BUILD-007) | |
| KD-42 | LOW | `insurance.login_*` credential columns | SEC-23 | **OPEN** | PM-02 #8 (TMMT-DATA-004) | |
| KD-43 | LOW | `aria/` unauthenticated chat (not deployed) | SEC-22 | **OPEN** → MITIGATED when TMMT-AI-002 lands | PM-15 (TMMT-AI-002 quarantine); deletion = owner decision (explicit deferred item) | |
| KD-44 | LOW | 6 unlinked screens; `/whoami` denied to tier `none` | – | **OPEN** | PM-19 (TMMT-AUTH-003, owner decision on R6) | |
| KD-45 | LOW | Local gate `verify.sh` skips `tsc` | – | **OPEN** | PM-01 #5 (TMMT-BUILD-005) | |

**Totals:** 45 defects · REMEDIATED 1 (KD-01) · OPEN / OWNER ACTION 2 (KD-02, KD-09) · OPEN — LATENT RISK 1 (KD-04) · OPEN 41 (of which 2 become MITIGATED when their task lands: KD-34, KD-43) · orphans **0**.

## 2. SEC ids with no KD number, plus the other prod fix

| ID | Sev | Finding | Status | Owner |
|---|---|---|---|---|
| SEC-10 | MEDIUM | No tenant-isolation or privilege regression tests in CI | **OPEN** | PM-01 (TMMT-BUILD-002) + Phase 2A A3 + GHL M9 + PM-19 (TMMT-AUTH-005) |
| SEC-20 | MEDIUM | PARTNER-TENANT-001 caller-chosen tenant on partner telemetry | **OPEN** | GHL track B-8; **ROADMAP PM-17 gate (added 2026-09-22)**: closed before the first external partner |
| SEC-25 | OWNER | Credential rotation, Docker port firewall, secret clean-up, watchdog, staff password rotation | **OWNER ACTION** | owner (Phase 2A A7–A11) |
| X2 / 2A-A1 | P0 (hist.) | `profiles` self-escalation to admin | **REMEDIATED** (prod 2026-09-21 23:41Z, ledger `20260921234148`, baton 8) | Phase 2A; CI regression A3 still OPEN |

## 3. Owner-kind summary

| Owner kind | Defects |
|---|---|
| PM-00 (TMMT-SEC-001…008, TMMT-DATA-001) | KD-01 (landing), KD-02 (00-b), KD-04, KD-05, KD-06, KD-07, KD-12, KD-13, KD-14, KD-24 |
| PM-01 | KD-11, KD-32, KD-34, KD-36, KD-39, KD-41, KD-45, SEC-10 |
| PM-02 | KD-03, KD-16, KD-17, KD-26, KD-29, KD-42 |
| PM-19 | KD-08, KD-15, KD-30, KD-44 (+ KD-02 integration via AUTH-004) |
| PM-05 / PM-06 / PM-07 / PM-08 / PM-10 | KD-06 (RENT-006), KD-19, KD-20, KD-37, KD-31, KD-35 |
| PM-15 / PM-16a backlog / PM-17 | KD-27, KD-43, KD-38, KD-33, KD-40, SEC-20 (gate) |
| PM-18 | KD-22 |
| GHL track (M1, M4, M6, M7, M8, B-4/B-5, B-8) | KD-09, KD-10, KD-18, KD-21, KD-23, SEC-20 |
| Credit track (C1) | KD-28 |
| Phase 2A (A1 done, A3, A4a/b, A7–A12) | X2 (done), KD-02, KD-25, SEC-25 |
| Security workstream `sec/partner-acquisition-rls` | KD-01 (done on prod; landing) |
| Explicit deferred / owner decision items | DB-level default ACL (KD-34), `aria`/`apps/engine` deletion (KD-43), edge functions per function (KD-32), `internal_team` access (KD-01 follow-up) |
| Accepted limitations | none declared by the owner at closeout (nothing is marked ACCEPTED LIMITATION) |
