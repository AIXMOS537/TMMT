# TMMT MASTER EXTRACTION — FINAL CONSISTENCY REVIEW DELTA (owner, 2026-09-22)

Apply after S2 completes and before declaring the Master Product Extraction finished.
CONSISTENCY / EVIDENCE review only. Do not implement, deploy, alter production, or modify active GHL/Credit branches.

## 1. PARTNER_ACQUISITION CURRENT STATE
Update all extraction artifacts: partner_acquisition RLS P0 STATUS = REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED. Production migration 20260922005007 partner_acquisition_least_privilege; prepared commit 620e100e. Do not describe the unrestricted authenticated policy as CURRENT; preserve it as HISTORICAL DEFECT / ROOT CAUSE. Current behaviour: ordinary authenticated cannot read/update/delete; anonymous cannot read; narrow intake INSERT allowed; platform admin has management access; view does not bypass; internal_team intentionally denied. Table remained empty after rolled-back verification. Do not infer that no historical access occurred merely because no evidence was found.

## 2. REMAINING PARTNER_ACQUISITION FOLLOW-UP
Track separately (not the original P0): repo branch still needs normal landing/reconciliation; KNOWN_UNAPPLIED accounting; future internal_team access = product decision.

## 3. AUTH-SIGNUP-001 REMAINS OPEN
Public signup remains OPEN unless a later read-only verification proves otherwise. Represent: AUTH-SIGNUP-001 — OPEN / OWNER ACTION REQUIRED. PUBLIC SIGNUP CONTAINMENT ≠ TENANT AUTHORIZATION; RLS/server authz must stay safe for already-authenticated hostile accounts.

