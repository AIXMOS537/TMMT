# TMMT MASTER PRODUCT EXTRACTION — FINAL REPORT (closeout 2026-09-22)

Extraction only. Nothing was implemented, deployed, merged, applied or switched on by producing these documents. All facts below were verified before this review; production was not re-queried during it.

## 1. CANONICAL SOURCE
`AIXMOS537/TMMT` `origin/master` @ `4cca6835` (PR #254, 2026-09-21 19:44), deployed as Vercel project `tmmt-ops` (`https://tmmt-ops.vercel.app`); production Supabase `uapxakmlwnpfsftfeezx` (no staging DB; preview deploys use prod). Supporting canon read-only: `docs/SYSTEM_OF_RECORD.md`, `docs/ONE_PROJECT_PLAN.md`, Desktop `TMMT-GHL-ROUTER/*`, `TMMT-PHASE-2/*`.

## 2. EXTRACTION BRANCH
`docs/tmmt-master-extraction-2026-09-21` in worktree `C:\dev\wt-master-extraction`. Only `docs/product/**` is touched.

## 3. BASE COMMIT
`4cca6835`.

## 4. FINAL COMMIT
**Uncommitted on `docs/tmmt-master-extraction-2026-09-21`, base `4cca6835`.** Nothing is committed or pushed; the owner decides whether and how these docs land.

## 5. BUILD/TEST RESULT (this worktree, clean, no env, 2026-09-21)
`npm ci` PASS (664 packages) · `brand:check` PASS · `lint` PASS (0 errors, 39 warnings) · `tsc --noEmit` PASS · `next build --webpack` PASS (151 static pages; 122 dynamic routes not executed) · vitest **2320 pass / 2 fail / 14 skip** (2,336 total; both failures Windows-only: `git ls-files` quoting in `ticket-requester-is-not-the-customer.test.ts`, CRLF window in `record-opt-out.test.ts`) · SQL rehearsals **8/11** (2 undetermined path arguments, 1 red by design without `--repaired`) · CI (`verify.yml`) runs vitest + lint + typecheck + build (+ brand) only; **E2E and SQL rehearsals are not in CI**. Compiling ≠ healthy. Logs: `_evidence/_logs/`.

## 6. SCREEN/API INVENTORY
127 pages + 30 API routes = **157 canon routes** (status: 98 WORKING / 35 PARTIAL / 13 BROKEN / 2 PLACEHOLDER / 5 ORPHANED / 4 LEGACY by code path; at runtime 7 more are BROKEN on ghost tables → 91 / 20). Registry `_evidence/E2_route_registry.csv` = 175 rows (157 + 13 `apps/engine` + 5 `aria`). 11 parenthesised route groups + 1 ungrouped bucket. `(admin)` desk 29 screens (28 reachable by staff). Definitions: SPEC §6.1.

## 7. PRODUCT DOMAINS
CRM/Leads (works as a store) · Universal intake (2 of 27 surfaces live; 8 unsafe public writers) · Rentals/Bookings (skeleton, 0 rows) · Fleet (legacy data, two tables) · Payments (no processor proof) · Maintenance (legacy) · Agreements/Documents (no e-sign) · Credit Center (owner-only, CROA-gated) · Communications (nothing customer-facing delivers) · AIXMOS (SMS agent never ran live) · Analytics (on unverified money; KPI cron dead) · Admin/Integrations (one env GHL token) · Dispatch (rescue vertical, works) · Dealer/Partner (marketing only) · Pocket · Customer Portal (absent) · Auth/Access (works with defects). SPEC §5.

## 8. CURRENT RENTAL JOURNEY
No stage is complete end to end (SPEC §7.0, 23 stages). CURRENT/PARTIAL: lead, application, identity/eligibility (staff decision), vehicle selection (staff), availability (EXCLUDE live), approval (= background check), vehicle assignment (at hold), inspection (legacy), active rental (four disagreeing sources), maintenance (legacy), recurring payment (queued only), return (unlinked), financing readiness (walled). BROKEN: reservation (only `hold`), handoff (anonymous form), communications (never delivered). DESIGN ONLY: agreement, documents/signatures, deposit proof, extension, tolls, damage, closeout. `lead_to_active_customer_trg` exists and is enabled on prod; it fabricates "Active" rows and is not a lifecycle.

## 9. CURRENT GHL STATE
Master: one env bearer, one location, empty stage map (every stage → `inquiry`), webhooks signed but never received a verified event, only live path is the off-repo M1 poller, V1–V8 violations latent (GHL payment sync = code capability; 0 rows on prod), form kill switch overridable by payload. Track (positions as observed by E6 on 2026-09-21): M0–M2 branch-only (M1 migration not applied); M3 dev-only, not applied; M4 dev CLI; M5/M6 design; M7–M13 planned. **The GHL track's latest integrated milestone report supersedes those positions** — the owner's orchestration prompt (2026-09-22) reports M0–M4, M5 identity and M6 webhook reliability progressed on the track's branches with M7 (deterministic routing + dry-run simulator, zero GHL writes; shadow mode and live routing are not M7) separately authorized; this extraction did not re-verify those branches and found none of it on master or applied to prod. Outbound GHL writes are frozen until explicitly authorized. Owned by the GHL router track; no PM task rebuilds registry, identity linking, webhook inbox, routing, shadow mode, intake contract, outbox design or the M1 sync. SPEC §14, pack `09`.

## 10. CURRENT CREDIT STATE
On master: owner desk, importers, accuracy policy, CROA gate closed; no customer face; open defects KD-28 (ungated `[id]`, arbitrary payload, CPN ban unenforced) owned by the credit track. C1 (`wt-credit-c1`, uncommitted, dev-only; staged `credit_case_foundation` not applied); C2 = the next credit iteration (customer assertion lifecycle, evidence, review, exact-content approval, sent/response recording, case timeline, ownership isolation — ACTIVE DEVELOPMENT on the credit branch per the owner's orchestration prompt, not re-verified here, not on master); C3+ = design; S1–S7 planned; T10 AIX-CREDIT-DISPUTE = preserved-rescued, needs manual review. D-22b OPEN; PR #224 merged. No PM task touches credit files. SPEC §18, pack `10`.

## 11. CURRENT AIXMOS STATE
Boundary verified (no shell/eval, no LLM tool calling, fixed action enum). SMS agent correct but never ran live; voice agent 500 without org slug and stores replies without owner hold; ops AI works; agent spine dormant since 09-16 (local worker); pocket brain/captain/iMessage unreachable from Vercel; `aria/` and `apps/engine` orphaned; GHL M13 tool layer planned only. Remote support / "HailMary": UNKNOWN, not in canon. SPEC §19, pack `11`.

## 12. SECURITY STATE
REMEDIATED on prod: `profiles` protected columns (2026-09-21 23:41Z, ledger `20260921234148`, baton 8); `partner_acquisition` least-privilege (2026-09-22 00:50Z, ledger `20260922005007`, baton 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`, prepared commit `620e100e` on `sec/partner-acquisition-rls`, **not merged**; exposure window ~51 min: no evidence found, not proven absent; follow-ups: branch landing, `KNOWN_UNAPPLIED` 54→53, `internal_team` product decision). OPEN / OWNER ACTION: AUTH-SIGNUP-001 (unverified), edge functions B-4/B-5, SEC-25 items. OPEN — LATENT RISK: master unprotected + `session-autopilot` auto-merge (off today; recent merges human). OPEN: `is_staff()` global, GHL-set business state (latent), DNC bypass, open redirect, middleware blocking machine APIs (paired with mission-daily), `change_log` ALL true, `org_roles` recursion (2A-A12), ANON-TENANT-001 (GHL M1), PARTNER-TENANT-001 (GHL B-8), cross-org signed URLs, default-ACL TRUNCATE, PII in logs, `aria/`. 45 KD + 3 SEC-only ids, 0 orphans: `_review/DEFECT_TRACEABILITY.md`.

## 13. RESCUED WORK
41 pockets, all PRESERVED-RESCUED HISTORICAL WORK, classified: UNIQUE AND RELEVANT 6 (customer portal 15 pages, dealer desk 10, Fast Track core, Fast Track migration after rewrite, T08 dealer-admin invite, LOTOS docs) · UNIQUE BUT DEFERRED 3 · SUPERSEDED 8 · DUPLICATE 2 · HISTORICAL REFERENCE 14 · NEEDS MANUAL REVIEW 8. Nothing rescued is automatically canonical; no bundle is automatically merged; bundles carry credentials-named files and CVILLE PDFs in history and are never pushed. SPEC §33.

## 14. TOP PRODUCT BLOCKERS
1. No rental state machine / event log (plus an enabled trigger that fabricates rentals). 2. No processor-verified payments. 3. No agreements or e-sign (Airtable holds the only signatures). 4. No customer login path. 5. No safe way to message customers (queued ≠ delivered). 6. Two vehicle tables, 9+ person tables, 0 active vehicles. 7. The repo cannot rebuild prod (279 vs 89 migrations; 6/7 edge functions unversioned).

## 15. TOP SECURITY BLOCKERS
1. AUTH-SIGNUP-001 (owner action, unverified). 2. Unprotected master + latent auto-merge (LATENT RISK). 3. Middleware blocks machine APIs and its fix re-arms mission-daily / doubles the recompute / `/api/license/*` has no credential. 4. GHL-tag payment capability (never fired). 5. GHL stage auto-verify + V4 payload override. 6. DNC bypass on outbound GHL writes. 7. Open redirect. 8. Global `is_staff()`. 9. No isolation/privilege tests in CI. 10. Also: edge functions B-4/B-5, ANON-TENANT-001, `change_log`, `org_roles` recursion, cross-org signed URLs, default ACL, `partner_acquisition` follow-ups.

## 16. PM ROADMAP
`TMMT_ROADMAP.md`: PM-00 Security containment → PM-01 Reproducible build / CI truth → PM-02 Canonical data/tenancy/roles → PM-19 Customer identity & access → PM-05 Rental state machine ‖ PM-18 Communications gateway → PM-06 Payments ‖ PM-07 Agreements/e-sign → PM-08 Handoff → PM-09 Active rentals → PM-10…PM-13 → PM-16 Flagship UX (slices 16a–16d) ‖ PM-15 AIXMOS → PM-17 Production hardening. PM-03/PM-04 = GHL M0–M11 and PM-14 = Credit S0–S7/C1 are reference-only; GHL M-numbers and Credit S/C-numbers are never renumbered. Backlog items added at closeout: KD-38 (PM-16a), SEC-20 gate (PM-17).

## 17. BUILDER PACK
`TMMT_BUILDER_CONTEXT/00…14` (15 files), each marking CURRENT vs TARGET, temporally coherent as of 2026-09-22; plus `TMMT_BUILDER_MASTER_PROMPT.md` (passes the zero-history reader test after adding §0.0 "OWNED ELSEWHERE — NEVER REBUILD, NEVER RE-APPLY" and the dormant-automation STOP condition).

## 18. FORGE TASKS
57 task files + `FORGE_TASKS/INDEX.md` (one task per PR, 17 headings each); traceability in `_review/FORGE_TRACEABILITY.md`: 57 kept, 4 rewritten (SEC-008, AUTH-004, AUTH-005, RENT-006), 0 deleted; every task cites spec sections, defects, milestone, dependencies, owned surface, acceptance criteria, tests and a STOP boundary; 13 marked INTEGRATE because they touch a GHL / Phase 2A / M1 boundary with explicit coordination.

## 19. CROSS-TRACK DEPENDENCIES
PM-00 ↔ GHL (webhook-file guards reviewed by the GHL owner; env kill switches) and Phase 2A (signup toggle A4a/A4b) and the `sec/partner-acquisition-rls` session (branch landing). PM-01 ↔ GHL M2 (table split), 2A-A3 (CI rehearsal job). PM-02 ↔ GHL M5 (identity), M9 (isolation matrix), 2A-A12 (`org_roles`), Credit C1 (`is_internal_ops()` helper). PM-19 ↔ 2A-A4b (account provisioning), GHL M5 (spine-keyed RLS, BLOCKED). PM-05 ↔ GHL M6/M7 (event requests). PM-18 ↔ GHL M8 (outbox design), M4 (DND read allow-list), G-02 (#243). PM-08 ↔ GHL M1 (`vehicle_handover` anon revoke). PM-16 ↔ PM-19, PM-02, PM-06, GHL M8 (Fast Track), Credit S4/S5 (customer credit pages). PM-15 ↔ GHL M13. PM-17 ↔ GHL B-7 (non-prod DB), B-8 (PARTNER-TENANT-001 gate).

## 20. RECOMMENDED FIRST IMPLEMENTATION MILESTONE
**PM-00 Security containment.** Order: (1) owner decisions — signup toggle, session-autopilot, mission-daily, GHL kill-switch env values; (2) the partner-acquisition session lands branch `620e100e` (policy already on prod); (3) one small code PR from this lane — open redirect (SEC-001), GHL payment guard (SEC-002), DNC before outbound GHL writes (SEC-003), V4 precedence fix (SEC-007), each with red-then-green tests, GHL owner reviewing the webhook-file diffs; (4) staged + rehearsed for owner + baton — trigger disable (DATA-001), `change_log` policy (SEC-006). Then PM-01, and BUILD-001 only after SEC-005.

## 21. FILES CREATED
`docs/product/TMMT_MASTER_BUILD_SPEC.md` · `TMMT_FLAGSHIP_READINESS_REPORT.md` · `TMMT_ROADMAP.md` · `TMMT_BUILDER_MASTER_PROMPT.md` · `S2_SPEC_ISSUES.md` · `EXTRACTION_BATON.md` · `EXTRACTION_FINAL_REPORT.md` (this file) · `TMMT_BUILDER_CONTEXT/00_READ_ME_FIRST.md … 14_CURRENT_STATE.md` (15) · `FORGE_TASKS/INDEX.md` + 57 task files · `_evidence/E1_BUILD_STACK_TESTS.md`, `E2_SCREENS_ROLES_DESIGN.md`, `E2_route_registry.csv`, `E3_DATA_RENTAL_PAYMENTS_FLEET.md`, `E4_GHL_INTAKE_COMMS_AUTOMATION.md`, `E5_CREDIT_AIXMOS_SECURITY.md`, `E6_RESCUE_HISTORY_TRACKS.md`, `_evidence/_logs/*` (19 logs) · `_review/FINAL_REVIEW_DELTA.md` (owner input) · `_review/DEFECT_TRACEABILITY.md` · `_review/FORGE_TRACEABILITY.md` · `_review/CONSISTENCY_LOG.md`. Also present, **owner-authored and not edited by this review**: `TMMT_CLAUDE_ORCHESTRATION_PROMPT.md` (standing orchestration instructions, 2026-09-22; its §7/§15 report GHL M0–M6 progress and Credit C2 on their branches — recorded here as the supersession note in §9/§10, not re-verified). Total: **111 files** under `docs/product/` (35 documents + 57 task files + 19 logs).

## 22. KNOWN LIMITATIONS
- Evidence files are dated 2026-09-21 and are intentionally not edited; they describe the pre-fix `partner_acquisition` state, which the SPEC cites as historical (X4). Row counts drift daily.
- The `partner_acquisition` exposure window (~51 min) has **no evidence** of access; logs cannot attribute direct SQL, so absence of access is not proven.
- AUTH-SIGNUP-001 toggle state is unverified; several owner decisions (vehicle table, role source, URL shape, processor, signing provider, `/api/license/*`, catalog access, `internal_team` access) remain open and gate later milestones.
- Two SQL rehearsals have undetermined path arguments; whether operator accounts exist in prod, whether `ghl_contacts` mirrors per-channel DND, and the activity of 5 unversioned edge functions are UNKNOWN.
- Remote support / "HailMary" is not in canon and is UNKNOWN.
- E2E is not in CI and would hit prod; no non-production database exists (GHL B-7).
- The pack describes `4cca6835`; other sessions write to prod and branches daily. Re-verify `file:line` before editing.
- This review edited only `docs/product/**`; no source, schema, prod, deploy, git commit or other worktree was touched. **STOP:** no implementation, Forge execution, deploy, merge, migration, prod change, messaging activation, cron repair, signup change, GHL or Credit change follows from this report.
