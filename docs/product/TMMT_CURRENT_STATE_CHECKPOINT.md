# TMMT CURRENT STATE CHECKPOINT

**Produced:** 2026-09-22 ~02:10 UTC · **By:** Claude orchestration session (per `TMMT_CLAUDE_ORCHESTRATION_PROMPT.md` §59/§60/§65) · **Extraction baseline read:** `EXTRACTION_FINAL_REPORT.md` (baton STOPPED 2026-09-22), SPEC, READINESS, ROADMAP, `TMMT_BUILDER_CONTEXT/14`, `FORGE_TASKS/INDEX.md`, `_review/*`.
**Nothing was implemented, committed, pushed, deployed, applied, sent or switched on.** Production was read as catalog metadata, `supabase_migrations.schema_migrations`, `ops.prod_baton_status()` and aggregate counts only. This file is the only file written. Remote git refs were last fetched 2026-09-22 01:14Z; the live GitHub API was queried directly where it mattered (master SHA, PRs, deployments, workflow runs).

Status words follow §4 (WORKING · PARTIAL · BROKEN · MISSING · DESIGN ONLY · ACTIVE DEVELOPMENT · BLOCKED · HISTORICAL · SUPERSEDED · UNKNOWN); CURRENT is always distinguished from TARGET.

---

## 1. Canonical repo / branch / HEAD

