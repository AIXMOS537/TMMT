# FORGE TASKS — INDEX

- **Canon:** `AIXMOS537/TMMT` `origin/master` @ `4cca6835` · **Spec:** `docs/product/TMMT_MASTER_BUILD_SPEC.md` (SPEC) · **Roadmap:** `TMMT_ROADMAP.md` · **Context pack:** `docs/product/TMMT_BUILDER_CONTEXT/` · **Prompt:** `docs/product/TMMT_BUILDER_MASTER_PROMPT.md` · **Spec issues:** `docs/product/S2_SPEC_ISSUES.md`
- **Rules:** one task per PR; every task file has the same 17 headings; nothing here is started by being listed. Every task is justified by a SPEC defect/section or a ROADMAP item (last column). Tasks owned by another track are **not** here — see "Coordination" below.
- **Reconciled 2026-09-22:** the `partner_acquisition` P0 (SEC-01/KD-01) is **REMEDIATED on prod** (ledger `20260922005007`, prepared commit `620e100e`, branch not merged); only the branch landing remains (TMMT-SEC-008, a record/landing task owned by that session — no policy work). AUTH-SIGNUP-001 is **OPEN / OWNER ACTION**, unverified. Every task's spec requirement, defect ids, dependencies, owned surface, acceptance criteria, tests, STOP boundary and ownership-collision check are tabulated in `docs/product/_review/FORGE_TRACEABILITY.md` (57 tasks; 0 deleted; 4 rewritten on 2026-09-22: SEC-008, AUTH-004, AUTH-005, RENT-006).
- **Size** S/M/L is a planning guess. **Owner-gated?** names the gate: `decision` (owner must choose), `baton` (prod write baton to apply staged SQL / env / cron), `env` (Vercel env change), `⚖️` (legal review), `merge` only (every merge is an owner action + baton because merge = deploy; listed as "merge" when nothing else is gated).

## 1. Task table