## 4. AUTO-MERGE RISK
Classification: LATENT RISK. Evidence: repo auto-merge not active; recent merges human; master lacks technical branch protection; session-autopilot can enable auto-merge for claude/*. Not an active incident; not resolved.

## 5. CRON REALITY
Spec must record: /api/cron/* is intercepted by auth middleware and redirected to /login, so scheduled Vercel jobs do not execute their handlers (supported by tests). Dependency: fixing cron auth may reactivate dormant downstream behaviour — review mission-daily before enabling. "Fix middleware" is not an isolated one-line repair.

## 6. PAYMENT REALITY
CODE CAPABILITY: GHL payment sync can insert customer_payments rows. PRODUCTION OBSERVATION: GHL-tag-driven behaviour reportedly has not fired. Do not rewrite as "GHL does not create payments" or "GHL is currently creating payments".

## 7. RENTAL AUTOMATION REALITY
lead_to_active_customer_trg exists and is enabled in production. That is not a complete rental lifecycle (reservation, deposit, agreement, vehicle assignment, handoff, active rental, return, damage closeout).

## 8. COMMUNICATION REALITY
Queued ≠ delivered. Queued new-lead emails existed while no customer delivery path functioned. Do not label messaging WORKING because queue rows exist.

## 9. CURRENT VS TARGET
Every major builder-context doc distinguishes CURRENT / PARTIAL / BROKEN / PLANNED / TARGET / UNKNOWN. Especially: GHL M3–M13, Credit C1+, AIXMOS, customer messaging, customer authentication, rental lifecycle, payments, e-sign, remote-support/HailMary.

## 10. GHL TRACK OWNERSHIP
May describe target GHL architecture; must not duplicate/supersede the active GHL track. Map requirements to GHL M0–M13. Forge tasks must not rebuild registry, identity linking, webhook inbox, routing, shadow mode, or other owned GHL milestones.

## 11. CREDIT TRACK OWNERSHIP
Credit Center stays in the flagship spec. Distinguish: credit capability on master / recovered historical implementation / C1/C2/C3 development / future target. No Forge task rebuilds the Credit engine.

## 12. SECURITY OWNERSHIP
Every security defect in the 45-defect register has a status: OPEN / REMEDIATED / MITIGATED / BLOCKED / OWNER ACTION / ACCEPTED LIMITATION / UNKNOWN. A fixed prod defect must not stay OPEN because an evidence file predates the fix; an open defect must not become REMEDIATED because a task exists.

## 13. DEFECT TRACEABILITY
All 45 defects map to ≥1 of: PM milestone / explicit backlog item / security workstream / GHL milestone / Credit milestone / accepted limitation / explicit deferred item. No orphan. Produce a traceability table.

## 14. FORGE TRACEABILITY
Every Forge task cites: spec requirement(s), defect(s) if applicable, PM milestone, dependencies, owned files/surface, acceptance criteria, tests, STOP boundary. No task exists because it "sounded useful".

## 15. FORGE OWNERSHIP COLLISIONS
Reject/rewrite any task crossing an active boundary without explicit coordination: GHL, Credit, security remediation, cleanup/consolidation, production operations, M1 sync. Prefer INTEGRATE WITH EXISTING MILESTONE OUTPUT over REBUILD SUBSYSTEM.

## 16. PM-18 CUSTOMER MESSAGING
Retain. Must define: triggering event, recipient, channel, consent/suppression, queue state, delivery attempt, provider result, failure/retry, audit, operator visibility. Queued ≠ delivered. Do not activate dormant mission-daily as a shortcut.

## 17. PM-19 CUSTOMER ACCESS
Retain. Current renter status/login behaviour is not complete. Integrate with the authoritative account-provisioning/auth architecture; do not invent another auth system.

## 18. CUSTOMER JOURNEY TRACEABILITY
For every stage (lead, application, identity/eligibility, vehicle selection, availability, reservation, approval, agreement, documents/signatures, deposit/payment, vehicle assignment, handoff, inspection/photos/mileage, active rental, maintenance, extension, recurring payment, communications, tolls/violations, return, damage, closeout, financing readiness): CURRENT IMPLEMENTATION / SYSTEM OF RECORD / SCREEN-API / AUTOMATION / GAPS / TARGET MILESTONE. No stage is complete from one route/table/trigger alone.

## 19. SCREEN COUNT CONSISTENCY
Reconcile the UI/API inventory; do not add 98+35+13 against 127 screens + 30 APIs unless denominators match. Explain what each count represents. Remove ambiguous totals.

## 20. BUILD/TEST BASELINE
Report measured worktree results accurately: build / lint / typecheck / unit tests / known platform-specific failures / CI. Compiling ≠ healthy.

## 21. PRODUCTION VS REPOSITORY
Distinguish: CODE ON MASTER / CODE ON ACTIVE DEV BRANCH / PRODUCTION DATABASE STATE / PRODUCTION DEPLOYMENT STATE / DESIGN ONLY / PRESERVED-RESCUED HISTORICAL WORK — wherever repo and prod diverge.

## 22. RESCUED WORK
Classify every pocket: UNIQUE AND RELEVANT / UNIQUE BUT DEFERRED / SUPERSEDED / DUPLICATE / HISTORICAL REFERENCE / NEEDS MANUAL REVIEW. Nothing rescued is automatically canonical; no bundle is automatically merged.

## 23. BUILDER MASTER PROMPT
Review as if handed to an AI with zero history. Must make clear: what TMMT is, who it serves, what exists, what is broken, what is planned, which tracks are independently owned, what not to rewrite, what needs approval, the next bounded milestone, how to test, where to stop. If it could cause a rebuild of GHL/Credit/security work, it FAILS.

## 24. CONTEXT PACK
Search all pack files for stale statements on: partner_acquisition, admin-role escalation, public signup, GHL milestone state, Credit milestone state, cron jobs, messaging, payments, rental lifecycle, production migrations. CURRENT state must be temporally coherent.

## 25. READINESS REPORT
Must answer: works today / partially works / broken / design-only / actively repaired elsewhere / what prevents a complete rental / what prevents safe customer activation / what prevents broader tenant rollout / what prevents production-scale automation / what to build next. No single percentage score.

## 26. ROADMAP
PM roadmap must not collide with GHL M0–M13 or Credit S/C milestones; reference them, never renumber.

## 27. CONSISTENCY SEARCH
Textual search across all deliverables for: partner_acquisition, public signup, auto-merge, cron, mission-daily, GHL payment, lead_to_active_customer, message, Credit, GHL M3, GHL M4, M5, M6, C1, C2, CURRENT, TARGET, Forge. Resolve contradictions.

## 28. FINAL DELIVERABLE INVENTORY
Verify existence/consistency of: spec, readiness report, PM roadmap, TMMT_BUILDER_CONTEXT/, master prompt, FORGE_TASKS/, evidence references, extraction baton/provenance.

## 29. EXTRACTION FINAL REPORT
Closeout containing: CANONICAL SOURCE · EXTRACTION BRANCH · BASE COMMIT · FINAL COMMIT · BUILD/TEST RESULT · SCREEN/API INVENTORY · PRODUCT DOMAINS · CURRENT RENTAL JOURNEY · CURRENT GHL STATE · CURRENT CREDIT STATE · CURRENT AIXMOS STATE · SECURITY STATE · RESCUED WORK · TOP PRODUCT BLOCKERS · TOP SECURITY BLOCKERS · PM ROADMAP · BUILDER PACK · FORGE TASKS · CROSS-TRACK DEPENDENCIES · RECOMMENDED FIRST IMPLEMENTATION MILESTONE · FILES CREATED · KNOWN LIMITATIONS.

## 30. STOP
After review and closeout: STOP. No implementation, Forge execution, deploy, merges, migrations, prod changes, messaging activation, cron repair, signup change, GHL or Credit changes.