| Item | Verified value |
|---|---|
| Canonical repo | `AIXMOS537/TMMT`, `origin/master` |
| `origin/master` HEAD | **`4cca6835`** (PR #254, 2026-09-21 23:44Z). Live GitHub API `branches/master` returns the same SHA at query time. |
| Extraction base commit | `4cca6835` |
| **HEAD drift since extraction base** | **0 commits.** Nothing has landed on master since the extraction closed. |
| Production deployment | GitHub deployment record `env=Production` for `4cca6835` at 2026-09-21 23:48Z (vercel[bot], success). All four newer deployments (`22d37377`, `3d6e87fb`, `70c3d919`, `8da9af5f`) are **Preview** only. Verified via GitHub deployments API, not via Vercel. |
| Local canonical checkout caveat | `C:\dev\TMMT-LIVE` main worktree is checked out on `docs/owner-action-sheet` @ `4773a1da` (2026-09-08; 298 behind master, 0 ahead). Local `refs/heads/master` = `074fa9a6`, 210 behind `origin/master`. Desktop `WORK-BATON.md` (22:06 local) still says "TMMT-LIVE ... on master" — stale. Anyone using the local `master` ref as canon will be working on a 2-week-old tree. Read-only observation; not corrected here. |
| Commits landed since base, by track | **None on master.** All track work is on branches (see §3). |

**Package reconciliation on this item:** the extraction package is correct on HEAD. Two package statements are now stale: (a) `14_CURRENT_STATE.md` / SEC-008 list **PR #255 `feat/partner-acquisition` as open/on hold** — it was **CLOSED unmerged at 2026-09-22 01:30Z**; its content (`src/app/forms/partner-apply/page.tsx`) is **already on master and deployed**, squashed in with PR #254 (commit `aad50d47` is not an ancestor, the file is). The public partner-apply intake is therefore LIVE on prod at `4cca6835`, guarded only by the prod-side policies verified in §6. (b) Its three creating migrations (`20260921233425`, `20260921233517`, `20260922000537`) are on the prod ledger and **not in the repo** (confirmed in the partner-acq fix package and by master's migration tree).

## 2. Production-vs-repository divergence

| Measure | Value (verified 2026-09-22 02:05Z) | Extraction said |
|---|---|---|
| Prod `schema_migrations` rows | **281**, max `20260922005007` | 279 |
| Ledger rows dated 2026-09-22 | 4: `000537 fix_v_partner_pipeline_security_invoker`, `000642 revoke_anon_execute_on_internal_helpers`, `004813 index_hot_foreign_keys_and_drop_duplicate`, `005007 partner_acquisition_least_privilege` | `000642` cited in E3; `005007` recorded everywhere; **`004813` appears nowhere in the package** |
| Repo `supabase/migrations/**/*.sql` @ `4cca6835` | 105 = 88 top-level + 13 `_staged` + 4 `_parked`; newest top-level `20260919221500` | 89 + 12 + 4 (one file classified differently, likely `_staged/TRIAGE_ADVERSARIAL_TESTS.sql`) |
| Drift register on master | `KNOWN_UNAPPLIED = 53` (`src/lib/db/migration-drift.test.ts:55`); `LEDGER-SNAPSHOT.txt` = 273 versions | SEC-008 says landing `620e100e` moves "54 → 53"; master is already 53 — **needs review** (the constant may have to move 53 → 54 when the branch adds its file, or the branch records it as applied; not resolved here) |
| `profiles` fix file vs ledger | repo file `20260917160000_profiles_protect_access_columns.sql` on master; prod ledger version `20260921234148` (version-string drift; PR #256 draft records it) | consistent |
| Prod baton | `ops.prod_baton_status()` → `{"state":"free"}`; `ops.prod_write_baton`: 7 rows, max id 9, 0 unreleased | "baton 9" = partner_acquisition apply, consistent |

**Ledger drift since extraction: +2 rows.** One (`005007`) is the documented P0 apply. The other (`20260922004813 index_hot_foreign_keys_and_drop_duplicate`, applied ~00:48Z) is an **unrecorded production DDL write** as far as the extraction package is concerned: no package file, no Forge task, no baton reference names it. Whether it was applied under baton id 8 or 9, or outside the baton, is UNKNOWN from read-only evidence (baton row contents were not read). **NEEDS REVIEW by the owner.**

**Prod facts re-verified now (catalog / aggregates):** `lead_to_active_customer_trg` ENABLED on `incoming_leads` (KD-07 still live) · `change_log` policy `authenticated ALL USING(true) WITH CHECK(true)` still present (SEC-12 OPEN) · `is_org_tenant_admin()` absent (org_roles 42P17 recursion still live) · 0 of 8 GHL M5/M6/M7 tables exist · 0 credit case tables exist · `bookings` 0 · `automation_outbox` 35 total / 0 sent · `ghl_webhook_events` 0 · `customer_payments` 31 · `incoming_leads` 892 · `partner_acquisition` 0 rows · `auth.users` 3 (0 created since 2026-09-17) · `signup_invites` 0 rows.

## 3. Active worktrees (36 registered under `C:\dev`)

Ahead/behind is against `origin/master` (`4cca6835`). "behind 4" = the four #252/#253/#254-era commits.

| Worktree | Branch @ HEAD | Ahead / behind | Last commit | Inferred track / owner | State |
|---|---|---|---|---|---|
| `wt-master-extraction` | `docs/tmmt-master-extraction-2026-09-21` @ `4cca6835` | 0 / 0 (docs uncommitted) | — | MASTER EXTRACTION (this session) | STOPPED; only `docs/product/**` |
| `wt-ghl-audit` | `docs/tmmt-ghl-master-audit` @ `5aefcd2d` | 2 / 67 | 09-21 22:18Z | GHL | docs |
| `wt-ghl-m0`, `-m1`, `-m2`, `-m0m2` | `feat/ghl-router-m0` `95e8fe6e` · `-m1-app` `3faf4103` · `-m2` `053de1f4` · `-m0-m2` `320c92c0` | 7 · 14 · 4 · 30 / 4 | 09-21 22:47–23:16Z | GHL M0–M2 | ACTIVE DEVELOPMENT, integrated in `m0-m2` (final report committed) |
| `wt-ghl-m3db`, `-m4app`, `-m3m4` | `-m3-db` `8649ac28` · `-m4-app` `99e030bf` · `-m3-m4` `49688afb` | 32 · 34 · 42 / 4 | 09-21 23:48Z–00:07Z | GHL M3/M4 | ACTIVE DEVELOPMENT, integrated in `m3-m4` (final report) |
| `wt-ghl-m5`, `-m6`, `-m5m6` | `-m5` `543a4d11` · `-m6` `8f723845` · `-m5-m6` `7fd69d9a` | 46 · 46 · 55 / 4 | 09-22 00:40–01:29Z | GHL M5/M6 | ACTIVE DEVELOPMENT, integrated in `m5-m6` (final report `M5_M6_FINAL_REPORT.md`) |
| `wt-ghl-m7`, `-m7db`, `-m7eng` | `-m7` `962f983a` · `-m7-db` = `-m7-engine` = `0f5cc899` | 58 · 56 · 56 / 4 | 09-22 01:40–01:49Z | GHL M7 | **DESIGN ONLY** (3 docs-only commits over `m5-m6`; `src/` and `supabase/` untouched; db/engine branches carry no code yet) |
| `wt-credit-c1` | `feat/credit-c3-security-foundation` @ `6cd8da38` (local; `a27e20c5` + 1) | 6 / 4 | 09-22 02:06Z | CREDIT C1→C2→C3 stack | ACTIVE DEVELOPMENT; C1 = PR #257 draft, C2 = PR #258 draft (stacked), C3 local, no PR |
| `wt-2a-profiles` | `sec/2a-profiles-regression` @ `70c3d919` | 3 / 4 | 09-22 00:23Z | SECURITY Phase 2A (A1/A3) | PR #256 draft; records prod apply of profiles fix + adversarial suite + CI |
| `wt-c3-auth` | `sec/c3-auth-orgroles` @ `3233ccf7` | 2 / 0 | 09-22 01:55Z | SECURITY / C3 account provisioning (C3-001…006) | ACTIVE DEVELOPMENT; no PR; **newer than the extraction** |
| `wt-sec-partner-acq` | `sec/partner-acquisition-rls` @ `620e100e` | 1 / 0 | 09-22 00:30Z | SECURITY P0 workstream | prepared commit; policy applied on prod; **branch not landed, no PR** |
| `wt-profiles-lock`, `wt-grants`, `wt-baton`, `wt-drift-register`, `wt-queue-migrations`, `wt-quarantine`, `wt-owner-decision`, `wt-c20-webhook-replay`, `wt-c21-llm-cap`, `wt-c21a`, `wt-c21b`, `wt-c21c`, `wt-g01-stager`, `wt-g02`, `wt-g02-internal` | PRs #249, #240, #239, #247, #248, #241, #235, #237, #238, #244, #245, #246, #236, #242, #243 | **0 ahead** (137–145 behind) | 09-16/17 | CLEANUP/INFRA, COMMS, SMS-agent containment | HISTORICAL / merged (PR #243 `g02-internal-destinations` is still an open draft although its branch is 0 ahead — needs review) |
| `TMMT-docs-wt` | `docs/owner-model` @ `4bf865fd` | 0 / 307 | 09-01 | docs | HISTORICAL |
| `C:\dev\TMMT-LIVE` (main) | `docs/owner-action-sheet` @ `4773a1da` | 0 / 298 | 09-08 | docs | HISTORICAL checkout on the canonical clone (see §1) |

**Remote-only branches with recent activity and no local worktree (not in the extraction package):**
- `origin/claude/airtable-exit-fleet-os-kywbbl` @ `aaf79b75` (**2026-09-22 00:27Z**, 36 files, +6,549): "rental: Airtable exit plan, capability matrix, native rules engine core, automation safety envelope, owner decision pack, staged CR-001 `attachment_provenance` migration". Touches `src/lib/rules/**`, `src/lib/automation/**`, `docs/business-rules/**`, adds a root `CLAUDE.md`. **This is an active rental/fleet-rules track the extraction package does not know about**; it overlaps PM-05 (rental rules/state) and PM-02 (business rules) by subject. Owner and authorization UNKNOWN. Because it is a `claude/*` branch it is inside `session-autopilot.yml`'s scope (§7).
- `origin/feat/ghl-quiet-integration-detector` (09-20), `origin/rick/integration-unified-2026-09-17`, `origin/fix/e2e-stops-writing-to-production` (09-17), `origin/m1/configurator` (09-14): not classified by the package; UNKNOWN.

## 4. Active subsystem tracks (§6)

| Track | CURRENT position | Evidence |
|---|---|---|
| PRODUCT / PM roadmap | **Not started.** PM-00 is the recommended first milestone; no PM- task has a branch. | ROADMAP §5, INDEX §2; no branch named for any TMMT-* task |
| GHL milestones | M0–M6 integrated on branches with final reports; M7 contract/spec committed, engine not written; nothing merged, nothing applied, outbound freeze intact | §5 |
| CREDIT CENTER | C1 (PR #257 draft) → C2 (PR #258 draft, stacked) → C3 (local commits, no PR); all dev-only, staged SQL not applied, CROA gate closed | §6 |
| SECURITY | Two prod remediations verified (profiles, partner_acquisition); Phase 2A regression PR #256 draft; C3 auth/org_roles package staged; AUTH-SIGNUP-001 open | §7 |
| CLEANUP / INFRASTRUCTURE | Baton, drift register, agent-queue backfill merged (09-16/17); 15 merged worktrees still registered | §3 |
| MASTER EXTRACTION / BUILDER CONTEXT | DONE / STOP; docs uncommitted on `docs/tmmt-master-extraction-2026-09-21` | `EXTRACTION_BATON.md` |
| **Unclassified: Airtable-exit / Fleet OS rules** | ACTIVE DEVELOPMENT on `origin/claude/airtable-exit-fleet-os-kywbbl` (00:27Z today) | §3 — **PACKAGE GAP** |

## 5. GHL milestone state (reconciled against the prompt's §7)

Latest integrated report found: `Desktop\TMMT-GHL-ROUTER\M5_M6_FINAL_REPORT.md` (dated 2026-09-22; branch `feat/ghl-router-m5-m6`, report commit `7fd69d9a`; earlier `M0_M2_FINAL_REPORT.md`, `M3_M4_FINAL_REPORT.md` in the same folder and on their branches).

- **WHAT EXISTS (development only, verified on branches):** M0 test/env safety; M1 trusted intake + org contract; M2 schema codification (279 in-scope objects, `check:m2-schema` 4/4); M3 connection registry migration (NOT applied); M4 read-only discovery CLI (dry-run default); **M5** identity normalization + `ghl_resolve_contact_identity` + `ghl_contact_links` / `ghl_opportunity_links` + `identity_review_items` (migration `20260923100000`, NOT applied); **M6** durable webhook inbox with lease-fenced claim, idempotency precedence, bounded retry, dead letter, admin-only replay, stale-lease recovery, durable `promote_failed` + `ghl_repromote_contact` (migration `20260923110000`, NOT applied); combined M5/M6 adversarial rehearsal 10/10; vitest 2,705 pass at `330249f5`; E2E **BLOCKED BY ENVIRONMENT** (no non-prod Supabase). `ghl_contacts UNIQUE(ghl_contact_id)` preserved as the M1-sync compatibility boundary. No `ghl_outbox` (asserted by test). **M7:** `GHL_ROUTING_ENGINE_CONTRACT.md`, `GHL_ROUTING_SIMULATOR_SPEC.md`, `GHL_ROUTING_BACKTEST_DATASET.md` committed 2026-09-22 01:40–01:49Z on `feat/ghl-router-m7`; blockers doc records activation dependencies A-1…A-6 and "no blocker closed".
- **WHAT DOES NOT:** none of M0–M7 is on master; 0 of the M3/M5/M6/M7 tables exist on prod; no M7 engine code (`src/lib/routing-engine/` absent on every branch); no shadow mode; no live routing; no GHL write path. Positions in the prompt (§7 "M0–M4, M5, M6 progressed; M7 authorized") are **confirmed as branch-level development**, not production capability. The extraction's older E6 positions ("M5/M6 design", "M7 planned") are SUPERSEDED by the branch evidence.
- **EVIDENCE:** git log/diff of `feat/ghl-router-m5-m6..m7`; `M5_M6_FINAL_REPORT.md`; prod `information_schema` (0/8 tables).
- **RISK:** release blockers B-1 (99 unresolved historical leads), B-2 (M1 migration unapplied), B-3 (app undeployed), B-4/B-5 (edge functions), ANON-TENANT-001, B-7 (no E2E env), PARTNER-TENANT-001 — all OPEN; R-9…R-13 tracked; A-3 means nothing is routable until the owner confirms location ownership (D-1).
- **NEXT BOUNDED ACTION (GHL track's, not this lane's):** M7 engine implementation against the committed contract, pure function + golden tests, zero writes — only if the owner confirms M7 authorization covers implementation (the prompt says "separately authorized"; the branch says "committed before implementation").

## 6. Credit milestone state (C1/C2 reports)

Reports: `Desktop\TMMT-PHASE-2\C1\CREDIT_C1_IMPLEMENTATION_REPORT.md`, `C2\CREDIT_C2_IMPLEMENTATION_REPORT.md`, `C2\CREDIT_C2_SECURITY_REPORT.md`; C3 has spec/package docs only (`C3\*.md`), **no C3 implementation or security report yet**.

- **WHAT EXISTS (dev only):** C1 `feat/credit-c1-grounded-cases` @ `3d6e87fb` = **PR #257 draft** (pushed 2026-09-22 00:25Z; the extraction's "uncommitted" is SUPERSEDED). C2 `feat/credit-c2-case-lifecycle` @ `8da9af5f` = **PR #258 draft, base = C1 branch** (01:10Z): customer assertion lifecycle, evidence (bytes-decided types, private bucket, 2-min signed URLs), exact-content approval hash, sent/response recording, justified follow-up, immutable prior rounds, timeline, compare-and-swap writes, C1 browser-import blocker fixed; mutations SQL 9/9 + app 11/11 caught. C3 `feat/credit-c3-security-foundation` @ `6cd8da38` (local, 02:06Z, not pushed): recipient registry, fingerprint-bound template approvals, GHL status-only contract (unwired), stale-page guards, `credit_operator_grants` replacing role-based access, staged `credit_recipients_and_template_approvals`, evidence-file adversarial tests.
- **WHAT DOES NOT:** nothing on master; `20260922120000_credit_case_foundation_STAGED.sql` and the C3 staged file NOT applied (0 credit tables on prod); no customer Credit Center in production (feature-flagged off, `/my-credit` middleware entry on branch only); CROA attorney gate closed; nothing sent; no GHL wiring.
- **EVIDENCE:** PR list, branch diffs (C1 27 files / C2 40 / C3 stack 51 files), prod table count.
- **RISK:** production blockers named by C2: AUTH-SIGNUP-001, staged migration (owner + baton), CROA/counsel register, **org_roles 42P17 recursion** (now packaged on `sec/c3-auth-orgroles`, still live on prod). D-22b (perform-vs-refer) OPEN. KD-28 (ungated `[id]`, CPN ban) is on the credit track's branch path, not verified closed on master.
- **NEXT BOUNDED ACTION (credit track's):** publish the C3 implementation + security report and open the stacked draft PR; owner decides the C1→C2→C3 review order. PM lane touches no credit file (INDEX: PM-14 has no tasks).

## 7. Security state (newest verified evidence)

| Finding | CURRENT status | Newest evidence |
|---|---|---|
| **`partner_acquisition` broad RLS (SEC-01/KD-01)** | **REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED.** Verified again now: policies are `partner_acq_anon_insert` (anon INSERT), `partner_acq_authenticated_intake_insert` (authenticated INSERT), `partner_acq_platform_admin_all` (ALL); the historical `partner_acq_authenticated ALL USING(true)` is **gone** and must be described only as a HISTORICAL defect. Ledger `20260922005007`, baton 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`, prepared commit `620e100e`. `internal_team` intentionally denied. Exposure window (~51 min): no evidence found, not proven absent. | prod `pg_policies` 2026-09-22 02:05Z; branch `sec/partner-acquisition-rls` |
| ↳ follow-ups | OPEN: branch landing (no PR yet), drift-register reconciliation (master already 53 — needs review), `internal_team` product decision. **New fact:** the public form is already deployed via #254, so the prod policies are the only guard on that intake today. | §1, §2 |
| **`profiles` self-admin escalation (2A-A1)** | **REMEDIATED + VERIFIED**: trigger `profiles_block_protected_self_edits` ENABLED on prod; ledger `20260921234148`, baton 8. Adversarial suite + CI in PR #256 (draft). Historical context and tests preserved. | prod `pg_trigger`; PR #256 |
| **AUTH-SIGNUP-001** | **OPEN / OWNER ACTION.** Newest *verified* evidence: `GET /auth/v1/settings` → `disable_signup=false` on **2026-09-17** (`docs/security/PROFILES-ACCESS-COLUMNS.md`); C2 security report and C3 provisioning architecture ("measured 2026-09-21") restate it open. **Not re-verified in this checkpoint** (requires the public key; not fetched). Aggregate only: 3 `auth.users`, 0 created since 09-17, 0 `signup_invites` rows — no observed abuse, not proof. A4a (dashboard toggle) undone; A4b (server-side invite, `signup_invites` v2) **staged on `sec/c3-auth-orgroles`**, not applied. Closing signup does not solve tenant authorization (C3 §1 designs for a hostile signed-in account). | 2A plan A4; C3 package |
| **Auto-merge classification (SEC-04/KD-04)** | **OPEN — LATENT RISK, and the workflow is ACTIVE.** `session-autopilot.yml` runs on schedule every 6 h (last three runs 2026-09-21 11:45Z, 17:41Z, 21:34Z, all success); each run iterates `claude/*` branches, attempts `gh pr create` then `gh pr merge --auto --merge`. Auto-merge itself is unavailable (branch-protection API → 403 "Upgrade to GitHub Pro"), so it falls through with a log line — **auto-merge is off only because the plan cannot enable it**, not by decision. Master is unprotected; every merge is a prod deploy. `claude/airtable-exit-fleet-os-kywbbl` is in its scope. The extraction's "auto-merge off; recent merges human" is accurate but understates that the workflow keeps trying. | `gh run list`, run `35657996638` log, `.github/workflows/session-autopilot.yml` @ `4cca6835` |
| `mission-daily.yml` | Runs daily (last 2026-09-21 18:33Z, "success") with defaults `audience=team, notify=true`; its handler is 307'd by middleware, so it is dead-green (KD-12). Unchanged. | `gh run list` |
| Open redirect (SEC-09/KD-14) | OPEN on master; **fix exists on `sec/c3-auth-orgroles`** (`src/lib/safe-redirect.ts`, 49 tests, 6 red on old route). Dev-only, no PR. **Collides with TMMT-SEC-001** (same file, same helper name). | branch diff |
| `org_roles` recursion (2A-A12) | OPEN on prod (`is_org_tenant_admin` absent); repair + `operator_training_progress` scope fix **staged** `20260923140000_org_roles_repair_STAGED.sql` on `sec/c3-auth-orgroles`, rehearsed on prod catalog shape 16/16, 9/9 mutations. Owner + baton to apply. | C3 package; prod `pg_proc` |
| `change_log` authenticated ALL true (SEC-12) | OPEN, verified now. | prod `pg_policies` |
| `lead_to_active_customer_trg` (KD-07) | ENABLED, verified now. | prod `pg_trigger` |
| `is_staff()` global, GHL-set business state, DNC bypass, middleware/machine APIs, cross-org signed URLs, default-ACL TRUNCATE, PII in logs, `aria/`, edge functions B-4/B-5, ANON-TENANT-001, PARTNER-TENANT-001 | OPEN, unchanged from extraction; no newer evidence found. | READINESS §5; GHL blockers |
| Unrecorded prod DDL `20260922004813` | **NEEDS REVIEW** (see §2). | ledger |

## 8. Open owner actions

1. **AUTH-SIGNUP-001 / 2A-A4a:** turn off public signup (1-minute dashboard toggle) or state why not; then decide A4b landing (`sec/c3-auth-orgroles`).
2. **session-autopilot (00-c / SEC-004):** decide neutralise vs keep; it is running every 6 h.
3. **mission-daily (00-d / SEC-005):** owner-only / no-notify / disable — must precede any middleware machine-route fix.
4. **GHL kill-switch env values (00-e / SEC-007).**
5. **Land `sec/partner-acquisition-rls` @ `620e100e`** (assign the landing session; open the PR; settle the drift-register arithmetic).
6. **Account for `20260922004813 index_hot_foreign_keys_and_drop_duplicate`** — which session, which baton, why unrecorded.
7. **Classify/own `origin/claude/airtable-exit-fleet-os-kywbbl`** (rental rules engine + staged CR-001 migration) against PM-02/PM-05 and the GHL/Credit tracks; it is not in the extraction package.
8. Review draft PRs **#256, #257, #258** (all MERGEABLE; merge = deploy; C1/C2 stay flag-off) and stale open PRs **#232, #243, #251**.
9. Baton-gated applies queued behind decisions: org_roles repair (C3), `lead_to_active_customer` disable (DATA-001), `change_log` policy (SEC-006), credit foundation (C-track), GHL M1/M3/M5/M6 (GHL track).
10. Still-open decisions from the extraction: read-only catalog access, `/api/license/*`, canonical vehicle table, role source, portal URL shape, payment processor, signing provider, D-22b, non-production Supabase (B-7), `internal_team` access, GHL D-1…D-10 (ownership confirmation).
11. Local hygiene (read-only observation): `C:\dev\TMMT-LIVE` sits on a 2-week-old docs branch; 15 merged worktrees remain registered; `WORK-BATON.md` describes a stale branch state.

## 9. Top product blockers (unchanged; re-verified where prod-visible)

1. No rental state machine / event log; `lead_to_active_customer_trg` still enabled (verified). 2. No processor-verified payments (31 `customer_payments` rows, 0 GHL-sourced). 3. No agreements / e-sign. 4. No customer login path (0 invites, tier `none` → `/no-access`). 5. No safe customer messaging (35 queued / 0 sent, verified). 6. Two vehicle tables, 9+ person tables, 0 active vehicles, 0 bookings (verified). 7. Repo cannot rebuild prod (281 ledger rows vs 88 top-level files; 6/7 edge functions unversioned).

## 10. Top security blockers

1. AUTH-SIGNUP-001 (owner action; last verified open 09-17). 2. Unprotected master + **actively scheduled** autopilot with auto-merge code (one plan/settings change from unattended prod deploys). 3. Middleware blocks machine APIs; fixing it re-arms mission-daily's team broadcast. 4. GHL-tag → `customer_payments` capability (never fired). 5. GHL stage auto-verify + V4 payload override. 6. DNC bypass on outbound GHL writes. 7. Open redirect (fix on a branch, not merged). 8. `org_roles` 42P17 recursion hiding an uncorrelated cross-tenant `operator_training_progress` policy (repair staged). 9. Global `is_staff()`. 10. No isolation/privilege tests in CI (PR #256 adds the profiles ones). Also: `change_log` ALL true, edge functions B-4/B-5, ANON-TENANT-001, cross-org signed URLs, default ACL, unrecorded ledger row `004813`.

## 11. Recommended next bounded task (one task, §39 verification)

**Recommendation: no code task should be handed to Forge or started until the owner clears the four PM-00 decisions (items 1–4 in §8) and answers §8 items 5–7.** The extraction's own first step (ROADMAP §5, INDEX §2 step 1) is "owner decisions first", and this checkpoint found three ownership/dependency facts the package did not have. Concretely, when the owner is ready, the **first bounded engineering task this lane can own without collision** is:

**TMMT-SEC-002 — GHL tags/events never create "Paid" payments / commissions / tokens** (PM-00 item 00-f; SPEC SEC-05, KD-05, V2/V2b).
- **Ownership verified:** `src/lib/ghl-payment-sync.ts` is untouched on every GHL branch (M0–M7) and on every other ref since 2026-09-15; no open PR touches it.
- **Dependency verified:** none blocking. One coordination: the task also edits `src/app/api/webhooks/ghl/route.ts`, which **M6 rewrites** (`83da495d`, "every GHL webhook route goes through the inbox"). To avoid a merge collision, scope the first PR to `ghl-payment-sync.ts` (status decision: never `paid`, never commission/token writes) + its tests, and hand the route-level removal of the two downstream calls to the GHL track as an M6 integration note. Red-then-green tests, no schema change, no prod write, no GHL call.
- **STOP boundary:** one PR; no middleware, no webhook-route refactor, no M6 files.

**Why not the obvious alternatives:** TMMT-SEC-001 (open redirect) is **already implemented on `sec/c3-auth-orgroles`** — assigning it would duplicate work; the right move is for the owner to have that branch's owner open a PR. TMMT-SEC-008 is owned by the partner-acq session. TMMT-BUILD-004 (Windows-safe tests) is already on three branches (`c3073a90`/`3d6e87fb`). SEC-004/005/006/007 and DATA-001 are owner-decision or baton items.

## 12. Verdict on "do the package, the repository and the branches still agree?"

**Master: yes** (0 drift). **Prod: +2 ledger rows, one unexplained.** **Branches: mostly yes, with five package-stale facts** — #255 closed and its form already deployed; C1/C2 pushed as draft PRs; a C3 security branch exists with the open-redirect fix and org_roles repair; the autopilot is actively scheduled; and a rental-rules track exists outside the package. GHL M0–M6 branch progress matches the prompt's §7; M7 is contract-only. Credit C1/C2 match the prompt's §15; C3 is newer.

## PACKAGE GAPS

1. **`origin/claude/airtable-exit-fleet-os-kywbbl`** (rental rules engine, automation envelope, owner decision pack, staged `attachment_provenance` migration; latest 2026-09-22 00:27Z) is absent from the extraction, the roadmap, the defect map and the Forge traceability. Its owner, authorization and relationship to PM-02/PM-05 are UNKNOWN. Cannot be classified without the owner.
2. **`20260922004813 index_hot_foreign_keys_and_drop_duplicate`** on the prod ledger is not mentioned anywhere in the package; provenance UNKNOWN from read-only evidence.
3. **`sec/c3-auth-orgroles` (C3-001…006)** post-dates the package: open-redirect fix (collides with TMMT-SEC-001), staged `signup_invites` v2, staged org_roles repair. The package's SEC-001 and AUTH-004 tasks need re-scoping against it.
4. **PR #255 status** (closed; content deployed via #254) and **C1/C2 now pushed as PRs #257/#258** — the package's "open/on hold" and "uncommitted" statements are superseded.
5. **Drift-register arithmetic:** SEC-008's "KNOWN_UNAPPLIED 54→53" does not match master's constant (53); the package does not say what the branch's file does to the count.
6. **AUTH-SIGNUP-001:** the package cites it as "unverified"; the newest verified read is 2026-09-17 (`disable_signup=false`). No newer verification exists in any report found; this checkpoint did not perform one.
7. **C3 credit milestone** has no implementation/security report yet; the package's "C2 = next iteration" is one step behind the branch.
8. Remote branches `feat/ghl-quiet-integration-detector`, `rick/integration-unified-2026-09-17`, `fix/e2e-stops-writing-to-production`, `m1/configurator` are unclassified by the package.
9. Vercel production state was verified only through GitHub deployment records, not the Vercel API; edge-function versions and env kill-switch values were not re-read.

**STOP.** Awaiting owner authorization of the next bounded task. No implementation follows from this checkpoint.

---

## Reconciliation 2026-09-22

**Appended by lane R3 (post-extraction drift reconciliation), 2026-09-22 UTC, after the two evidence lanes measured 02:14–02:24Z.** The original findings above (02:10Z) are left exactly as written; where a line below disagrees with them, the lane evidence is newer and wins. Full package: `docs/product/_delta/` — `POST_EXTRACTION_STATE_DELTA.md` (25-row register + Forge impact), `PM00_OWNER_ACTION_CARDS.md` (cards A–E), `FIRST_BOUNDED_TASK_RECOMMENDATION.md`, `BUILDER_CONTEXT_DELTA.md`, `POST_EXTRACTION_RECONCILIATION_REPORT.md`; evidence: `R1_BRANCH_EVIDENCE.md`, `ACTIVE_BRANCH_OWNERSHIP_MAP.md`, `R2_CONTROLS_EVIDENCE.md`, `PRODUCTION_MIGRATION_PROVENANCE_DELTA.md`. Nothing was implemented, merged, applied, deployed, sent or switched on.

### Superseded lines in this checkpoint

| Checkpoint said | Now (verified) |
|---|---|
| §1 "HEAD drift since extraction base: **0 commits**"; §12 "Master: yes (0 drift)" | **+1**: `origin/master` = **`7ded46d4`** (PR #259, 02:19:46Z, "remove apps/engine and aria" — 45 files, −10,591; `git ls-tree origin/master apps/engine aria/` empty). CI `verify` on that push was `in_progress` at 02:24Z. Local checkout now **299** behind, local `master` **211** behind. |
| §5 "M7 **DESIGN ONLY** (3 docs-only commits)"; §12 "M7 is contract-only" | **M7 merged-local**: `feat/ghl-router-m7` @ `f17e8f69` — contract COMPLETE, DB lane written (`20260924100000` NOT applied), engine lane written, 123/123 routing unit specs pass (run by R1), SQL/mutation checks NOT RUN, backtest ACTUAL ROUTABLE 0/892, no `M7_FINAL_REPORT.md` → **NOT COMPLETE**, nothing pushed. M7 rewrites `webhooks/ghl/route.ts`, `handlers/form.ts`, `ghl-voice-handler.ts`. |
| §3/§6 "C3 local, no PR"; §6 "no C3 implementation or security report yet"; PACKAGE GAP 7 | **C3 = PR #260** (credit, base C2) **+ PR #261** (auth/org_roles, base master), both OPEN DRAFT, CI green; C3 report folder exists (`TMMT-PHASE-2\C3\`, 8 files); **C4** live worktree `wt-c4` (`feat/c4-provisioning-preview`, dirty, no PR) — do not touch. Newest credit milestone = **C3/C4**, not C2. |
| §2 "`004813` … under baton 8 or 9, or outside the baton, is UNKNOWN" | Applied **00:48:13Z with the baton FREE**, 88 s before baton 9; performance-only (7 FK indexes + 1 duplicate dropped; no constraint/policy/FK change); no file, commit or baton row anywhere; the baton-9 session's write applied only `partner_acquisition`; its subagents were forbidden prod writes and reported none; MCP applies are indistinguishable by login so no session can be technically excluded → **PROVENANCE UNKNOWN** (nobody cleared, nobody accused). |
| §2 "Ledger drift since extraction: +2 rows" | 281 rows confirmed; **6 rows since 09-21 have no file in any branch or worktree**, and **6 of the last 8 prod DDL applies were made with the baton free** → NEW process defect **SEC-26/KD-46 (proposed): baton not enforced for MCP `apply_migration` / other sessions**; NEW **KD-47 (proposed): prod-only DDL with no artefact**. Owner card E. |
| §7 "auto-merge is off only because the plan cannot enable it" | Two independent blockers, in order: repo **Actions setting** `can_approve_pull_request_reviews:false` (refuses `gh pr create`) and `allow_auto_merge:false`; **the branch-delete leg is LIVE** for any `claude/*` at parity (needs only `contents: write`). Status: **RUNNING WORKFLOW + LATENT MERGE RISK**. 11 `claude/*` PRs would auto-open if the Actions setting flips. Owner card B. |
| §7 mission-daily "dead-green (KD-12). Unchanged." | Team audience today = **0 recipients** (`profiles.telegram_chat_id` 0 rows; anon RLS 0); owner audience = one Telegram. Middleware fix opens a **chain** (journey-recompute doubles pg_cron job 9; `/api/license/heartbeat|provision` unauthenticated writes; `/api/license/revoke` remote wipe if `ADMIN_KEY`; `/api/audit/events`; `/api/ops/command` `approve_sync` → outbound GHL with no switch). "Do not just fix cron." Owner card C. |
| §7 "GHL-set business state … OPEN, unchanged" | Inventory: 4 outbound primitives / 7 live call paths / **5 with no switch** / 1 env non-overridable (`GHL_AUTO_OPS` default ON) / 1 payload-overridable (`GHL_FORM_AUTO_CASE`) / 0 dedicated kill switch / 0 DB flag / 0 dry-run; Vercel env presence UNKNOWN (403). Owner card D. |
| §7 AUTH-SIGNUP-001 "OPEN / OWNER ACTION … not re-verified" | **UNVERIFIED / OWNER ACTION** — no committed publishable key on master, so no newer `GET /auth/v1/settings`; last evidence 2026-09-17 `disable_signup=false`. Owner card A. |
| §2 / PACKAGE GAP 5 "`KNOWN_UNAPPLIED` 54→53 … needs review" | Correct statement (R1 DELTA 9): master **53**; landing `620e100e` as-is measures **54** (file prefix `20260922003000` is in no snapshot; prod recorded `20260922005007`) → honest landing = **54 with a VERSION_MAP note**, or **53 only if the file is renamed `20260922005007_…`** plus a snapshot line. The file exists only on the **local** branch (no `origin/sec/partner-acquisition-rls`). Constant is 58 (M5/M6) / 59 (M7) on GHL branches → guaranteed conflict point; owner fixes the landing order. |
| §7 `partner_acquisition` row (already REMEDIATED) | Re-verified by R2 on prod: 3 policies, `USING(true)` absent, RLS on, grants trimmed, view `security_invoker`, 0 rows, ledger `005007`, baton 9 → **PRODUCTION REMEDIATED / POST-APPLICATION VERIFIED**. Unchanged; restated for completeness. |
| §11 recommended TMMT-SEC-002 scoped to `ghl-payment-sync.ts` **+ the two downstream calls in the webhook route** | Route half now collides with M7 (route rewritten; logic moved to `src/lib/ghl-webhooks/app-processors.ts`). Recommendation becomes **TMMT-SEC-002-LIB** (library file + test only; verified untouched on every branch since 2026-08-22; survives the M7 landing). See `_delta/FIRST_BOUNDED_TASK_RECOMMENDATION.md`. |
| §3 remote-only branches "UNKNOWN" (GAP 8) | `rick/integration-unified-2026-09-17`, `m1/configurator` = HISTORICAL (0 ahead); `fix/e2e-stops-writing-to-production` = SUPERSEDED (inside #251); `feat/ghl-quiet-integration-detector` = UNIQUE AND RELEVANT — MANUAL REVIEW by the GHL owner vs M3. |
| §1 "#255 CLOSED … squashed in with PR #254 (commit `aad50d47` is not an ancestor, the file is)" | Confirmed by R1: `git diff origin/master origin/feat/partner-acquisition -- <its two files>` = 0 lines. Unchanged. |

### The nine PACKAGE GAPS → dispositions

1. Rental branch `claude/airtable-exit-fleet-os-kywbbl` → **UNIQUE AND RELEVANT — MANUAL REVIEW**; no state-machine code; CR-001 pre-decides PM-02/DOC-001 schema; `.gitignore` (drops `.outbox/` ignore) and `_staged/README.md` merge hazards; recommendation: docs-only PR + code PR after RENT-001/ADR-001, open a PR for CI, **do not merge as-is, do not build on it**; owner names the session (§8 item 7 stays open).
2. `20260922004813` → **PROVENANCE UNKNOWN**, performance-only, un-batoned, fileless; owner card E; KD-47 / BUILD-003 for the artefact.
3. `sec/c3-auth-orgroles` → PR #261; **SEC-001 retired as a build task** (its acceptance list = review checklist for #261); **AUTH-004 BLOCKED on #261 + C4** and rescoped to rental bindings; 2A-A12 references C3's staged repair; `login/actions.ts` ownership = owner statement.
4. #255 closed / C1–C2 PRs → **documentation-only** (stale clauses listed in the report).
5. Drift arithmetic → **SEC-008 statement corrected** (see table); landing order = owner.
6. AUTH-SIGNUP-001 → **OWNER ACTION (card A)**.
7. C3 report → exists; **milestone Credit C3/C4**; `C3_PRODUCTION_MIGRATION_MANIFEST.md` not found (UNKNOWN).
8. Unclassified branches → classified (see table); quiet-integration-detector = MANUAL REVIEW.
9. Vercel state → env presence **UNKNOWN** (403); owner reads names (cards C/D).

### Owner actions (supersedes §8 items 1–4; items 5–11 stay open)

Cards **A** sign-up · **B** session-autopilot (+ Actions PR-creation setting stays OFF, + live delete leg) · **C** mission-daily + the middleware chain (do not just fix cron) · **D** GHL kill switches (what exists / what has none / options) · **E** baton enforcement gap + backfill policy for 6 fileless ledger rows + `004813` acknowledgement — `_delta/PM00_OWNER_ACTION_CARDS.md`. Nothing performed.

### Forge tasks affected (no task file edited)

SEC-001 (duplicate of #261) · SEC-002 (route half ↔ M7; lib-only) · SEC-003 (voice sites ↔ M7) · SEC-004 (Actions setting; live delete leg) · SEC-005 (facts) · SEC-007 (`form.ts` ↔ M7) · SEC-008 (53/54; no remote; #255) · AUTH-001/004/005 · BUILD-001/003/004/006 · AI-002 (STALE: folders deleted) · DATA-002 · ADR-001, RENT-001, RENT-005, RENT-006 · DOC-001, DATA-005 (CR-001) · COMM-001/002 (envelope) · INDEX.md — details in `_delta/POST_EXTRACTION_STATE_DELTA.md` §2.

**STOP (2026-09-22, lane R3).** Reconciliation only; awaiting the owner's cards A–E and authorization of TMMT-SEC-002-LIB.