| ID | Title | PM | Depends on | Size | Owner-gated? | Traces to (SPEC / ROADMAP) |
|---|---|---|---|---|---|---|
| TMMT-SEC-001 | Close the open redirect in the auth callback | PM-00 | – | S | merge | SEC-09, KD-14; ROADMAP 00-i |
| TMMT-SEC-002 | GHL tags/events never create "Paid" / commission / tokens | PM-00 | GHL track review | S | merge | SEC-05, KD-05, V2/V2b, §11.2; 00-f |
| TMMT-SEC-003 | DNC / opt-out gate before outbound GHL tag/field/stage writes + email branch | PM-00 | GHL track review | M | merge | SEC-08, KD-13, §16; 00-h |
| TMMT-SEC-004 | Neutralise `session-autopilot.yml` auto-merge / branch delete | PM-00 | – | S | decision | SEC-04, KD-04, §27; 00-c |
| TMMT-SEC-005 | `mission-daily.yml` owner-only, no-notify, fail on non-2xx (before BUILD-001) | PM-00 | – | S | decision | SEC-11, KD-12, FS-17, §27; 00-d |
| TMMT-SEC-006 | `change_log` authenticated `ALL true` → staff-scoped (staged) | PM-00 | catalog access or BUILD-003 | S | baton | SEC-12, KD-24; 00-j |
| TMMT-SEC-007 | GHL kill switches provable; payload cannot override `GHL_FORM_AUTO_CASE=false` | PM-00 | GHL track review | S | env + baton | V1, V4, KD-06; 00-e; SI-04 |
| TMMT-SEC-008 | Land `sec/partner-acquisition-rls` @ `620e100e` (ledger `20260922005007`, `KNOWN_UNAPPLIED` 54→53); record only, no policy work | PM-00 | other session (branch owner) | S | merge | SEC-01, KD-01 (REMEDIATED on prod); 00-a; SI-01 |
| TMMT-DATA-001 | Disable `lead_to_active_customer` trigger (staged + rehearsed) | PM-00 | catalog access or BUILD-003 | S | baton + decision | KD-07, §10.4; 00-g |
| TMMT-BUILD-001 | Middleware: machine APIs reach their own auth (never 307) | PM-01 | **SEC-005 merged**; decision on `/api/license/*` | M | decision + merge | SEC-11, KD-11, R1; PM-01 #1; SI-05 |
| TMMT-BUILD-002 | PGlite SQL rehearsals in CI | PM-01 | coordinate 2A-A3, GHL M2/M9 | M | merge | SEC-10, §25.1; PM-01 #3; SI-06 |
| TMMT-BUILD-003 | Ledger-drift reconciliation: prod schema snapshot + version map | PM-01 | read-only catalog access; GHL M2 table list | L | decision (access) | KD-32, §9.6, §30 Rule 0; PM-01 #4 |
| TMMT-BUILD-004 | Windows-safe tests: LF, cross-platform listing, zero-target sentinels | PM-01 | – | S | merge | KD-39, FS-20, §4.4; PM-01 #5 |
| TMMT-BUILD-005 | `tsc` in `verify.sh`; `pii-guard` fails when denylist unset | PM-01 | owner confirms secret | S | decision | KD-45, FS-22; PM-01 #5 |
| TMMT-BUILD-006 | Remove the duplicate journey recompute | PM-01 | decision A/B; with/before BUILD-001 | S | decision (+baton for B) | KD-36, §17; PM-01 #2 |
| TMMT-BUILD-007 | Stale comments + migration CHECKLIST (default-ACL REVOKE) | PM-01 | – | S | merge | SEC-16, SEC-24, KD-41, §30 #5; PM-01 #6 |
| TMMT-ADR-001 | ADR pack: vehicle, role source, tenancy column, `active_customers`, command queue | PM-02 | BUILD-003 helpful | M | decision | §9.3, §13, §2.2, §10.4; PM-02 #1,3,4,7 |
| TMMT-DATA-002 | Column drift fixes + static schema-reference check (ghost tables tracked) | PM-02 | BUILD-003, ADR-001, SEC-002 | M | decision + merge | KD-16, KD-17, FS-04/12/19; PM-02 #7 |
| TMMT-DATA-003 | Per-org staff scope pilot (`is_staff_of`, rental-core group; staged) | PM-02 | ADR-001 (roles), BUILD-003; coordinate GHL M9, 2A-A12 | L | baton + decision | SEC-03, KD-03, §25.2; PM-02 #5 |
| TMMT-DATA-004 | Investor out of `is_internal_ops()`; `rental_ledger` investor writes; drop `insurance.login_*` (staged) | PM-02 | BUILD-003; tell credit C1 | S | baton | SEC-19, SEC-23, KD-29, KD-42; PM-02 #4, #8 |
| TMMT-DATA-005 | `staff-documents` signed URLs scoped by org (+ bucket policy, staged) | PM-02 | DATA-003 helper (or interim), BUILD-003 | S | baton | SEC-15, KD-26; PM-02 #9; SI-03 |
| TMMT-AUTH-001 | `/intake*` and `/status/[token]` public in middleware + writer audit | PM-19 | BUILD-001 (same file); 00-b noted | S | merge | KD-08, R3, X6; PM-19 #1 |
| TMMT-AUTH-002 | `customer` tier + home, own-records read (interim `current_profile_email()`) | PM-19 | AUTH-001, ADR-001 (roles), URL-shape decision | M | decision (+baton if policy) | KD-08, §2.1, §5.16; PM-19 #2, #4; SI-10 |
| TMMT-AUTH-003 | Operator loop (R2), Dashboard link (R4), portal nav leak (R5), orphans (R6) | PM-19 | decision on R6 | S | decision | KD-15, KD-30, KD-44; PM-19 #5 |
| TMMT-AUTH-004 | Server-issued customer invite / claim flow (no AUTH-SIGNUP-001 reopening) | PM-19 | AUTH-002; **Phase 2A A4a/A4b coordination** | M | decision (+baton if migration) | SEC-02, KD-02, §5.17; PM-19 #3 |
| TMMT-AUTH-005 | Tier × route-group matrix test in CI (8 tiers + signed-out) | PM-19 | after BUILD-001, AUTH-001/002/003 (or before, then update) | M | merge | §25.2 Permissions, §5.17; PM-19 exit |
| TMMT-RENT-001 | ADR: rental status vocabulary + event log design | PM-05 | ADR-001, BUILD-003 | S | decision | §10.1–§10.3; PM-05 #1; SI-08 |
| TMMT-RENT-002 | Transition function + append-only event log (staged, rehearsed) | PM-05 | RENT-001; **DATA-001 applied**; **SEC-007 env off**; ADR-001 | L | baton | §10.2 rules 1–3, §25.2 Rental; PM-05 #1 |
| TMMT-RENT-003 | No direct `bookings.status` writes: RLS/column guard + static guard | PM-05 | RENT-002 | M | baton + decision | §10.5 #2–#3, §10.2 rule 1; PM-05 #2 |
| TMMT-RENT-004 | Hold expiry + system sweep through the function (staged cron) | PM-05 | RENT-002/003; TTL decision | M | baton + decision | §10.1 HOLD, §10.3, §23.4; PM-05 #3 |
| TMMT-RENT-005 | Derived vehicle state view; `partner_vehicle_rentals()` reads status | PM-05 | ADR-001 (vehicle), RENT-001/002 | M | baton | §10.2 vehicle machine, §13, §5.4; PM-05 #4, exit |
| TMMT-RENT-006 | GHL stage → event request only; auto-ops path removed | PM-05 | RENT-002, SEC-007; **GHL M6/M7 review** | M | decision + merge | V1, V3, KD-06, §10.2 rule 2; PM-05 #5 |
| TMMT-RENT-007 | Desk board on new states; `active_customers`/`former_customers` read-only | PM-05 | RENT-002/003/005, ADR-001 (ADR-04), DATA-002 | M | baton + decision | §5.3, §10.4, §23.2; PM-05 #6–#7 |
| TMMT-COMM-001 | Outbox drainer (cloud, idempotent claim, **dry-run** default) | PM-18 | **GHL M8 design**, BUILD-001, SEC-003, COMM-002, COMM-004 before live | L | baton (migration, cron, `live` switch) | §16, KD-22, FS-16; PM-18 #1 |
| TMMT-COMM-002 | Consent at send (`assertSendAllowed`) + SoR §5.6 regression test | PM-18 | COMM-001, COMM-005 (else DND=unknown=blocked); G-02 audience | M | merge | §16 step 2, §21.1, §25.2 Comms; PM-18 |
| TMMT-COMM-003 | False-success senders fail loudly (FS-01/FS-02) | PM-18 | SEC-003 first; GHL track review | S | merge | FS-01, FS-02, §24 rule; PM-18 "fail on missing config" |
| TMMT-COMM-004 | DNC in DB enqueue paths + triage of 35 stuck rows (staged) | PM-18 | catalog capture or BUILD-003; before COMM-001 live | M | baton + decision | §16, KD-22, §17; PM-18 |
| TMMT-COMM-005 | GHL per-channel DND read (mirror-first, fail-closed) | PM-18 | **GHL M4 allow-list / M8**; owner question on mirrored fields | M | merge | §16, §21.1 Consent gap; PM-18 |
| TMMT-COMM-006 | Rental/payment message types, approval queue, delivery write-back | PM-18 | COMM-001/002, GHL M8 vocabulary, G-02 | M | ⚖️ copy + baton (columns) | §16 steps 3,5, §22.3 #7–8, §23.3, §26; PM-18 |
| TMMT-PAY-001 | `TMMT_PAYMENT_ARCHITECTURE.md` (owner processor decision; money model) | PM-06 | ADR-001, RENT-001, SEC-002 | M | decision | §11 (all), §11.6, KD-05/19/20; PM-06 depends-on |
| TMMT-PAY-002 | Ledger-based overdue sweep (staged) | PM-06 | catalog capture; PAY-001 recommended | S | baton | FS-23, KD-20, §10.5 #5; PM-06 |
| TMMT-DOC-001 | Versioned contract storage (never delete; `documents` + hash) | PM-07 | DATA-005, BUILD-003 | S | baton (if column) | KD-37, §12; PM-07 "versioned storage" |
| TMMT-DOC-002 | Agreement rendering into `contract_instances` + signing-provider ADR | PM-07 | RENT-002/007, DOC-001, ADR-001 | M | decision + ⚖️ | J5, §10.1 AGREEMENT READY, §12; PM-07 |
| TMMT-HAND-001 | Staff-authenticated handover; anon insert revoked; ACTIVE preconditions | PM-08 | RENT-002/007, DOC-002, PAY-001; **GHL M1** coordination | M | baton | KD-31, KD-10, J7, §12; PM-08 exit |
| TMMT-RENT-008 | Active rental board from one source; reminders staged | PM-09 | RENT-005/007, DOC-002, PAY-001, COMM-006, HAND-001 | M | baton (sweep re-point) | §23.4, §22.3 #7; PM-09 exit |
| TMMT-MAINT-001 | Remove duplicate `cases` history trigger; maintenance drives vehicle state | PM-10 | RENT-005, ADR-001, BUILD-003 | M | baton + decision (vendor table) | KD-35, §5.6 acceptance; PM-10 |
| TMMT-RENT-009 | Extension segment (priced, paid, non-overlapping); GHL `extended` = request | PM-11 | RENT-001/002/007, PAY-001, RENT-006 | M | decision + baton | J8, §10.1 EXTENDED, A-6; PM-11 exit |
| TMMT-INC-001 | Incidents, damage, tolls/violations with evidence; owner-approved charges only | PM-12 | RENT-002/007, HAND-001, PAY-001 | M | baton + ⚖️ | J9, §9.4, §10.1 INCIDENT; PM-12 exit |
| TMMT-RET-001 | Returns → inspection → deposit settlement → reconditioning → AVAILABLE | PM-13 | RENT-002/005/007, HAND-001, INC-001, PAY-001 | M | baton | J10, §10.1–§10.2; PM-13 exit |
| TMMT-AI-001 | Voice agent: owner hold; no nil-UUID fallback; rate limit | PM-15 | SEC-003; GHL M13 note | S | merge | SEC-18, KD-27, §19.3; PM-15 |
| TMMT-AI-002 | Quarantine `aria/` and `apps/engine` (guard test + README) | PM-15 | – | S | decision (deletion later) | SEC-22, KD-43, §19.1 #13–14; PM-15/PM-17 retire |
| TMMT-UX-001 | Toast/feedback component; no `alert()`; credit-face dark mode | PM-16a | – | S | merge | §22.1–§22.3 #1,#3,#5; PM-16a |
| TMMT-UX-002 | Customer portal shell 16a (status, documents, credit education, support, updates) | PM-16a | AUTH-001/002/005, DATA-002, UX-001; URL + bucket decisions | L | decision + baton | §23.1, §33 top 1; PM-16a |
| TMMT-UX-003 | Dealer desk read-only 16b + dealer-admin invite into `signup-invite.ts` | PM-16b | **DATA-003 required**, ADR-001, AUTH-003/004; 2A A4b | M | decision | §5.14, §6.5 T08, §33 top 2/5; PM-16b |
| TMMT-UX-004 | Fast Track: rewrite `applications` migration first; port after GHL M8 | PM-16d | **GHL M8**, DATA-003, BUILD-003 | M | baton | §30 #6, §33 top 3–4; PM-16d |
| TMMT-OPS-001 | Sentry `beforeSend` PII scrubber; redact three log sites | PM-17 | – | S | merge | SEC-21, KD-40, §26; PM-17 |
| TMMT-OPS-002 | Automation health screen (crons, poller staleness, webhooks, outbox, baton) | PM-17 | BUILD-001, COMM-001; GHL M5/M6 note | M | baton (RPC) | §23.3, §26, FS-15/16/17, KD-33; PM-17 |

