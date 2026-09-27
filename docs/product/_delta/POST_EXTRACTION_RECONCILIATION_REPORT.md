# POST-EXTRACTION RECONCILIATION REPORT (lane R3, 2026-09-22 UTC)

**Lane:** R3 writer · **Inputs:** `_delta/R1_BRANCH_EVIDENCE.md`, `_delta/ACTIVE_BRANCH_OWNERSHIP_MAP.md`, `_delta/R2_CONTROLS_EVIDENCE.md`, `_delta/PRODUCTION_MIGRATION_PROVENANCE_DELTA.md`, `TMMT_CURRENT_STATE_CHECKPOINT.md`, the frozen extraction package, `TMMT_CLAUDE_ORCHESTRATION_PROMPT.md` · **Own verification:** read-only git in `C:\dev\TMMT-LIVE` (`ls-tree`, `log`, `diff --stat`, `show`, `grep` against `origin/master` and `feat/ghl-router-m7`) and a read of `_evidence/E2_route_registry.csv`. **No git write, no prod access, no deploy, no GHL, no Forge execution, no secrets, no PII.** Frozen extraction files were not edited; the checkpoint gained one appended, dated section only.

## In plain words (read this first)

- The code on the main branch moved by **one change**: two old, unused copies of the app (`apps/engine`, `aria`) were deleted. Good news; some of our documents still describe them.
- The production database has **281** recorded changes, not 279. **Six** of the newest changes have **no matching file anywhere**, and **six of the last eight** were applied **without the hand-off token** (the "baton") that is supposed to guard production. One of them (`20260922004813`, some database indexes, harmless by itself) has **no known author**. We say "unknown" honestly: nobody is cleared, nobody is accused. The owner needs to decide how to enforce the baton for real (card E).
- The **partner_acquisition** security hole is **fixed in production and verified**. The fix's file only lives on one PC; it has not been pushed. The counting rule for "unapplied migrations" needs one honest choice (rename the file → 53, or keep and map → 54).
- **Credit** moved forward: C3 is now two open draft PRs (#260, #261) with green CI, and a C4 worktree is live right now. Development only; nothing in production.
- **GHL M7** (the lead-routing engine) is written and merged on a local branch, its unit tests pass, but its database checks were not run, its backtest can route **0 of 892** leads today, and it has no final report — **not complete, not pushed**.
- A **rental rules branch** made by a cloud Claude session exists that nobody in the plan knew about. It is useful but must be reviewed by a human, split into docs and code, and never merged as-is.
- The **robot workflow** that could merge to production is still running every 6 hours. Two GitHub settings block it today; its **branch-delete** step is live. The **daily "mission" job** succeeds while doing nothing; fixing the block in front of it would switch on five other things at once, one of which writes into GoHighLevel with no off-switch. There is **no single off-switch** for TMMT writing to GoHighLevel.
- **Public sign-up** is still **unverified** (last seen open on 09-17).
- **First safe engineering task:** make sure a GoHighLevel tag can never mark a payment as "Paid" — one library file, no collisions, survives the M7 landing. It waits only on the owner saying "go" and on the owner merging it.

---

## BASELINE

Extraction package base: `origin/master` @ `4cca6835` (#254, 2026-09-21 23:44Z), prod ledger 279 (extraction figure), GHL M7 = contract only, Credit newest = C2, `partner_acquisition` REMEDIATED with "54→53" follow-up, session-autopilot LATENT RISK, mission-daily dead-green, AUTH-SIGNUP-001 unverified, 57 Forge tasks, PM-00 recommended first. Checkpoint (02:10Z) confirmed the base and listed 9 PACKAGE GAPS. Evidence lanes R1/R2 measured 02:14–02:24Z.

## NINE DELTAS (checkpoint gaps → disposition; full register in `POST_EXTRACTION_STATE_DELTA.md` §1)

| Gap | Now | Disposition |
|---|---|---|
| 1 rental branch | `claude/airtable-exit-fleet-os-kywbbl` @ `aaf79b75`, 9 commits, no PR, CI never ran, no state-machine code, CR-001 pre-decides `documents` schema, 2 merge hazards | **UNIQUE AND RELEVANT — MANUAL REVIEW**; owner names session/authorization; docs-only PR + code PR after RENT-001/ADR-001; CR-001 → PM-02/DOC-001 queue; do not merge as-is |
| 2 unrecorded DDL `004813` | performance-only, baton free, 88 s before baton 9, no artefact | **PROVENANCE UNKNOWN**; owner acknowledgement (card E); pinned by BUILD-003; NEW KD-47 covers the missing file |
| 3 `sec/c3-auth-orgroles` | = PR #261 OPEN DRAFT, CI green | SEC-001 retired as build task (review checklist for #261); AUTH-004 BLOCKED on #261 + C4 and rescoped; 2A-A12 references C3's staged repair; `login/actions.ts` ownership = owner statement |
| 4 #255 / C1–C2 | #255 CLOSED (content on master via #254); #257/#258 open drafts | documentation-only |
| 5 drift arithmetic | master 53; branch pins 54; prod version ≠ file prefix | SEC-008 statement corrected: **54 + VERSION_MAP** or **53 after rename**; landing order = owner |
| 6 AUTH-SIGNUP-001 | still UNVERIFIED (09-17 `disable_signup=false`) | OWNER ACTION (card A) |
| 7 C3 report | exists (Desktop `TMMT-PHASE-2\C3\`, 8 files); #260/#261 open; `C3_PRODUCTION_MIGRATION_MANIFEST.md` not found | milestone Credit C3; manifest UNKNOWN |
| 8 unclassified branches | `rick/integration-unified`, `m1/configurator` HISTORICAL; `fix/e2e-…` SUPERSEDED (in #251); `feat/ghl-quiet-integration-detector` UNIQUE — MANUAL REVIEW vs M3 | as stated |
| 9 Vercel state | project id confirmed; env **403** → presence UNKNOWN; GitHub protection 403 (plan) | UNKNOWN; owner reads names (cards C/D) |

New since the checkpoint (also in the register): master +1 (#259), `wt-c4`, baton-not-enforced (NEW SEC-26/KD-46), branch-delete leg live, 6 fileless ledger rows (NEW KD-47), quiet-integration-detector, M7 merged-local, mission-daily 0 recipients, middleware chain, kill-switch inventory, BUILD-004 ×5, #251 top-level migration, canonical checkout 299/211, registry rows 158–175 historical, CI on `7ded46d4` unknown, `chore/revoke-…` vs `000642` unknown. **25 rows, every one with a disposition.**

## PRODUCTION LEDGER

`supabase_migrations.schema_migrations` = **281** (newest `20260922005007`). 17 rows since 09-17, all single-statement (MCP-apply shape). Files missing on `origin/master`: **7** (rows 10, 11, 12, 14, 15, 16, 17); of these **6 have no file in any branch or worktree**, 1 (`005007`) exists only on the unpushed local `sec/partner-acquisition-rls`. `LEDGER-SNAPSHOT.txt` 273 (8 behind). `KNOWN_UNAPPLIED` master 53. Baton coverage of the 8 rows on 09-21/22: 2 under a baton (ids 8, 9), 6 with the baton free. Baton table: ids 1, 3, 4, 5, 7, 8, 9 (2 and 6 absent — UNKNOWN), 0 unreleased, status `free`. Prod facts re-verified by R2: `lead_to_active_customer_trg` ENABLED; `change_log` `ALL true` present; `is_org_tenant_admin()` absent; 0 of 8 GHL M3/M5/M6/M7 tables; 0 credit tables; `bookings` 0; `automation_outbox` 35/0 sent; `ghl_webhook_events` 0; 10 pg_cron jobs incl. `aixmos_nightly_journey_recompute` 04:30.

## UNKNOWN DDL PROVENANCE

`20260922004813 index_hot_foreign_keys_and_drop_duplicate`: drops `parties_org_idx` (duplicate of `idx_parties_organization_id`), creates 7 FK indexes (`intake_events(program)`, `incoming_leads(org_id)`, `background_checks(reviewed_by)`, `operator_training_progress(module_id)`, `coo_briefings(submitted_by)`, `memory_facts(source_event)`, `client_journey(booking_id)`) and `partner_acquisition(fleet_vehicle_id)`; comment "DELIBERATELY NOT doing all 63 the advisor lists". **No constraint, FK, policy, function, trigger or data change.** Applied 00:48:13Z with `ops.prod_baton_status()` = free; baton 9 acquired 00:49:41Z by `claude:101528f1-…` (the orchestration session) and its write applied only `partner_acquisition_least_privilege` (statements match the prepared file); the orchestration session's subagents were forbidden prod writes and reported none; **MCP `apply_migration` calls are indistinguishable by login, so a subagent — or any other MCP-connected session — cannot be technically excluded.** 0 files, 0 commits, 0 baton rows, 0 package mentions. R2-P's stylistic-similarity remark is an inference, not evidence. **Verdict: PROVENANCE UNKNOWN — stated as such; nobody cleared, nobody accused.** Needs: owner acknowledgement (card E §1), a repo artefact (KD-47 / BUILD-003), an enforcement decision (card E §2). Intersections: no index-name collision with any `wt-ghl-m*` or partner-acq migration; whether M2's `check:m2-schema` (279 pinned objects) counts indexes → UNKNOWN.

## REMOTE RENTAL BRANCH

`origin/claude/airtable-exit-fleet-os-kywbbl` (author `Claude <noreply@anthropic.com>`, suffix `kywbbl`; base `c8d72c92` = #231; 9 ahead / 148 behind `7ded46d4`; last 2026-09-22 00:27Z). 36 files, +6,549/−3: exit plan, capability matrix, CR-001/CR-002, root `CLAUDE.md` (+39 "ACTIVE PROGRAM — NATIVE AIRTABLE REPLACEMENT"), `.gitignore`, `config/retention-policy.example.json`, `docs/business-rules/01–07`, `docs/decisions/OWNER-DECISION-PACK.md`, `evidence/*` (706 attachment records / 293 identity documents / 15 uncaptured `customScript` bodies), `scripts/extract-attachments.ts`, `scripts/parity-check.ts`, `src/lib/rules/**` (01 eligibility REFUSES; 04 partner economics PORTED; 02/03/05/06/07 not ported), `src/lib/automation/**` (envelope: `dryRun` default true, `maxAffectedRecords` required, DNC fails closed, owner approval mandatory; 47 tests NOT RUN), `_staged/20260922000000_attachment_provenance_STAGED.sql` (12 provenance columns on `documents` + `vehicle_media`, `customer_email DROP NOT NULL`, 2 partial UNIQUE + 2 indexes, 7 private buckets; not counted by the drift test). **No state-machine code**; doc 05 keeps the five Airtable vehicle states and offers INFERRED transitions "for the owner to correct". Conflicts with the extraction: CR-001 pre-decides what SPEC §9.3 assigns to PM-02/ADR-001/DOC-001/DATA-005; doc 05 vs SPEC §10.2 vehicle machine (RENT-001/005 own it; the branch is an input); `CLAUDE.md` block = governance collision with the orchestration/builder prompts. Merge hazards: `.gitignore` would **un-ignore `.outbox/`** (PII drafts); `_staged/README.md` lacks master's `20260915120000` row. Overlaps PM-05, PM-02, PM-06, PM-18/COMM-001/002/SEC-003, DOC-001/DATA-005. **Classification: UNIQUE AND RELEVANT — MANUAL REVIEW.** Recommendation (R1, adopted): owner names the session and decides authorization; split (a) docs → `docs/airtable-exit/` PR, (b) `src/lib/rules` + `src/lib/automation` → PR after RENT-001 + ADR-001 with PM-18 reviewing the envelope, (c) CR-001 → decision queue, never applied from this branch; fix both hazards; **open a PR (any) so `verify` runs**; keep it away from session-autopilot's delete leg; **do not merge as-is; do not build on it.**

## OTHER REMOTE BRANCHES

117 remote refs (30 with worktrees). Active (< 7 days) remote-only: rental branch (above), `feat/credit-c1-grounded-cases` (#257), `feat/credit-c2-case-lifecycle` (#258), `m1/remove-superseded-prototypes` (MERGED #259), `feat/partner-acquisition` (SUPERSEDED, #255 closed, 0-line diff), `feat/aixmos-storefront` (merged #253), `feat/ghl-quiet-integration-detector` (`61e56791`, 1 ahead, no PR — `integration-freshness.ts` + test, `/api/health`, `ghl-verify-inbound.mjs`, an OWNER-RUN SQL; **not** part of M0–M7 → **MANUAL REVIEW by the GHL owner vs M3**), `feat/inspection-walkaround` (#251 OPEN READY; contains `fix/e2e-stops-writing-to-production`; carries a **top-level** migration `20260917120000_training_progress_by_journey.sql` → `KNOWN_UNAPPLIED` impact; overlaps RET-001, BUILD-002/004 → MANUAL REVIEW), `fix/e2e-…` (SUPERSEDED), `rick/integration-unified-2026-09-17` and `m1/configurator` (0 ahead, HISTORICAL). Stale with unique commits: `carry/tmmt-front-door-on-master` (#232 OPEN, touches `src/middleware.ts`, likely SUPERSEDED), `fix/ghl-key-one-place`, `port/venture-console`, `fix/captain-dispatch-degraded-signal`, `chore/revoke-user-execute-internal-definer-fns` (09-08; same as prod `000642`? UNKNOWN → MANUAL REVIEW), audit/chore/preview trio (docs may be unique), `fix/org-id-uuid-validation` (MANUAL REVIEW), 9 dormant July `claude/*` (inside the autopilot scope), 10 July experiment branches. 10 orphan histories (`backup/*`, `rescue/*`, `main`, `feat/credit-dispute-command`, `claude/organize-chats-sessions-7t7zjy`, …) — **never merge**. `comms/g02-internal-destinations` is 0 ahead but **#243 is still an OPEN DRAFT** (stale PR). Local-only unpushed with unique work: 13 GHL M0–M7 branches, `docs/tmmt-ghl-master-audit`, `docs/tmmt-master-extraction-2026-09-21` (this package, uncommitted), `sec/partner-acquisition-rls`, `feat/c4-provisioning-preview`.

## GHL CURRENT STATE

**Master (`7ded46d4`):** unchanged from the pack `09` "Current implementation" (one env bearer, one location, empty stage map, webhooks signed but never received a verified event, only live path = off-repo M1 poller). **Kill switches (R2 §17):** 4 outbound primitives, 7 live call paths, 5 with no switch, `GHL_AUTO_OPS` default ON (non-overridable), `GHL_FORM_AUTO_CASE` default ON (payload-overridable), 0 dedicated kill switch, 0 DB flag, 0 dry-run, `sendConversationMessage` 0 call sites, Vercel env presence UNKNOWN; scripts under `scripts/` (5 files) are outside the runtime. **Track (branches, none pushed, none on master, 0 tables on prod):** M0–M2 (`320c92c0`, final report), M3–M4 (`49688afb`, final report), M5–M6 (`7fd69d9a`, `M5_M6_FINAL_REPORT.md`, `KNOWN_UNAPPLIED` 58), **M7 `f17e8f69`**: contract COMPLETE (`GHL_ROUTING_ENGINE_CONTRACT.md`, simulator spec, backtest dataset, A-1…A-6 in blockers, "no blocker closed"); DB lane `36eeefbf` (`20260924100000_m7_routing_rules_and_decisions.sql`, 745 lines, CREATE-only, `routing_decisions` kind `'SIMULATED'` only, **NOT applied**; rehearsal `check:m7-routing-db` NOT RUN by R1); engine lane `0dbbd471` (`src/lib/routing-engine/**`, `scripts/routing/simulate.mjs`, `/api/admin/routing/simulate`); merged locally (`423788a0`, `8ca8545f`), backtest `0dbc00d8` (**892 leads, ACTUAL ROUTABLE 0**: 783 `HISTORICAL_UNRESOLVED_LEAD`, 37 `OWNERSHIP_UNCONFIRMED`, 44 `INTAKE_NOT_ROUTABLE`, 1 `NO_CONFIG_VERSION`; hypothetical 37 routable, all NOT_READY), matrix V3 ("Nothing is active"); **R1 ran vitest: 9 files, 123/123 pass**; `check:m7-combined`, `test:m7-mutations` need a DB → NOT RUN; full suite not run; `KNOWN_UNAPPLIED` 59; **no `M7_FINAL_REPORT.md`** → by the track's own convention **NOT COMPLETE (ACTIVE DEVELOPMENT / PARTIAL)**; nothing pushed; no PR. M7 rewrites `src/app/api/webhooks/ghl/route.ts` (→ `src/lib/ghl-webhooks/**`), `handlers/form.ts`, `ghl-voice-handler.ts`; leaves `client.ts`, `ghl-payment-sync.ts`, `token-ledger.ts`, `referrals.ts`, overdue route, `stage-rules.ts`, `sync-outbound.ts`, `sync-contact-portal-fields.ts`, `aixmos-prequal-act.ts` untouched (this lane). Outbound freeze intact; M7 adds no GHL write. Release blockers B-1…B-8 all OPEN. **Do not continue M7** (GHL track's decision; prompt §7/§12).

## CREDIT CURRENT STATE

Master: owner desk, CROA gate closed, KD-28 open (credit track). Branches: **C1** `feat/credit-c1-grounded-cases` `3d6e87fb` = **#257** OPEN DRAFT (verify pass) → **C2** `feat/credit-c2-case-lifecycle` `8da9af5f` = **#258** OPEN DRAFT base C1 (MERGEABLE/CLEAN) → **C3 credit** `feat/credit-c3-security-foundation` `6cd8da38` (worktree `wt-credit-c1`, clean) = **#260** OPEN DRAFT base C2 (verify pass 5m12s): recipients registry, template approvals, GHL status contract (unwired), stale-page guards, prod-shape fixture, three rehearsals, `_staged/20260923120000_credit_recipients_and_template_approvals_STAGED.sql`, rewrite of `_staged/20260922120000_credit_case_foundation_STAGED.sql`; **C3 auth** `sec/c3-auth-orgroles` `3233ccf7` (worktree `wt-c3-auth`, clean) = **#261** OPEN DRAFT base master (MERGEABLE/CLEAN): open-redirect fix, invite lifecycle, staged `org_roles_repair` (16 checks / 9 mutations rehearsed), staged `signup_invites_v2`, `login/actions.ts` edits. **C4** `feat/c4-provisioning-preview` `987b0f40` (worktree `wt-c4`, **3 untracked, live session**, no PR, no remote) = merge of #260 + #261 heads "so all four staged migrations rehearse together". Reports: `Desktop\TMMT-PHASE-2\C3\` 8 files (its "nothing was pushed" is superseded); `C3_PRODUCTION_MIGRATION_MANIFEST.md` (named in #261) **not found**. Report-claimed tests (not re-run): credit 2730/0, auth 2379; `next build` on auth confirmed by CI. **DEVELOPMENT ONLY**: 4 staged migrations, 0 credit tables on prod, CROA gate closed, nothing sent, no GHL wiring, `/my-credit` middleware entry flag-off on branch. Readiness rows 13 (public sign-up) and 17 (org_roles STAGED) = owner actions. Chain: #257 → #258 → #260; #261 independent. **DO NOT TOUCH `wt-c4`.**

## SECURITY CURRENT STATE

| Finding | Status (newest verified) |
|---|---|
| `partner_acquisition` (SEC-01/KD-01) | **REMEDIATED / POST-APPLICATION VERIFIED** (3 policies, `USING(true)` absent, RLS on, grants trimmed, view `security_invoker`, 0 rows; ledger `005007`, baton 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`). File only on local `620e100e` (no remote). Public form live via #254 → prod policies are the only guard. `internal_team` denied by design. Exposure: no evidence found, not proven absent. |
| `profiles` self-admin escalation (2A-A1) | **REMEDIATED + VERIFIED** (trigger enabled; ledger `20260921234148`, baton 8); CI suite on #256. Historical; do not describe as open. |
| AUTH-SIGNUP-001 (SEC-02) | **UNVERIFIED / OWNER ACTION** (09-17 `disable_signup=false`; 3 users, 0 new, 0 invites) — card A |
| session-autopilot (SEC-04/KD-04) | **RUNNING WORKFLOW + LATENT MERGE RISK; delete leg LIVE**; blocked by Actions `can_approve_pull_request_reviews:false` + `allow_auto_merge:false`; protection impossible on plan — card B |
| mission-daily (SEC-11/KD-12) | RUNNING, inert (307); team = 0 recipients; owner path exists — card C |
| Middleware machine routes (SEC-11/KD-11) | 8 routes 307'd; fix chain of 7 with two HIGH (`/api/license/heartbeat` unauthenticated write + oracle; `/api/ops/command` → outbound GHL, no switch) — card C |
| GHL-set business state / payments / DNC (KD-05, KD-06, SEC-08) | OPEN, latent; inventory in card D; V2b-token stays open even after SEC-002-LIB |
| Open redirect (SEC-09/KD-14) | OPEN on master; **fix on #261** (CI green) |
| `org_roles` recursion (SEC-13/2A-A12) | OPEN on prod; repair **staged on #261** (also a partial on 2A) — owner + baton |
| `change_log` `ALL true` (SEC-12) | OPEN, verified; its creating migration `20260921230719` has **no file** (KD-47) |
| `lead_to_active_customer_trg` (KD-07) | ENABLED, verified |
| **NEW SEC-26/KD-46** baton not enforced for MCP applies | 6 of last 8 prod DDL applies un-batoned — card E |
| **NEW KD-47** 6 prod-only DDL rows with no artefact | card E + BUILD-003 |
| `aria/` unauthenticated chat (SEC-22/KD-43) | **REMEDIATED-BY-DELETION** (#259) pending a green master `verify` |
| `is_staff()` global, edge B-4/B-5, ANON-TENANT-001, PARTNER-TENANT-001, cross-org signed URLs, default ACL, PII in logs | OPEN, unchanged, no newer evidence |

## PR STATUS (`gh`, 02:16–02:24Z; R1 DELTA 12)

Open **8**: drafts #256 (2A regression), #257 (C1), #258 (C2, base C1), #260 (C3 credit, base C2), #261 (C3 auth) — all CI green, MERGEABLE, merge = deploy; stale #232 (front door, touches middleware), #243 (0-ahead head), #251 (inspection; top-level migration). **#259 MERGED** 02:19:46Z = `origin/master`. **#255 CLOSED unmerged** 01:30Z (content on master via #254). #254 merged 23:44Z = extraction base. Chain #257 → #258 → #260; #261 and #256 standalone. 0 open PRs have a `claude/*` head.

## AUTO-MERGE STATE

`allow_auto_merge:false`; Actions `default_workflow_permissions:"read"`, `can_approve_pull_request_reviews:false`; branch protection/rulesets 403 (private repo, free plan); `delete_branch_on_merge:false`; master unprotected; every merge deploys `tmmt-ops` (`vercel.json` `git.deploymentEnabled.master: true`). `session-autopilot.yml`: cron `0 */6`, `contents: write` + `pull-requests: write`, 10/10 `success`, `gh pr create` refused silently (FS-18), merge line never reached, **delete leg live** (needs only `contents: write`; fires at `AHEAD == 0`, not yet fired). Dangerous changes: Actions setting ON (11 PRs in 6 h); + `allow_auto_merge` ON + a `master` ruleset (needs Pro/public) → unattended merges = prod deploys; editing `--auto` out; any `claude/*` reaching parity (live). Required checks would be `verify` + `pii-scan` only (no E2E, SQL rehearsals or isolation tests).

## AUTH-SIGNUP STATE

UNVERIFIED / OWNER ACTION. No committed publishable key on master (`.env.example` blank; only prose/redacted fragments), so R2 did not query `GET /auth/v1/settings`. Last direct evidence 2026-09-17 `disable_signup=false`. #261 changes no Auth setting; C4 moves `signUp` server-side (dev only). Card A.

## PM-00 OWNER ACTIONS

`PM00_OWNER_ACTION_CARDS.md`: **A** sign-up toggle + A4b ownership · **B** session-autopilot option A/B + keep both repo settings OFF + rental branch out of the delete leg's reach · **C** mission-daily default/disable + per-route opening decisions + BUILD-006 A/B + env names (Claude cannot read Vercel env: 403) · **D** `GHL_AUTO_OPS=false`/`GHL_FORM_AUTO_CASE=false` now (baton) + choke-point design/default + whether 5 unswitched paths may run + env names · **E** acknowledge 6 un-batoned applies and `004813` UNKNOWN, enforcement (process/technical/both), backfill policy for 6 fileless rows, `KNOWN_UNAPPLIED` landing order. Plus checkpoint §8 items 5–11 still open (land `620e100e`; classify the rental branch; review drafts and stale PRs; baton-gated applies; the extraction's open decisions; local hygiene).

## TRACK COLLISIONS (R1 DELTA 4; verified additions by this lane)

1. SEC-001 ↔ #261 (`safe-redirect.ts`, `callback/route.ts`): FULL DUPLICATE → retire SEC-001. 2. `login/actions.ts`: reserved for 2A, edited by #261 → owner records the A4b implementer. 3. AUTH-004 ↔ #261 `signup_invites_v2` + C4: PARTIAL/HIGH → BLOCKED, rescope to rental bindings. 4. AUTH-005 ↔ credit stack `/my-credit` middleware row: LOW → sequence. 5. `org_roles` repair packaged on 2A (`sec/2a-profiles-regression` in-test candidate) and C3 (`_staged/20260923140000`, complete) → C3's is the single artefact. 6. `signup_invites` naming: v2 must land via baton with a snapshot line. 7. AUTH-SIGNUP-001: dependency, no collision. 8. BUILD-004 hunk on #256/#257/#258/#260/#261 → close after first merge. 9. `KNOWN_UNAPPLIED` 53/54/53/53/58/59 → guaranteed conflict; owner fixes the landing order. **New (this lane):** 10. SEC-002 route half ↔ M7 rewrite of `webhooks/ghl/route.ts` (logic moved to `app-processors.ts`) → lib-only slice. 11. SEC-007 precedence fix ↔ M7 edit of `handlers/form.ts` → apply on M7. 12. SEC-003 voice call sites ↔ M7 rewrite of `ghl-voice-handler.ts` → wire after M7. 13. Rental branch `.gitignore`/`_staged/README.md` ↔ master. 14. Rental branch CR-001 ↔ PM-02/DOC-001/DATA-005 ownership. 15. #251 top-level migration ↔ drift constant. 16. #232 ↔ `src/middleware.ts`.

## BUILDER IMPACT

`BUILDER_CONTEXT_DELTA.md` (14 points): master `7ded46d4` + deleted `apps/engine`/`aria` (registry rows 158–175 historical; 157 canon rows unaffected — verified); ledger 281 + 6 fileless rows; `partner_acquisition` remediated (file local-only); C3/C4 exist (do not touch `wt-c4`); M7 merged-local not complete (GHL-owned files in flux listed); rental branch exists (do not build on it); collision list; canonical-checkout warning (299/211 behind); kill-switch reality; workflow facts; AUTH-SIGNUP unverified; `KNOWN_UNAPPLIED` note; cards pending; first task.

## FORGE TASK IMPACT

`POST_EXTRACTION_STATE_DELTA.md` §2. Stale/blocked/duplicated: **SEC-001** (duplicate of #261 → retire/review checklist) · **SEC-002** (route half collides with M7; split lib-only) · **SEC-003** (voice sites rewritten by M7; lib-only first) · **SEC-004** (add Actions setting; delete leg live) · **SEC-005** (facts refined; no scope change) · **SEC-007** (form.ts edited by M7; apply there) · **SEC-008** (53/54 statement; no remote; #255 clauses stale) · **AUTH-004** (BLOCKED on #261 + C4; rescope) · **AUTH-005** / **AUTH-001** (middleware rebase on credit stack) · **BUILD-001** (after cards C/D) · **BUILD-003** (281; 6 prod-only rows) · **BUILD-004** (on five PRs; close after first merge) · **BUILD-006** (confirmed) · **AI-002** (STALE: folders deleted; retire or rewrite as "never return" guard) · **DATA-002** (exclusion no-op) · **ADR-001 / RENT-001 / RENT-005** (rental branch docs = inputs) · **DOC-001 / DATA-005** (CR-001 pre-decides schema/buckets → decision queue) · **COMM-001/002 + SEC-003** (envelope duplicates the pattern → PM-18 review) · **RENT-006** (review target = M7 code) · **INDEX.md** (open-PR list, step 2). No task file edited.

## FIRST RECOMMENDED ENGINEERING TASK

**TMMT-SEC-002-LIB** — `src/lib/ghl-payment-sync.ts` + its test only: `recordGhlPayment` always `Pending`, always `collected:false` (+`verified:false`); stops V2 and the referral commission on both master's route and M7's `app-processors.ts` (both guard on `collected`); token grant (fires on tag alone) handed to the GHL owner as an M7 integration note. Verified zero collisions (file untouched since 2026-08-22 on every branch/PR); survives the M7 landing; no schema/env/prod/GHL. Red-then-green tests incl. negatives (non-revenue event → no insert; insert error; duplicate ref). STOP: one file + test. **Waits on:** owner authorization of this one task (prompt §60) and owner + baton for the merge. **Not** on cards A–E. Details and the rejected alternatives: `FIRST_BOUNDED_TASK_RECOMMENDATION.md`.

## UNRESOLVED QUESTIONS

1. Who applied `20260922004813` (and, by extension, the other five un-batoned rows)? — UNKNOWN; owner decides whether to request attestations.
2. Is `chore/revoke-user-execute-internal-definer-fns` (`20260908201941`) the same change as prod `20260922000642`? — MANUAL REVIEW.
3. Baton ids 2 and 6 missing from `ops.prod_write_baton` — failed/removed acquisitions? — UNKNOWN.
4. Did the `verify` run on master `7ded46d4` go green? — not observed (in progress at 02:24Z).
5. Where is `C3_PRODUCTION_MIGRATION_MANIFEST.md` (named in #261's body)? — not found.
6. Which GHL / cron / license / Telegram env variables exist in Vercel Production (names only)? — 403 to Claude; owner.
7. Who owns `claude/airtable-exit-fleet-os-kywbbl` and is "Workstream A/B" authorized? — owner.
8. Who owns `feat/ghl-quiet-integration-detector`, and is it M3-compatible? — GHL owner.
9. Does GHL M2's `check:m2-schema` (279 pinned objects) count indexes, i.e. does `004813` (+7/−1) break it? — UNKNOWN, not tested.
10. Rename (53) or VERSION_MAP (54) for `620e100e`; and the landing order vs 58/59 and #251? — owner.
11. Who implements 2A-A4b (`login/actions.ts`): the C3/C4 session or 2A? — owner statement.
12. Does `wt-c4`'s in-progress `c3-production-package.rehearsal.mjs` change the C3 staged files again before review? — unknown until that session reports.

## FILES WRITTEN (this lane; all under `docs/product/_delta/` except the appendix)

- `_delta/POST_EXTRACTION_STATE_DELTA.md` (25-row delta register + Forge task impact)
- `_delta/PM00_OWNER_ACTION_CARDS.md` (cards A–E)
- `_delta/FIRST_BOUNDED_TASK_RECOMMENDATION.md` (TMMT-SEC-002-LIB + alternatives)
- `_delta/BUILDER_CONTEXT_DELTA.md`
- `_delta/POST_EXTRACTION_RECONCILIATION_REPORT.md` (this file)
- `TMMT_CURRENT_STATE_CHECKPOINT.md` — **appended** section "## Reconciliation 2026-09-22" only; original findings untouched.

Not edited: SPEC, READINESS, ROADMAP, context pack, master prompt, Forge task files, `_evidence/*`, `_review/*`, R1/R2 lane files.

## Known stale statements in the frozen snapshot (by design — listed, not edited)

Line numbers as read on 2026-09-22.

| File | Line(s) | Stale statement | Now |
|---|---|---|---|
| `EXTRACTION_FINAL_REPORT.md` | 30 | "M5/M6 design; M7–M13 planned … M7 separately authorized" | M0–M6 integrated on branches with final reports; M7 merged-local, NOT COMPLETE |
| same | 33 | "C1 uncommitted; C2 = the next credit iteration; C3+ = design" | C1 #257, C2 #258, C3 #260/#261, C4 live |
| same | 36 | "`aria/` and `apps/engine` orphaned" | deleted by #259 |
| same | 39 | "auto-merge (off today; recent merges human)"; "`partner_acquisition` … follow-ups: `KNOWN_UNAPPLIED` 54→53" | delete leg live; 54 + map or 53 after rename |
| same | 45 | "279 vs 89 migrations" | 281 vs 89 (+7 rows without master file) |
| `TMMT_MASTER_BUILD_SPEC.md` | 49, 1239 | "PR #255 open to feed it"; "54→53" | #255 CLOSED; arithmetic corrected |
| same | 65, 482, 817, 1552 | "279" | 281 |
| same | 66, 1117, 1242, 1507, 1524, 1652 | session-autopilot "latent" / "auto-merge off" | latent merge + LIVE delete leg; Actions setting is the first blocker |
| same | 208–209, 462, 472, 1166, 1184–1185, 1260, 1563, 1580 | `apps/engine` / `aria/` exist (ORPHANED / retire) | deleted (#259) |
| same | 1027, 1145 | "M7 separately authorized … did not re-verify"; "C1 uncommitted; C2 = next" | see above |
| `TMMT_FLAGSHIP_READINESS_REPORT.md` | 44, 110 | "279 vs 89" | 281 |
| same | 53, 172–173 | 175 rows incl. `apps/engine` 13 / `aria` 5; retire list | rows 158–175 historical |
| same | 118, 216 | "PR #255 open / hold"; "54→53" | closed; corrected |
| same | 120, 170, 201 | session-autopilot "auto-merge off; recent merges human" | delete leg live |
| `TMMT_ROADMAP.md` | 118 | "54→53"; "Hold PR #255" | corrected; closed |
| same | 120 | 00-c "LATENT RISK: auto-merge off" | + live delete leg; Actions setting |
| same | 436, 485 | "Retire `aria/` and `apps/engine`" | done by #259 |
| `TMMT_BUILDER_MASTER_PROMPT.md` | 37 | "PR #255 release" | closed |
| same | 54 | "auto-merge (off today; master unprotected)" | delete leg live |
| same | 78 | "279 prod migrations vs 89" | 281 |
| `TMMT_BUILDER_CONTEXT/00_READ_ME_FIRST.md` | 42, 58, 72 | "54→53"; "279"; "PR #255 stays on hold" | corrected; 281; closed |
| `05_SCREEN_REGISTRY.md` | 7, 16–17, 21, 65 | 175 rows; `apps/engine` 13 / `aria` 1+4; 13 `apps/engine` LEGACY pages | rows 158–175 historical; 157 canon unchanged |
| `06_DATA_MODEL.md` | 7 | "279 rows; 89 files" | 281 |
| `08_INTEGRATIONS.md` | 37 | "`session-autopilot.yml` (latent auto-merge / branch delete)" | delete leg live |
| `09_GHL.md` | 7, 25–40 | "M3 dev-only; M4 dev CLI; M5/M6 design; M7 planned … M7 separately authorized" | M0–M6 integrated with final reports; M7 merged-local, not complete |
| `10_CREDIT_CENTER.md` | 5, 7 | "C1 uncommitted; C2 = next; C3+ = DESIGN ONLY" | C3 = #260/#261; C4 live |
| `11_AIXMOS.md` | 12, 34–35, 69 | `apps/engine`, `aria/` present | deleted |
| `12_SECURITY.md` | 21 | "`KNOWN_UNAPPLIED` 54→53" | corrected |
| same | 27 | "PR #255 stays on hold" | closed |
| same | 30, 56 | SEC-04 "auto-merge off; recent merges human"; "can enable auto-merge … once the owner follows its setup comment" | delete leg live; Actions setting is the first gate |
| same | 48 | SEC-22 `aria/` OPEN | REMEDIATED-BY-DELETION pending green verify |
| `14_CURRENT_STATE.md` | 13–16 | "279 migrations"; "M5/M6 design"; "C1 uncommitted; C2 next"; "session-autopilot LATENT RISK (auto-merge off)" | 281; M7 merged-local; C3/C4; delete leg live |
| same | 100 | "#255 … hold" | closed |
| `FORGE_TASKS/INDEX.md` | 19 | SEC-008 "54→53" | corrected |
| same | 62 | AI-002 quarantine `aria/` / `apps/engine` | stale (deleted) |
| same | 91, 95 | "PR #255 hold"; "deletion of `aria/` / `apps/engine`" (owner item) | closed; done |
| `FORGE_TASKS/TMMT-SEC-001_…` | whole task | build task | implemented on #261 |
| `FORGE_TASKS/TMMT-SEC-002_…` | 20–23, 34 | `route.ts:136-185` call sites; route in scope | M7 moved them to `app-processors.ts`; route GHL-owned |
| `FORGE_TASKS/TMMT-SEC-003_…` | 23, 37 | voice handler call sites | rewritten by M7 |
| `FORGE_TASKS/TMMT-SEC-004_…` | 17 | "latent only because `allow_auto_merge=false` and Actions cannot create PRs" (correct) — but branch-delete described as "live code", not "live leg" | refined |
| `FORGE_TASKS/TMMT-SEC-007_…` | 23, 33 | `form.ts:135-137` in scope | edited by M7 |
| `FORGE_TASKS/TMMT-SEC-008_…` | 7, 17, 26, 40, 62 | "54→53"; "#255 stays on hold / do not touch PR #255" | corrected; closed |
| `FORGE_TASKS/TMMT-AUTH-004_…` | 39 | "written answer from the Phase 2A owner" | now #261 + C4 exist |
| `FORGE_TASKS/TMMT-AI-002_…` | whole task | quarantine READMEs + guard | folders deleted |
| `FORGE_TASKS/TMMT-BUILD-003_…` | 17, 59 | "279" | 281 |
| `FORGE_TASKS/TMMT-BUILD-004_…` | whole | "2 Windows-only failures" | fix already on five PRs |
| `FORGE_TASKS/TMMT-DATA-002_…` | 54 | exclude `apps/engine`, `aria/` | no-op |
| `_review/DEFECT_TRACEABILITY.md` | 12, 15, 43, 54, 58, 84 | "54→53"; KD-04 latent; "279"; KD-43 OPEN; totals; "aria/apps/engine deletion" deferred | corrected; delete leg live; 281; REMEDIATED-BY-DELETION pending; deletion done |
| `_review/FORGE_TRACEABILITY.md`, `_review/CONSISTENCY_LOG.md`, `_review/FINAL_REVIEW_DELTA.md` | 12; 19, 24, 31, 34, 36; 16 | records of the 09-22 review (counts, "LATENT RISK" classification) | historical record; classification refined |
| `S2_SPEC_ISSUES.md` | 10 | "54→53" | corrected |
| `EXTRACTION_BATON.md` | 12 | "54→53" | corrected |
| `_evidence/E1…E6`, `E2_route_registry.csv` | E1:224, E1:250, E2:18–19, E2:148–165, E2 CSV rows 158–175, E3:117, E5:113/127/146–147/170/250, E6:222/296/309/316/328 | dated evidence (09-21): `apps/engine`/`aria` present, 279, #255 ready, autopilot latent | evidence files are dated snapshots by design; do not edit |
| `TMMT_CURRENT_STATE_CHECKPOINT.md` (original body) | 15–20, 28–31, 50, 51, 53, 79–80, 87, 103, 143, 147, 152–158 | "0 drift"; "279 → 281" row; M7 DESIGN ONLY; C3 local/no PR; "no C3 report"; autopilot "auto-merge off only because the plan cannot enable it"; §11 SEC-002 route scope; §12 "Master: yes (0 drift)"; gaps 1–9 | superseded by the appended "## Reconciliation 2026-09-22" section (original lines left intact) |
| `TMMT_CLAUDE_ORCHESTRATION_PROMPT.md` | 34, 57 | "M7 separately authorized"; "C1/C2" | owner-authored standing rules; not edited; M7 now merged-local, C3/C4 exist |

## STOP STATUS

**STOPPED.** This lane wrote documents only. No implementation, merge, apply, deploy, GHL call, send, workflow/setting change, Forge execution, secret or PII handling occurred. The next action is the owner's: cards A–E, and authorization (or not) of TMMT-SEC-002-LIB.


---
## Orchestrator addendum (2026-09-22, after R3)

- **Resolved:** `verify` on master `7ded46d4` completed **success** at 02:19:49Z (read-only `gh run list`). KD-43 (apps/engine, aria orphans) is therefore REMEDIATED-BY-DELETION, not pending.
- **Restated for the record on `20260922004813`:** the orchestration session's baton-9 write applied only `partner_acquisition_least_privilege`; its subagents were forbidden production writes and reported none; MCP `apply_migration` calls are indistinguishable by login, so no session can be technically excluded. PROVENANCE UNKNOWN stands. The enforcement gap (SEC-26/KD-46) is the actionable item, not attribution.
- Everything else in this package is as R1/R2/R3 wrote it. STOP.
