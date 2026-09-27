# CONSISTENCY LOG — final review edits (2026-09-22)

Scope: `C:\dev\wt-master-extraction\docs\product\**` only. No source, schema, prod, deploy, other worktree or git changes. Every row: file · before → after · reason (delta § from `_review/FINAL_REVIEW_DELTA.md`).

Search terms swept (delta §27): partner_acquisition · public signup · auto-merge · cron · mission-daily · GHL payment · lead_to_active_customer · message · Credit · GHL M3 · GHL M4 · M5 · M6 · C1 · C2 · CURRENT · TARGET · Forge. Result after edits: no deliverable describes the unrestricted `partner_acquisition` policy as current; no deliverable says "fix in prep" / "being prepared"; no deliverable labels messaging WORKING; no deliverable says GHL "does not" or "is currently" creating payments; every GHL M-number and Credit S/C-number is quoted as the owning track defines it.

## Contradictions found and fixed (count: 35)

| # | File | Before → After | Reason |
|---|---|---|---|
| 1 | `TMMT_MASTER_BUILD_SPEC.md` §0.3 X4 | "P0 … separate workstream is preparing the fix" → HISTORICAL DEFECT / ROOT CAUSE + **REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED** (ledger, baton 9, approval, `620e100e`, current behaviour, exposure "no evidence found", follow-ups) | delta §1, §2 |
| 2 | SPEC §0.3 X5 | "toggle state UNKNOWN" → "AUTH-SIGNUP-001 — OPEN / OWNER ACTION REQUIRED; unverified; containment ≠ tenant authorization" | delta §3 |
| 3 | SPEC new §0.4 | (absent) → six production-vs-repository labels with examples | delta §21 |
| 4 | SPEC new §0.5 | (absent) → security-defect status vocabulary; pointer to DEFECT_TRACEABILITY | delta §12 |
| 5 | SPEC §2.1 staff row | "28 desk screens" → "29 `(admin)` screens, 28 reachable by staff (`/money` owner-only)" | SI-02; delta §19 |
| 6 | SPEC §4.4 | rehearsals "2 need undocumented path args" → "targets undetermined, `pending`"; added CI row (vitest+lint+typecheck+build only; E2E not in CI); "Compiling ≠ healthy" | SI-06; delta §20 |
| 7 | SPEC §5.9 Status | added "Queued ≠ delivered: 35 queued / 0 sent; no delivery path has ever functioned; queue rows are never evidence" | delta §8 |
| 8 | SPEC §5.14 | "`partner_acquisition` authenticated ALL true (P0)" → "historical P0, REMEDIATED on prod 2026-09-22 (branch not on master)"; SEC-20 marked OPEN | delta §1 |
| 9 | SPEC §6.1 | counts table → added "one definition per number" table (127 / 30 / 157 / 175 / 29-28 / 11+1=12 / 13 / 7 / 14 / 8 / 6 / 8 triggers / 2,336 / 178-279-89) | delta §19 |
| 10 | SPEC §6.2 | added runtime view 91/20 and "Communications WORKING = internal only; no customer send path works" | delta §8, §19 |
| 11 | SPEC §6.3 | 8 machine APIs → note that `/api/license/*` has no credential/rate limit and is split out of the fix | SI-05; delta §5 |
| 12 | SPEC §7 new §7.0 | (absent) → 23-stage customer-journey traceability table (CURRENT IMPLEMENTATION / SoR / SCREEN-API / AUTOMATION / GAPS / TARGET MILESTONE) with the "no stage complete from one route/table/trigger" rule | delta §18 |
| 13 | SPEC §10.2 | (implicit) → explicit OWNER DECISION on widening the CHECK vs events, ADR in TMMT-RENT-001 | SI-08 |
| 14 | SPEC §10.4 | trigger description → "exists and is enabled in production … not a rental lifecycle (no reservation, deposit, agreement, assignment, handoff, return, closeout)" | delta §7 |
| 15 | SPEC §11.2 heading + lead | "VERIFIED in code, never fired on prod" → "CODE CAPABILITY vs PRODUCTION OBSERVATION" with both facts stated separately and the two forbidden rewrites named | delta §6 |
| 16 | SPEC §14 | GHL target intro → every M-row is CODE ON ACTIVE DEV BRANCH or DESIGN ONLY; explicit list of what no PM task may rebuild (incl. M7 simulator / shadow mode) | delta §10 |
| 17 | SPEC §17 | "middleware 307 is the likely cause" → "middleware intercepts `/api/cron/*` and redirects to `/login`, so the handlers do not execute (pinned by `middleware.test.ts:237`)"; "Fix is in PM-01" → "not an isolated one-line repair" with the three paired prerequisites | delta §5 |
| 18 | SPEC §18.2 | added the four-way split: credit capability on master / recovered historical (T10) / C1-C2-C3 development / future target | delta §11 |
| 19 | SPEC §19.1 | added row "Remote support / HailMary — UNKNOWN, not in canon" | delta §9 |
| 20 | SPEC §20.2 | profiles "CLOSED" → "REMEDIATED (baton 8)"; added `partner_acquisition` REMEDIATED row with "do not re-apply" | delta §1, §12 |
| 21 | SPEC §20.3 | table gained a **Status** column; SEC-01 REMEDIATED; SEC-02 OPEN / OWNER ACTION; SEC-04 OPEN — LATENT RISK; SEC-06 OPEN / OWNER ACTION; SEC-13 → Phase 2A A12; SEC-15 → PM-02 item 9; SEC-25 OWNER ACTION; all others OPEN | delta §4, §12; SI-03, SI-09 |
| 22 | SPEC §21.2 V4 | added the payload-override fact and the one-line precedence fix (TMMT-SEC-007) | SI-04 |
| 23 | SPEC §25.2 Permissions | "7 tiers × 12 groups" → "7 tiers + signed-out + future `customer` × the 12 route buckets of §6.1" | delta §19 |
| 24 | SPEC §27 | session-autopilot → explicit "classification: LATENT RISK (not an active incident; not resolved)" with the evidence list | delta §4 |
| 25 | SPEC §28 | KD-01 "fix in prep" → "REMEDIATED in production 2026-09-22; branch `620e100e` to land"; pointer to DEFECT_TRACEABILITY for all 45 | delta §1, §12, §13 |
| 26 | SPEC §32 #1–#3 | "OPEN (SEC-01 fix in prep; profiles CLOSED)" / "UNKNOWN (owner)" / "OPEN (owner)" → statuses per §0.5 (REMEDIATED, OWNER ACTION, LATENT RISK) | SI-11 |
| 27 | SPEC §33 | E6 dispositions (USEFUL/FUTURE/SUPERSEDED/CANON/LEGACY/HUMAN) → the six delta classifications (UNIQUE AND RELEVANT / UNIQUE BUT DEFERRED / SUPERSEDED / DUPLICATE / HISTORICAL REFERENCE / NEEDS MANUAL REVIEW) with a mapping table and "nothing rescued is automatically canonical; no bundle is automatically merged" | delta §22 |
| 28 | SPEC footer | "Next: owner review" → reconciled note pointing to CONSISTENCY_LOG, S2 resolutions, FINAL REPORT | closeout |
| 29 | `TMMT_FLAGSHIP_READINESS_REPORT.md` | rewritten: plain words #1 "fix is being prepared" → REMEDIATED; new §0 answering the ten questions explicitly with no score; §1 build/test row with CI truth; §3 crons "handlers do not run" + #15 trigger; §5 gained a Status column; §7 names the owning track per repair; §9 uses the six rescue classifications; §10.1 re-ordered (SEC-01 moved to follow-ups); §11 step 1 no longer says "partner_acquisition fix (other workstream)" | delta §1–§8, §22, §25 |
| 30 | `TMMT_ROADMAP.md` | §0: no-renumbering rule + orphan rule; PM-00 foundation "CLOSED"/"in prep" → REMEDIATED ×2; 00-a landing-only; 00-b OPEN / OWNER ACTION; 00-c LATENT RISK; 00-d cron reality; 00-e + V4 precedence fix; PM-01 #1 `/api/license/*` split + "not one line"; PM-01 #3 rehearsals `pending`; PM-02 #6 → 2A-A12 reference; PM-19 A4b integration + phased RLS + "current status/login is not an access path"; PM-18 goal gained the ten required message attributes + "mission-daily is never a shortcut"; PM-16a backlog KD-38; PM-17 gate SEC-20; §5 bullets and step 2/3 updated | SI-01, SI-04, SI-05, SI-06, SI-09, SI-10; delta §3, §5, §13, §16, §17, §26 |
| 31 | `S2_SPEC_ISSUES.md` | 11 issues → each carries "Correction applied" + "Resolution: RESOLVED"; "Open issues" section empty; SI-07 recorded as "SPEC was right" | closeout |
| 32 | SPEC §0.3 X2 | profiles "CLOSED on prod" → "REMEDIATED on prod (baton 8) … do not describe as open; do not re-apply" (vocabulary alignment with §0.5) | delta §12 |
| 33 | SPEC §28 KD-11 | "both Vercel crons dead" → "handlers never run (pinned by `middleware.test.ts:237`); fix paired with KD-12/KD-36 and the `/api/license/*` decision" | delta §5 |
| 34 | SPEC §14, pack `09`, master prompt §0.0 + §0.1, `14_CURRENT_STATE.md`, final report §9 | my first pass wrote "the M7 simulator / shadow-mode dry run" — corrected: **M7 = deterministic routing engine + dry-run simulator (zero GHL writes); shadow mode and live routing are later GHL steps, not M7**; added "positions are as observed 2026-09-21 by E6; the GHL track's latest integrated milestone report supersedes them" (the owner's orchestration prompt reports M0–M6 progressed and M7 authorized on branches; not re-verified; nothing on master/prod); added "outbound GHL writes are frozen" | delta §10; owner orchestration prompt §7, §11, §12 |
| 35 | `TMMT-SEC-006` WHY; `14_CURRENT_STATE.md`; final report §10 | "`change_log` and `partner_acquisition` are the two authenticated ALL true" → "were … `partner_acquisition` REMEDIATED 09-22, `change_log` is the only remaining one"; Credit C2 recorded as the next iteration (ACTIVE DEVELOPMENT on the credit branch per the owner, not on master) instead of "design only" | delta §1, §11 |

## Context pack edits (temporal coherence, delta §9, §24)

| File | Before → After |
|---|---|
| `00_READ_ME_FIRST.md` | "Facts newer than the SPEC … APPLIED" → "Reconciled state … REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED" with root cause, current behaviour, exposure wording, follow-ups, `620e100e`; AUTH-SIGNUP-001 OPEN / OWNER ACTION; added §0.4/§0.5 label pointer; DO-NOT-TOUCH table gained device cleanup, production operations, M1 sync rows and the "integrate, don't rebuild" rule |
| `03_CUSTOMER_JOURNEY.md` | added the 23-stage traceability table mirroring SPEC §7.0; hazards: trigger "exists and is enabled … not a rental lifecycle"; V2 "can create … CODE CAPABILITY / never fired"; V4 precedence note |
| `05_SCREEN_REGISTRY.md` | added "What each number means" (127/30/157/175/29-28/12 buckets/13/7/6); rescued table re-labelled with the six classifications and "nothing rescued is automatically canonical" |
| `07_RENTAL_STATE_MACHINE.md` | hazard #1 → "exists and is enabled in production (PRODUCTION DATABASE STATE) … not a rental lifecycle" |
| `08_INTEGRATIONS.md` | Vercel crons → "handlers do not run (middleware 307, `middleware.test.ts:237`); not a one-line repair"; added GHL payment sync row (CODE CAPABILITY vs PRODUCTION OBSERVATION); rules gained "Queued ≠ delivered" |
| `09_GHL.md` | ownership banner lists M3…M12 items by name incl. the M7 simulator / shadow mode; M3 dev-only-not-applied, M4 dev CLI, M5/M6 design, M7–M13 planned; V2 capability/observation; V4 payload override |
| `10_CREDIT_CENTER.md` | banner splits credit capability on master / PRESERVED-RESCUED T10 / C1 in-flight + C2/C3 design / S1–S7 + customer page target; KD-38 owner = PM-16a backlog |
| `11_AIXMOS.md` | added "Remote support / HailMary — UNKNOWN, not in canon" row |
| `12_SECURITY.md` | banner gained the status vocabulary; AuthN → AUTH-SIGNUP-001 OPEN / OWNER ACTION + "containment ≠ tenant authorization"; "Done" paragraph → REMEDIATED wording ×2 with full `partner_acquisition` facts; findings table gained a Status column (mirrors SPEC §20.3; SEC-15 split note removed, SI-03 resolved); session-autopilot → LATENT RISK classification |
| `13_TESTING.md` | rehearsals `pending`; CI row; "Compiling ≠ healthy"; permissions row defines the 12 buckets |
| `14_CURRENT_STATE.md` | rewritten: "Where repo and prod diverge" table (six labels + UNKNOWN row for HailMary); status summary; build baseline; checklist statuses per §0.5; top blockers; owner decisions (+ catalog access, license option, `internal_team`); first milestone step 2/3 updated |

## Master prompt edits (delta §23; zero-history reader test)

| Before → After |
|---|
| ROLE: added who TMMT serves (three faces) and the next bounded milestone (PM-00, then PM-01) |
| §0: "One fact is newer than the spec" → reconciled note; both prod facts stated (REMEDIATED; OPEN / owner action) |
| new §0.0 "OWNED ELSEWHERE — NEVER REBUILD, NEVER RE-APPLY (fail condition)": GHL M3–M13 items by name incl. shadow mode, Credit engine, applied security remediations, Phase 2A, device cleanup, production operations, M1 sync — each with the "integrate instead via" column |
| §0.1 CURRENT list: GHL payment capability vs observation; queued ≠ delivered; V4 payload override; crons' handlers never run + not one line; enabled trigger; HailMary UNKNOWN; security REMEDIATED/OPEN/LATENT split; build baseline + CI truth |
| Rule 18: references §0.0 and adds "if the smallest correct change would rebuild one of those subsystems, the task is wrong — STOP" |
| §5 STOP: added "would rebuild anything in §0.0" and "about to switch on/repair/'just test' a dormant automation (mission-daily, Vercel crons, outbox, GHL webhooks, a send)" |
| **Verdict after fixes: PASS** — a zero-history reader is told what TMMT is, who it serves, what exists, what is broken, what is planned, which tracks are independently owned, what not to rewrite, what needs approval, the next bounded milestone, how to test and where to stop; a rebuild of GHL/Credit/security work is now an explicit STOP condition, not merely discouraged |

## Forge task edits (delta §14, §15)

| Task | Before → After |
|---|---|
| `TMMT-SEC-008` | "already applied to production" → REMEDIATED + POST-APPLICATION VERIFIED; added prepared commit `620e100e`, root cause, current behaviour, "no evidence found ≠ no access"; framed as a record/landing task owned by the other session; `internal_team` decision tracked separately |
| `TMMT-AUTH-004` | dependencies → BLOCKED on a written Phase 2A A4b answer (bind to A4b, or receive a written hand-over; no option "build a parallel auth system"); explicit STOP boundary; never claims to close AUTH-SIGNUP-001; T08 reuse note |
| `TMMT-AUTH-005` | "assert `(group)` count ≥ 12" → "≥ 11" with the 11 groups named and the 12-bucket definition |
| `TMMT-RENT-006` | objective → TMMT-side half only; inbound half (inbox, durability, routing, stage map) is GHL M6/M7; "must never grow into a second inbox/router/stage map"; shrinks if M6/M7 land first |
| `INDEX.md` | header note → REMEDIATED wording + pointer to FORGE_TRACEABILITY (57 / 0 deleted / 4 rewritten); SEC-008 row; coordination table gained device cleanup, production operations, M1 sync rows |

## Files created

`_review/DEFECT_TRACEABILITY.md` · `_review/FORGE_TRACEABILITY.md` · `_review/CONSISTENCY_LOG.md` (this file) · `EXTRACTION_FINAL_REPORT.md`. `EXTRACTION_BATON.md` updated to DONE / STOP. Inventory after the review: 111 files under `docs/product/` (35 documents incl. the owner-authored `TMMT_CLAUDE_ORCHESTRATION_PROMPT.md`, which this review read but did not edit; 57 task files; 19 evidence logs).

## Not changed (by design)

`_evidence/E1…E6` and `_evidence/_logs/*` are read-only extraction evidence dated 2026-09-21; they still describe the pre-fix `partner_acquisition` state and are cited as **historical** by the SPEC (X4). They are not edited so that the audit trail stays intact.