**Counts:** 57 tasks — PM-00: 9 · PM-01: 7 · PM-02: 5 · PM-19: 5 · PM-05: 7 · PM-18: 6 · PM-06: 2 · PM-07: 2 · PM-08: 1 · PM-09: 1 · PM-10: 1 · PM-11: 1 · PM-12: 1 · PM-13: 1 · PM-15: 2 · PM-16: 4 · PM-17: 2. PM-03, PM-04 and PM-14 have **no tasks here** (owned elsewhere; see below).

## 2. Execution order (from ROADMAP §2 and §5)

1. **Owner decisions first:** 00-b signup toggle (2A-A4a), 00-c (SEC-004), 00-d (SEC-005), 00-e env values (SEC-007), read-only catalog access (BUILD-003), `/api/license/*` option (BUILD-001), journey scheduler A/B (BUILD-006), `PII_DENYLIST` confirmation (BUILD-005).
2. **PM-00 code PR (one small PR is fine):** SEC-001 + SEC-002 + SEC-003 (+ SEC-007's one-line fix), each with red-then-green tests; GHL track reviews the webhook-file diffs. Then SEC-004, SEC-005. Then SEC-008 (branch landing, other session).
3. **PM-00 baton items:** DATA-001, SEC-006 (prepared here; owner applies).
4. **PM-01:** BUILD-003 (snapshot; unblocks everything DB-shaped) → BUILD-002 → BUILD-004/005/007 → BUILD-006 → **BUILD-001 only after SEC-005 is merged**.
5. **PM-02:** ADR-001 → DATA-002 → DATA-004/005 → DATA-003 (pilot). Then **PM-19:** AUTH-001 → AUTH-002 → AUTH-003 → AUTH-004 → AUTH-005.
6. **PM-05 and PM-18 in parallel:** RENT-001 → RENT-002 → RENT-003 → RENT-004/005/006 → RENT-007; COMM-003 → COMM-005 → COMM-001 + COMM-002 → COMM-004 → COMM-006.
7. **PM-06/07:** PAY-001 (decision) → PAY-002; DOC-001 → DOC-002. **PM-16a** (UX-001, UX-002) may start after PM-19.
8. **PM-08 → PM-09 → PM-10…13:** HAND-001 → RENT-008 → MAINT-001, RENT-009, INC-001, RET-001. **PM-16b/d:** UX-003 after DATA-003; UX-004 after GHL M8.
9. **PM-15, PM-17:** AI-001, AI-002, OPS-001 any time after PM-00; OPS-002 after BUILD-001 and COMM-001.

## 3. Coordination — work that is NOT a task here (owned by another track)

| Area | Owner | What they own (do not duplicate) | Our touch-points |
|---|---|---|---|
| **GHL router M0–M13** (`feat/ghl-router-m*`, worktrees `C:\dev\wt-ghl-*`) | GHL track | M1 tenant holes incl. **ANON-TENANT-001** (SEC-07/KD-10, B-6) and the `vehicle_handover` anon revoke list; M2 codify intake/GHL tables; M3 connection registry / per-org credentials (§5.12); M4 discovery; M5 identity links / **person spine**; M6 webhook inbox (**KD-18/FS-03** event loss, **F9** mirror wipe); M7 router + **stage map KD-21**; M8 universal intake contract + **outbox design**, and the 8 unsafe public writers incl. **lp-leads-webhook SEC-14/KD-23**; M9 isolation matrix (release blocker); M10 first live intake; M11 migrate surfaces; M12 admin UI; M13 AIXMOS tools; edge functions `intake` v7 / `capture-drive` (SEC-06/KD-09, B-4/B-5, owner decisions); PARTNER-TENANT-001 (SEC-20, B-8); non-prod DB (B-7, owner) | SEC-002/003/007, COMM-003, RENT-006, AI-001 touch GHL files → **GHL owner reviews**; COMM-001/002/005/006 consume M8/M4 designs; DATA-003 shares fixtures with M9; BUILD-002 shares the CI runner; BUILD-003 excludes M2's tables; HAND-001 aligns with M1; UX-004 waits for M8 |
| **Credit S0–S7 / C1** (`C:\dev\wt-credit-c1`) | credit track | All credit engine/schema/desk: **KD-28 / SEC-17** (ungated `[id]`, arbitrary payload, CPN ban), C1 staged `credit_case_foundation`, S1–S7, T10 rescue, D-22b, CROA gate | DATA-004 changes `is_internal_ops()` which 18 credit policies use → tell C1; UX-002 hosts a credit **education** page only |
| **Phase 2A** (`C:\dev\wt-2a-profiles`, `sec/2a-profiles-regression`) | 2A track / owner | A1 done; **A3** profiles CI regression; **A4a/A4b signup** (SEC-02/KD-02); **A12 `org_roles` recursion** (SEC-13/KD-25; ROADMAP PM-02 #6 is a reference, SI-09); A7–A11 owner items | BUILD-002 coordinates the CI job; AUTH-004 coordinates A4b; DATA-003 must work while A12 is open |
| **`sec/partner-acquisition-rls`** (`C:\dev\wt-sec-partner-acq`, `620e100e`) | that session | The policy fix (**REMEDIATED on prod 2026-09-22**, post-application verified), its rehearsal and ledger note; PR #255 hold; `internal_team` future access = owner product decision | SEC-008 only records/lands; nobody touches, re-applies or "fixes up" the policies |
| **Device cleanup / consolidation** (Desktop `CONSOLIDATION-2026-09-21`, separate baton) | owner | rescue-archive ACLs, bundles, machine hygiene | no task here; UX-002/003/004 read rescued code at path level only |
| **Production operations** (prod baton) | owner | every apply / env / cron / send / merge | every `baton`, `env` and `merge` cell above |
| **M1 sync / off-repo jobs** | owner's M1 | the launchd GHL poller; the agent-spine worker | OPS-002 reads `synced_at` only; nobody modifies the poller |
| **Owner-only items** | owner | Signup toggle; merge-control plan upgrade or merge bot (§27 #3); credential rotation, Docker firewall, secret clean-up, watchdog (SEC-25); GHL private integration token; non-prod Supabase; D5 `sync-airtable.mjs` stays locked; Airtable retirement after SoR §6 step 3; deletion of `aria/` / `apps/engine`; D-22b; the ADR decisions | every `decision` cell above |

## 4. Owner decisions this index depends on (soonest first)

Signup toggle (00-b) · session-autopilot (SEC-004) · mission-daily (SEC-005) · GHL kill-switch env values (SEC-007) · read-only catalog access (BUILD-003) · `/api/license/*` (BUILD-001) · journey scheduler (BUILD-006) · `PII_DENYLIST` set (BUILD-005) · ADR-001 pack (vehicle, roles, tenancy, `active_customers`, queue) · rental status vocabulary (RENT-001) · hold TTL (RENT-004) · customer URL shape (AUTH-002/UX-002) · who may invite (AUTH-004) · R6 dispositions (AUTH-003) · payment processor + money model (PAY-001) · signing provider (DOC-002) · vendor table (MAINT-001) · outbox backlog expire vs dry_run (COMM-004) · `OUTBOX_DRAIN_MODE=live` (COMM-001) · ⚖️ collections copy (COMM-006), recovery terms (INC-001), templates (DOC-002).
