# R1 — REPOSITORY / BRANCH / PR / TRACK EVIDENCE (post-extraction drift, lane R1)

**Measured:** 2026-09-22 02:14–02:24Z on BRAINIAC-7, from `C:\dev\TMMT-LIVE` (canonical clone) and the registered worktrees. **Read-only.** Commands run: `git --no-optional-locks fetch origin` (twice: 02:14Z and 02:20Z — remote-tracking refs only), `log` / `show` / `diff` / `ls-tree` / `worktree list` / `branch -r` / `rev-list` / `merge-base` / `status --porcelain`, `gh pr list|view|checks`, `gh run list`, `gh api GET`, and one vitest run of M7 unit specs inside `C:\dev\wt-ghl-m7` (node_modules already present). Nothing was checked out, merged, committed, pushed, applied or deployed. Production was **not** queried (lane R2). Companion table: `ACTIVE_BRANCH_OWNERSHIP_MAP.md`.

Read first, unedited: `EXTRACTION_FINAL_REPORT.md` (closeout 2026-09-22) and `TMMT_CURRENT_STATE_CHECKPOINT.md` (02:10Z). This file records where the repository moved after those two.

---

## DELTA 7 — Canonical identity vs the local checkout

| Item | Verified value (02:20Z) |
|---|---|
| Canonical repository | `AIXMOS537/TMMT`, remote `origin` = `https://github.com/AIXMOS537/TMMT.git` |
| `origin/master` HEAD | **`7ded46d49ff4d646dca1b587303ac8fed916dc28`** — 2026-09-22 02:19:46Z — "chore: remove apps/engine and aria — superseded copies, not unfinished work (#259)". `gh api repos/AIXMOS537/TMMT/branches/master` returned the same SHA. |
| Drift since extraction base `4cca6835` | **+1 commit** (#259). The checkpoint (02:10Z) said 0; #259 merged nine minutes later. #259 deletes `apps/engine/**` and `aria/**` and drops both from `tsconfig` excludes — the extraction registry's 13 `apps/engine` + 5 `aria` rows are now HISTORICAL on master. |
| CI on that push | `Verify (local-first gate)` run created 02:19:49Z was still `in_progress` at 02:24Z; `PII Guard` success. Not proof of a green build yet. |
| Local checkout `C:\dev\TMMT-LIVE` | branch **`docs/owner-action-sheet`** @ `4773a1da` (2026-09-08 18:06Z), **0 ahead / 299 behind** `origin/master`. Working tree clean. |
| Local `refs/heads/master` | `074fa9a6` — **211 behind** `origin/master`, 0 ahead. |
| Rule for future agents | The path `C:\dev\TMMT-LIVE` (and its Desktop junction) is **not master**. Read master only as `origin/master` after a fetch, or in a worktree whose HEAD equals the SHA above. Desktop `WORK-BATON.md` still claims "TMMT-LIVE ... on master" — stale (not corrected by this lane). |

Commands: `git -C C:\dev\TMMT-LIVE --no-optional-locks fetch origin` · `git log -1 --format='%H %ci %s' origin/master` · `git branch --show-current` · `git rev-list --left-right --count HEAD...origin/master` · `git rev-list --left-right --count refs/heads/master...origin/master` · `gh api repos/AIXMOS537/TMMT/branches/master`.

---

## DELTA 2 — `origin/claude/airtable-exit-fleet-os-kywbbl`

### Shape
- **Merge-base with `origin/master`:** `c8d72c92` (2026-09-15 21:06Z, merge of #231). **HEAD:** `aaf79b75`. **9 commits ahead, 148 behind** (`7ded46d4`).
- **Author on every commit:** `Claude <noreply@anthropic.com>` (a Claude Code cloud/web session; suffix `kywbbl`). Author dates: first `033a7b50` 2026-09-15 23:16Z; last `aaf79b75` 2026-09-22 00:27Z. Age at measurement: ~2 h since last commit; 6 days since first. Cadence: 7 commits on 09-15/16, then 2 on 09-21/22.
- **No PR** from this head (`gh pr list --head claude/airtable-exit-fleet-os-kywbbl` → empty). Only `PII Guard` ran on its pushes (00:08Z, 00:27Z); the `verify` workflow runs on `pull_request`, so **CI has never built or tested this branch**.
- Because the ref is `claude/*`, it is inside `session-autopilot.yml`'s scope (checkpoint §7).

Commits (`git log --format='%H|%ci|%an|%s' origin/master..origin/claude/airtable-exit-fleet-os-kywbbl`):

| SHA | date (UTC) | subject |
|---|---|---|
| `033a7b50` | 09-15 23:16 | rental: land Airtable exit plan, run phases 0-4 read-only |
| `4c790b72` | 09-16 19:05 | rental: revert unneeded tsconfig exclude for scripts/ |
| `7a3f570b` | 09-16 19:44 | rental: add TMMT/Airtable capability matrix (workstream B first deliverable) |
| `a593cc22` | 09-16 20:02 | rental: reclassify capability matrix section 7 as deferred, not out of scope |
| `aca38a95` | 09-16 20:14 | rental: elevate Airtable automation logic to an exit-preservation gate |
| `e93e2867` | 09-16 20:34 | rental: land native rules engine core (workstream B, P0 #1) |
| `bf11e76b` | 09-21 21:06 | rental: land automation safety envelope (workstream B, P0 #3) |
| `22d37377` | 09-22 00:08 | rental: owner decision pack + staged CR-001 migration; correct two claims |
| `aaf79b75` | 09-22 00:27 | rental: de-identify partner worksheet — no third-party names in git |

### Files (`git diff --stat origin/master...origin/claude/airtable-exit-fleet-os-kywbbl` → 36 files, +6,549 / −3)
- Root: `AIRTABLE-EXIT-EXECUTION-PLAN.md` (529), `TMMT-AIRTABLE-CAPABILITY-MATRIX.md` (524), `CHANGE_REQUEST_001.md`, `CHANGE_REQUEST_002.md`, **`CLAUDE.md` (+39 lines)**, **`.gitignore`** (see hazard), `config/retention-policy.example.json`.
- `docs/business-rules/01..07` + README; `docs/decisions/OWNER-DECISION-PACK.md`.
- `evidence/{README, attachment-inventory, automation-logic-capture, parity-report, phase0-report, write-path-inventory}.md`.
- `scripts/extract-attachments.ts` (711), `scripts/parity-check.ts` (491).
- `src/lib/rules/{airtable-semantics, eligibility, index, partner-economics, types}.ts` + `rules.test.ts` (28 `it`).
- `src/lib/automation/{envelope, index, types}.ts` + `envelope.test.ts` (19 `it`).
- `supabase/migrations/_staged/20260922000000_attachment_provenance_STAGED.sql` (173) + `_staged/README.md` row.

### Migration (read via `git show`): `_staged/20260922000000_attachment_provenance_STAGED.sql`
- Header: STAGED, not applied; requires owner authorization (Prime Directive 8) **and** a Gate 0 offline archive first.
- `ALTER TABLE public.documents` and `public.vehicle_media`: add 12 columns each (`source_system, source_table, source_record_id, source_field_id, original_filename, content_type, byte_size, sha256, doc_type, extracted_at, parent_table, parent_id`).
- `ALTER TABLE public.vehicle_media ALTER COLUMN customer_email DROP NOT NULL` ("safe only while 0 rows").
- Two partial UNIQUE indexes on `(source_table, source_record_id, source_field_id, sha256)`; two `(parent_table, parent_id)` indexes.
- `INSERT INTO storage.buckets` 7 private buckets: `background-checks, tickets, fleet, inspections, expenses, insurance, do-not-rent`.
- Postcondition queries and a rollback block ("clean ONLY while the tables are empty").
- Not counted by `migration-drift.test.ts` (`_staged/` is not scanned) — the branch does not touch the constant.

### Rental-domain and state-machine content (read via `git show`)
- **There is no state-machine code.** `src/lib/rules/index.ts` coverage table: 01 eligibility REFUSES (throws `BusinessPolicyRequiredError`; wraps existing `@/lib/bg-check-decisions`), 04 partner economics PORTED (3 payout formulas + gate check, `WEEKS_PER_MONTH = 4.33` verbatim), 02/03/05/06/07 "not yet ported — never encoded / BUSINESS POLICY REQUIRED".
- `docs/business-rules/05-vehicle-status-lifecycle.md`: the five Airtable vehicle states (`Available · Rented · Under Maintenance · Coming Soon · Retired`), finds 21 stale `Rented` + 4 NULL on `fleet`, "no legal transitions encoded", and offers a transition list **tagged INFERRED, "a starting point for the owner to correct, not a rule to adopt"**.
- `docs/business-rules/06-customer-lifecycle.md`: three overlapping status vocabularies; `DND` as a status value is not a suppression mechanism; "the canonical stage list is BUSINESS POLICY REQUIRED — do not derive it by merging"; repossession must never be automated.
- `src/lib/automation/`: an execution envelope (`planAutomation` / `executeAutomation`, `dryRun` defaults to true, `maxAffectedRecords` required, `unported_script` always refuses, zero-recipient customer sends refuse, owner approval mandatory for customer contact via `shared/owner-approval-gate/approval.ts`, DNC check must be supplied and fails closed, idempotency key, all-or-nothing). Reuses `src/lib/outbound-gate.ts` by reference (both exist on master; verified `ls-tree`).
- Root `CLAUDE.md` diff adds an "ACTIVE PROGRAM — NATIVE AIRTABLE REPLACEMENT" block with standing rules (nothing deleted from Airtable until Gates 2+4; 706 attachment records / 293 identity documents; 15 uncaptured `customScript` bodies; retention rule from counsel).

### Conflict check against master since the base
`comm -12` of files changed on master since `c8d72c92` and files changed on the branch → **`.gitignore`** and **`supabase/migrations/_staged/README.md`** only.
- **Hazard 1 — `.gitignore`:** the branch's version lacks master's `.outbox/` ignore (added after the base: "Outbound email drafts … PII. Never commit them") and adds `config/retention-policy.json`. A naive merge that takes the branch side would **un-ignore `.outbox/`**.
- **Hazard 2 — `_staged/README.md`:** the branch's table lacks master's row for `20260915120000_operator_progress_tenant_scope_STAGED.sql` (the org_roles/training hole record). Merge conflict expected; master's row must survive.

### Conflicts with the extraction (SPEC §9 / §10, system-of-record decisions)
- SPEC §9.1 lists `documents` and `vehicle_media` as ORPHANED (0 rows) and §9.3 says canonical vehicle / contract / document tables are **OWNER DECISIONS in PM-02 (ADR-001)** and DOC-001 (versioned contract storage). CR-001 pre-decides: it makes `documents` a polymorphic Airtable-provenance store (`parent_table/parent_id`) and creates 7 entity buckets beside the existing `program-documents / staff-documents / vehicle-media`. That is a data-model decision the extraction assigns to PM-02/DOC-001/DATA-005, not to this branch.
- SPEC §10.2's vehicle machine is `AVAILABLE → ON_HOLD → RENTED → RETURNED → INSPECTION → RECONDITIONING/MAINTENANCE → AVAILABLE`; the branch's doc 05 keeps the Airtable five-state vocabulary and proposes different transitions. RENT-001 (status vocabulary ADR) and RENT-005 (derived vehicle state) own this; the branch itself says its list is INFERRED and owner-correctable, so this is an **input**, not a competing implementation.
- SoR: both say Supabase is the system of record and Airtable is transitional — consistent. The branch adds a fact the extraction does not have: Airtable is the **sole copy of 706 attachment-bearing records incl. 293 identity documents** (extraction only records "Airtable holds the only signatures"). PACKAGE GAP, not a contradiction.
- The `CLAUDE.md` block would make every future session's standing instructions point at this program — a governance collision with `TMMT_CLAUDE_ORCHESTRATION_PROMPT.md` / `TMMT_BUILDER_MASTER_PROMPT.md` §0.0.

### Overlap with PM tasks
- **PM-05** (RENT-001/002/005): lifecycle vocabularies and the vehicle transition proposal.
- **PM-02** (ADR-001, DATA-002/004): canonical tables, `documents` schema, do-not-rent, eligibility inputs (decision pack §1 answers the same "role source / qualification decision" questions).
- **PM-06** (PAY-001/002): partner payout math (`partner-economics.ts`), late-fee/charity disposition is not touched.
- **PM-18 / COMM-001/002 / SEC-003:** the automation envelope duplicates the "dry-run outbox drainer + consent-at-send + DNC-before-send" pattern in code form.
- **DOC-001 / DATA-005:** storage buckets and document provenance.

### Unique work worth preserving (all dev/docs; nothing applied)
Airtable exit plan + gate ledger (`evidence/`), the capability matrix with a deferral register, parity report, attachment inventory (706/293 counts), automation-logic capture (15 uncaptured script bodies), write-path inventory, 7 business-rule documents with VERIFIED/INFERRED tags, the owner decision pack (5 decisions with real counts), CR-001/CR-002 (CR-002 flags a stored carrier login email in `public.insurance`), the ported partner economics with Airtable semantics reproduced, and the safety-envelope test suite (47 unit tests, NOT RUN here).

### Classification and integration recommendation (recommendation only — no merge)
**UNIQUE AND RELEVANT — MANUAL REVIEW.** Status: ACTIVE DEVELOPMENT, owner and authorization UNKNOWN, CI never ran, tests NOT RUN, 148 behind master.
1. Owner names the responsible session and decides whether "Workstream A/B" is authorized; until then it stays a branch.
2. Split before any landing: (a) docs/evidence/decision pack → a docs-only PR under `docs/airtable-exit/` (move the root-level `.md` files; drop or relocate the `CLAUDE.md` block); (b) `src/lib/rules` + `src/lib/automation` → a separate PR sequenced after RENT-001 and ADR-001 so it does not pre-empt the vocabulary/table decisions, with PM-18 reviewing the envelope against COMM-001/002; (c) CR-001 → PM-02/DOC-001 decision queue, never applied from this branch.
3. Fix the two merge hazards (`.gitignore` `.outbox/`, `_staged/README.md` row) before any merge.
4. Open a PR (any) so `verify` runs — that is the only way to get build/test evidence for it.
5. Because it is a `claude/*` ref, keep session-autopilot in mind (SEC-004 owner decision) — do not leave it where an enabled auto-merge could pick it up.

---

## DELTA 8 — Other remote branches

`git branch -r` after fetch: 117 refs (`origin/HEAD` + 116 branches). 30 map to worktrees. Full per-branch table (HEAD, ahead/behind, last commit, purpose, class): `ACTIVE_BRANCH_OWNERSHIP_MAP.md` §B. Key facts not already in the checkpoint:

- **New since the checkpoint:** `origin/m1/remove-superseded-prototypes` (`732bfdb8`) appeared on the first fetch and was **merged as #259 at 02:19:46Z** (now `origin/master`).
- **`feat/partner-acquisition` `aad50d47`** (PR #255 CLOSED): `git diff origin/master origin/feat/partner-acquisition -- src/app/forms/actions.ts src/app/forms/partner-apply/page.tsx` = **0 lines** → its content is byte-identical on master. SUPERSEDED; the checkpoint's "shipped via #254" holds.
- **`feat/ghl-quiet-integration-detector` `61e56791`** (09-20, 1 ahead, no PR): `src/lib/integration-freshness.ts` + test, `src/app/api/health/route.ts`, `scripts/ghl-verify-inbound.mjs`, `docs/repairs/OWNER-RUN-20260920-ghl-org-connections.sql`. Not part of GHL M0–M7 (none of those branches touch these files). UNIQUE AND RELEVANT — MANUAL REVIEW; the GHL router owner should classify it against M3 (connection registry) before anyone lands it.
- **`feat/inspection-walkaround` `df6f38a6`** (PR #251 OPEN READY, 5 ahead): `git merge-base --is-ancestor origin/fix/e2e-stops-writing-to-production origin/feat/inspection-walkaround` → **YES**, so `fix/e2e-stops-writing-to-production` is SUPERSEDED (contained). #251 carries a **top-level** migration `20260917120000_training_progress_by_journey.sql` (not `_staged`), which would raise `KNOWN_UNAPPLIED` on merge unless reconciled, plus e2e changes that are "test(e2e): a test that writes must not run against production". Overlaps PM-05 RET-001 (inspection) and PM-01 BUILD-002/004. MANUAL REVIEW.
- **`rick/integration-unified-2026-09-17`**, **`m1/configurator`**: 0 ahead → fully merged, HISTORICAL (the checkpoint had them UNKNOWN).
- **`carry/tmmt-front-door-on-master`** (PR #232 OPEN, 09-09, touches `src/middleware.ts`): the front door landed via #223/#226; MANUAL REVIEW, likely SUPERSEDED.
- **`comms/g02-internal-destinations`** is 0 ahead of master but **PR #243 is still OPEN DRAFT** against `comms/g02-shadow-phase1` — stale PR, nothing to merge.
- **`chore/revoke-user-execute-internal-definer-fns`** (09-08): migration `20260908201941` is in no snapshot; prod later recorded `20260922000642 revoke_anon_execute_on_internal_helpers` (per checkpoint §2). Whether the two are the same change is UNKNOWN → MANUAL REVIEW (security).
- 10 branches have **no merge base** with master (`backup/*`, `rescue/*`, `main`, `feat/credit-dispute-command` 167 commits, `claude/organize-chats-sessions-7t7zjy`, `docs/test-status-update`, `merge/legal-pages-into-tmmt-os`, `overdrive-coord`, `swarm-coord`) — orphan histories, HISTORICAL, never merge.
- 9 dormant July `claude/*` branches remain inside `session-autopilot.yml`'s iteration scope.

Active (<7 days) remote-only branches: `claude/airtable-exit-fleet-os-kywbbl`, `feat/credit-c1-grounded-cases`, `feat/credit-c2-case-lifecycle`, `m1/remove-superseded-prototypes` (merged), `feat/partner-acquisition` (superseded), `feat/aixmos-storefront` (merged), `feat/ghl-quiet-integration-detector`, `feat/inspection-walkaround`, `fix/e2e-stops-writing-to-production`, `fix/c21a`, `fix/c21b`, `rick/integration-unified`, `feat/client-and-org-scoped-visibility`, `fix/operator-cert-rls`. Everything else is stale.

---

## DELTA 3 — Credit C3

### Branches and heads
| Branch | Where | HEAD | Base | Commits since merge-base | Tree |
|---|---|---|---|---|---|
| `feat/credit-c3-security-foundation` | `C:\dev\wt-credit-c1` + `origin/…` (pushed) | `6cd8da38` (2026-09-22 02:06Z) | stacked on C2 `8da9af5f` → C1 `3d6e87fb` → `1ecb9d28` → master `e1b683ff` | 5 over master (`1ecb9d28`, `3d6e87fb`, `8da9af5f`, `a27e20c5`, `6cd8da38`); **2 over C2** (`a27e20c5` C3 recipients/approvals/stale-page; `6cd8da38` evidence binary-file fix + C3-019 tests) | **clean** (`status --porcelain` = 0) |
| `sec/c3-auth-orgroles` | `C:\dev\wt-c3-auth` + `origin/…` (pushed) | `3233ccf7` (2026-09-22 01:55Z) | `4cca6835` (merge-base with master; now 1 behind `7ded46d4`) | 2 (`c3073a90` cherry-pick of Windows test fix `3d6e87fb`; `3233ccf7` auth/invites/org_roles) | **clean** |
| `feat/c4-provisioning-preview` (new, appeared 02:19Z) | `C:\dev\wt-c4` (local only) | `987b0f40` = merge of `6cd8da38` + `3233ccf7` ("so all four staged migrations rehearse together") | master | 8 | **dirty: 3 untracked** (`scripts/tests/sql/c3-production-package.rehearsal.mjs`, `scripts/tests/sql/fixtures/prod-shape-auth-2026-09-22.sql`, `supabase/migrations/_staged/c3-package/`) — a session is working in it now |

C3 credit diff over C2 (`git diff --stat origin/feat/credit-c2-case-lifecycle...HEAD`): 30 files, +2,610 / −72 — recipients registry, template approvals, GHL status contract (unwired), stale-page guards, prod-shape fixture, three rehearsals, `_staged/20260923120000_credit_recipients_and_template_approvals_STAGED.sql`, and a rewrite of `_staged/20260922120000_credit_case_foundation_STAGED.sql` (+95).

### PR and CI status (`gh pr view`, `gh pr checks`, 02:16–02:24Z)
| PR | state | base ← head | head SHA | checks |
|---|---|---|---|---|
| #257 C1 | OPEN DRAFT | master ← `feat/credit-c1-grounded-cases` | `3d6e87fb` | verify pass 3m03s, pii-scan pass ×2, Vercel preview pass |
| #258 C2 | OPEN DRAFT, MERGEABLE/CLEAN | `feat/credit-c1-grounded-cases` ← `feat/credit-c2-case-lifecycle` | `8da9af5f` | verify pass 4m51s, pii-scan ×2, Vercel |
| **#260 C3 credit** (new, 02:16Z) | OPEN DRAFT, MERGEABLE/UNSTABLE→ verify finished pass 5m12s by 02:24Z | `feat/credit-c2-case-lifecycle` ← `feat/credit-c3-security-foundation` | `6cd8da38` | verify pass, pii-scan ×2, Vercel |
| **#261 C3 auth** (new, 02:16Z) | OPEN DRAFT, MERGEABLE/CLEAN | master ← `sec/c3-auth-orgroles` | `3233ccf7` | verify pass 4m04s, pii-scan ×2, Vercel |

Dependency chain: **#257 → #258 → #260** (stacked; each base is the previous head) and **#261 independent of the stack** ("Based on master. Independent of the credit stack … It can be reviewed on its own" — PR body). `wt-c4` merges #260's head with #261's head locally; no PR.

### Reports
- `C:\Users\taha1\OneDrive\Desktop\TMMT-PHASE-2\C3\` (8 files, 2026-09-22 02:02–02:08Z): `CREDIT_C3_IMPLEMENTATION_REPORT.md` (states "Nothing was pushed in C3" — **superseded**: both C3 branches are now pushed and are #260/#261), `CREDIT_PRODUCTION_READINESS_MATRIX.md`, `TMMT_ACCOUNT_PROVISIONING_ARCHITECTURE.md`, `ORG_ROLES_REMEDIATION_PACKAGE.md`, `CREDIT_ATTORNEY_GATE_ARCHITECTURE.md`, `CREDIT_EVIDENCE_STORAGE_PRODUCTION_SPEC.md`, `CREDIT_GHL_STATUS_CONTRACT.md`, `CREDIT_RECIPIENT_REGISTRY.md`. The checkpoint's "no C3 implementation report yet" is **superseded**.
- C2 reports at `TMMT-PHASE-2\C2\` (6 files), C1 at `TMMT-PHASE-2\C1\` (7 files). No C3 report is committed inside either worktree (`git diff --name-only origin/master...HEAD | grep -i docs` → none). `C3_PRODUCTION_MIGRATION_MANIFEST.md` (named in #261's body) was **not found** on Desktop or in either worktree.
- Report-claimed test results (not re-run here): credit branch vitest 2730 pass / 0 fail; auth branch 2379 pass; `next build` **not completed** on the auth branch (memory guard) — "CI must confirm" → confirmed: #261 verify pass.

### Production status
**DEVELOPMENT ONLY.** Both staged credit migrations, `org_roles_repair`, and `signup_invites_v2` are under `_staged/` (not scanned by the drift register; `wt-c4` shows `KNOWN_UNAPPLIED = 53` unchanged). No prod evidence was sought by this lane (R2). The readiness matrix's row 13 (public sign-up OPEN) and row 17 (org_roles STAGED) are owner actions.

---

## DELTA 4 — Security collision table (`sec/c3-auth-orgroles` vs extraction tasks vs 2A vs signup_invites)

Sources read: `FORGE_TASKS/TMMT-SEC-001_auth-callback-open-redirect.md`, `TMMT-AUTH-004_customer-invite-claim-flow.md`, `TMMT-AUTH-005_tier-route-matrix-test-in-ci.md`, `TMMT-SEC-008…`; `git diff origin/master...origin/sec/c3-auth-orgroles`; `git diff origin/master...origin/sec/2a-profiles-regression`; `git grep` on master for `signup_invite` / `safe-redirect` (master has `src/app/(auth)/login/actions.ts`, `supabase/migrations/20260831000000_signup_invites.sql`; **no** `safe-redirect` anywhere on master).

| # | ISSUE | CANONICAL OWNER | BRANCH | FILES | STATUS | COLLISION | RECOMMENDED RESOLUTION (no implementation) |
|---|---|---|---|---|---|---|---|
| 1 | Open redirect in `/api/auth/callback` (`/%5Cevil.com`) | Extraction **TMMT-SEC-001** (PM-00 00-i) | `sec/c3-auth-orgroles` (#261, C3-003) | `src/lib/safe-redirect.ts` (new, exports `safeRelativePath` — the exact helper name SEC-001 suggests), `src/app/api/auth/callback/route.ts`, `route.test.ts` (49 tests, 6 red on old code per PR) | IMPLEMENTED on branch; PR open draft; CI green; not merged | **FULL DUPLICATE** of SEC-001's scope | Retire SEC-001 as a build task; use its acceptance list (criteria 1–5) as the review checklist for #261's Part 1; land through #261. Do not assign SEC-001 to Forge. |
| 2 | `login/actions.ts` sign-up path (no client metadata; release invite on existing email; confirmation path) | Phase 2A A4a/A4b — SEC-001 §DO NOT CHANGE and AUTH-004 both say this file is 2A's | `sec/c3-auth-orgroles` (#261, C3-001/002) | `src/app/(auth)/login/actions.ts` (+28/−?), `actions.test.ts` | IMPLEMENTED on branch | **OWNERSHIP BOUNDARY CROSSED** — C3 edits the file the package reserves for 2A | Owner records that the C3 session is the 2A A4b implementer (or the 2A owner signs off on #261). Until recorded, AUTH-004's "written answer from the Phase 2A owner" is satisfied by nobody. |
| 3 | Customer invite / claim bound to lead / bg-check / booking | Extraction **TMMT-AUTH-004** (PM-19), blocked on 2A A4b | `sec/c3-auth-orgroles` (staged `signup_invites_v2`: `status`, `revoked_*`, `relationship_kind` allow-list = `credit_customer` only → `dispute_clients`), `feat/c4-provisioning-preview` (readiness row 15: "C4 switches `signUp` to server-side create") | `src/lib/signup-invite.ts`, `_staged/20260923150000_signup_invites_v2_STAGED.sql`, `scripts/tests/sql/signup-invites-v2.rehearsal.mjs`, `wt-c4` untracked package | PARTIAL on branch (lifecycle + server-only claim); C4 in progress; SQL not applied | **PARTIAL / HIGH** — same table, same module, same "server-issued single-use invite" design; AUTH-004's rental bindings (`incoming_leads` / `background_checks` / `bookings`, `role='customer'`, `org_id`) are **not** in C3's allow-list | AUTH-004 = BLOCKED on #261 + C4. Rescope AUTH-004 to "extend `relationship_kind` with rental bindings and the `customer` tier binding on top of C4's path"; no parallel invite system (the task's own STOP boundary). |
| 4 | Tier × route matrix test | Extraction **TMMT-AUTH-005** (test-only; DO NOT CHANGE `src/middleware.ts`) | Credit stack (#258/#260/C4) adds `/my-credit` to `src/middleware.ts` (+6); #261 changes no middleware | `src/middleware.ts` | route added on branch, flag-off | LOW — expectations drift, not code conflict | Sequence AUTH-005 after #257/#258 land; add the `/my-credit` (customer tier, flag) row to the matrix. |
| 5 | `org_roles` 42P17 recursion + `operator_training_progress` uncorrelated policy | Phase **2A-A12** (`wt-2a-profiles`) | (a) `sec/c3-auth-orgroles`: `_staged/20260923140000_org_roles_repair_STAGED.sql` + rehearsal 16 checks / 9 mutations, adds `is_org_tenant_admin()`; (b) `sec/2a-profiles-regression`: adversarial rehearsal asserts the 42P17 and applies an in-test candidate fix (`profiles-escalation-adversarial.rehearsal.mjs` lines ~284–328); (c) master `_staged/20260915120000_operator_progress_tenant_scope_STAGED.sql` (training half only, "idempotent, either order harmless" per C3 header) | as listed | (a) STAGED not applied; (b) test asserts the defect; (c) staged on master | **DUPLICATE across 2A and C3** — two packages describe the same prod fix; C3's is the complete one (both halves in one transaction) | 2A-A12 references C3's staged file as the single apply artifact (`ORG_ROLES_REMEDIATION_PACKAGE.md`). After apply, retire the 20260915 staged file's row. Apply order = owner + baton (R2 lane). |
| 6 | `signup_invites` table naming/versions | drift register on master lists `signup_invites` among "duplicates that make a push a security rollback" (`migration-drift.test.ts:131-141`) | #261 adds only a `_staged` v2 file (not scanned) | `supabase/migrations/20260831000000_signup_invites.sql` (master) | no constant change | MINOR — v2 must never be moved out of `_staged` under a new top-level version without a snapshot line | Land v2 via the baton with the ledger's assigned version and a `LEDGER-SNAPSHOT` line (same pattern as 2A's `20260921234148` note). |
| 7 | AUTH-SIGNUP-001 (public sign-up ON) | Owner action (2A-A4a) | none — #261 body: "no Supabase Auth setting has been changed"; readiness row 13 OPEN | — | OPEN / OWNER | none (dependency) | Unchanged; C3's design "holds even while public sign-up is still ON" (provisioning doc §1). |
| 8 | Windows-safe test fix (`3d6e87fb` / cherry-pick `c3073a90`) | Extraction **TMMT-BUILD-004** | present on #256, #257, #258, #260, #261 (five PRs) | `src/lib/agent/compliance/record-opt-out.test.ts`, `…/ticket-requester-is-not-the-customer.test.ts` | done on branches | **DUPLICATE commits** (different SHAs, identical patch) | BUILD-004 is satisfied by whichever PR merges first; the rest carry an identical hunk. Close BUILD-004 after the first merge. |
| 9 | `src/lib/db/migration-drift.test.ts` `KNOWN_UNAPPLIED` | PM-01 / drift register | master 53 · `sec/partner-acquisition-rls` **54** · `sec/2a-profiles-regression` 53 · `feat/c4` 53 · `feat/ghl-router-m5-m6` 58 · `feat/ghl-router-m7` **59** | that one constant + comment block | branch-specific | **GUARANTEED merge conflict** between any two of partner-acq, M7 and future GHL landings | Land in a fixed order; each landing re-measures the count once (DELTA 9). |

Collision count: **7 real** (rows 1, 2, 3, 5, 8, 9 plus the low row 4) and **2 minor/dependency** (rows 6, 7).

---

## DELTA 5 — GHL M7 state from disk (do not continue M7)

All three M7 worktrees are clean (`status --porcelain` = 0), have `node_modules`, and have **no remote ref** (nothing pushed; no PR). Nothing M0–M7 is on master.

| Lane | Branch @ HEAD | Commits (over M5/M6 `7fd69d9a`) | What exists |
|---|---|---|---|
| **CONTRACT** | `feat/ghl-router-m7` — `0f5cc899` (01:40Z), `695b52ab` (01:44Z), `962f983a` (01:49Z) | 3 docs commits | `GHL_ROUTING_ENGINE_CONTRACT.md`, `GHL_ROUTING_SIMULATOR_SPEC.md`, `GHL_ROUTING_BACKTEST_DATASET.md`, SoR/outbox prep + activation dependencies A-1…A-6 in `GHL_RELEASE_BLOCKERS.md` ("No blocker was closed") → **CONTRACT COMPLETE** |
| **DB LANE** | `feat/ghl-router-m7-db` @ `36eeefbf` (02:10Z) | `8a788d10` migration, `0b36eacb` rehearsal `check:m7-routing-db`, `36eeefbf` dev fixtures | `supabase/migrations/20260924100000_m7_routing_rules_and_decisions.sql` (745 lines; CREATE-only: `lead_routing_rules`, `routing_config_versions`, `routing_decisions` kind CHECK `'SIMULATED'` only, `routing_intake_source_map`, 5 service-role loaders, APPROVED guard trigger; "NOT APPLIED to production"), `scripts/tests/sql/m7-routing-db.check.mjs` (595), `supabase/seed/routing_dev_seed.sql`, `__fixtures__/sql-*.json`; drift constant 58→**59** with a justification block → **WRITTEN, rehearsed on a scratch dev DB per commit message (NOT RUN here), NOT applied** |
| **ENGINE LANE** | `feat/ghl-router-m7-engine` @ `0dbbd471` (02:11Z) | 1 commit | `src/lib/routing-engine/{types, config, hash, loaders, evaluate, simulate, test-helpers}.ts` + 8 `*.test.ts`, `scripts/routing/simulate.mjs`, `scripts/routing/export-dev-fixtures.mjs`, `src/app/api/admin/routing/simulate/route.ts` (+test); no migration → **WRITTEN** |
| **MERGED** | `feat/ghl-router-m7` @ **`f17e8f69`** (02:19Z) | `423788a0` merge db, `8ca8545f` merge engine, `0dbc00d8` "m7 gate: combined identity→routing rehearsal … backtest report", `f17e8f69` routing matrix V3 | integration branch = 41 files, +6,686 over M5/M6 (`git diff --stat 7fd69d9a...HEAD`); `m7-db` and `m7-engine` are both ancestors (diff vs `0dbc00d8` empty) → **MERGED locally into m7** (the checkpoint's `962f983a` / "DESIGN ONLY" is **superseded**) |
| **BACKTEST LANE** | no separate branch; on `feat/ghl-router-m7` | `0dbc00d8` | `scripts/routing/backtest.mjs`, `src/lib/routing-engine/backtest.test.ts`, `docs/audits/ghl-router/GHL_ROUTING_BACKTEST_REPORT.md` (in-doc date 2026-09-23; commit 02:18Z): 892 leads, **ACTUAL ROUTABLE = 0** (783 `HISTORICAL_UNRESOLVED_LEAD`, 37 `OWNERSHIP_UNCONFIRMED`, 44 `INTAKE_NOT_ROUTABLE`, 1 `NO_CONFIG_VERSION`), hypothetical 37 routable / all NOT_READY; dataset lives outside the repo → **BACKTEST DONE (read-only)** |
| **TESTED** | `C:\dev\wt-ghl-m7` | this lane ran `npx vitest run src/lib/routing-engine/ src/app/api/admin/routing/simulate/route.test.ts` | **9 files, 123 tests passed** (822 ms). SQL checks `check:m7-routing-db`, `check:m7-combined` and `test:m7-mutations` need a database → **NOT RUN**. Full suite not run. |
| **DOCUMENTED** | m7 | `f17e8f69` | contract, simulator spec, dataset, backtest report, `TMMT_GHL_ROUTING_MATRIX_V3.md` ("Nothing is active"; readiness per intake = `NEEDS_REVIEW OWNERSHIP_UNCONFIRMED` / `NO_ACTIVE_RULE`), blockers "Status after M7" → **DOCUMENTED** |
| **COMPLETE** | — | — | **NO by the track's own convention**: M0–M2, M3–M4 and M5–M6 each closed with an `M*_FINAL_REPORT.md` (in repo and on Desktop); there is **no `M7_FINAL_REPORT.md`** anywhere (`find` on all three worktrees and `Desktop\TMMT-GHL-ROUTER\` → none). Status = **ACTIVE DEVELOPMENT / PARTIAL**, dev only, unpushed. |

M5/M6 final report: `C:\Users\taha1\OneDrive\Desktop\TMMT-GHL-ROUTER\M5_M6_FINAL_REPORT.md` (file mtime 2026-09-21 21:29 local = 01:29Z; in-doc "Date: 2026-09-22 · HEAD `330249f5` (report commit follows)"); the same file is committed on `feat/ghl-router-m5-m6` at `docs/audits/ghl-router/M5_M6_FINAL_REPORT.md`, report commit **`7fd69d9a`** 2026-09-22 01:29Z. `M0_M2_FINAL_REPORT.md` and `M3_M4_FINAL_REPORT.md` sit beside it (Desktop folder mtimes 21:29 local; 28 files).

`package.json` on m7 adds scripts `check:m7-routing-db`, `check:m7-combined`, `routing:export-fixtures`, `routing:simulate`, `routing:backtest`, `test:m7-mutations`.

---

## DELTA 9 — SEC-008 arithmetic (`src/lib/db/migration-drift.test.ts`)

How the test counts (master `:30-48`): `repoVersions()` = every `*.sql` **directly in** `supabase/migrations/` (so `_staged/` and `_parked/` are **not** counted); `appliedVersions()` = non-comment lines of `supabase/migrations/LEDGER-SNAPSHOT.txt` (273 versions on master); the assertion is `unapplied.length <= KNOWN_UNAPPLIED`. A file counts as applied only if **its filename prefix** appears in the snapshot.

| Ref | `KNOWN_UNAPPLIED` | Why (from the file's own comment) | Snapshot |
|---|---|---|---|
| `origin/master` `7ded46d4` (`:55`) | **53** | "51 → 53 on 2026-09-21": landing the 14-branch integration carried two files not applied to prod — `20260901120000_vehicle_owners_and_agreements.sql` (#224) and `20260917160000_profiles_protect_access_columns.sql` (#249). 89 top-level files. | 273 lines; contains none of `20260921234148`, `20260922005007`, `20260922004813`, `20260922003000` |
| `sec/partner-acquisition-rls` `620e100e` (local-only; `:55`) | **54** | "53 → 54 on 2026-09-22, deliberately: the P0 containment for partner_acquisition. `20260922003000_partner_acquisition_least_privilege.sql` — prepared and rehearsed only; NOT applied … It drops back to 53 when the baton runs it **and the ledger snapshot records the version apply_migration assigns**." The branch adds that one top-level file and does **not** change `LEDGER-SNAPSHOT.txt`. | unchanged from master |
| `sec/2a-profiles-regression` `70c3d919` | 53 | adds no migration; appends `20260921234148` to the snapshot with the note "**Still counted as drift** by migration-drift.test.ts (KNOWN_UNAPPLIED stays 53)" because the repo file is `20260917160000_…` (version-string drift). | +10 lines |
| `feat/c4-provisioning-preview` | 53 | four `_staged` files only — not scanned | — |
| `feat/ghl-router-m5-m6` / `-m7` | 58 / 59 | GHL branches add top-level (unapplied) migration files; M7's comment: "the M7 engine branch adds NO migration file: the merged value stays 59" | — |

**Correct current statement (evidence-based):**
1. On master today the constant is **53** and there is **no** partner_acquisition migration file.
2. Landing `620e100e` **as it is** adds one top-level file whose prefix `20260922003000` is in no snapshot → the measured count becomes **54**, and the branch already pins 54. The branch's own comment predicted a drop to 53 "when the baton runs it and the snapshot records the version" — the baton has run it (the uncommitted completion record in `wt-sec-partner-acq` says ledger `20260922005007`, baton 9, applied ~00:50Z), **but the snapshot line was never added**, so the drop has not happened.
3. Because prod recorded `20260922005007` while the file is named `20260922003000`, appending `20260922005007` to the snapshot **does not** make the file count as applied (same version-string drift as the profiles file). To land at **53** the file must be **renamed to `20260922005007_…`** *and* that version appended to `LEDGER-SNAPSHOT.txt`; SEC-008's own implementation note says not to rename a file another session owns without asking, and offers the `VERSION_MAP` alternative (TMMT-BUILD-003) — under that alternative the honest constant after landing is **54, not 53**, with the mapping recorded.
4. Therefore SEC-008's "54 → 53" is correct only as *branch state → post-rename landing*; the checkpoint's "master is already 53" is correct; both are reconcilable once the landing session chooses rename (53) or version-map (54). The uncommitted completion record in `C:\dev\wt-sec-partner-acq` still says "KNOWN_UNAPPLIED back to 53" — it should say which of the two paths it takes.
5. Independent of this branch, any GHL landing (58/59) and the #251 top-level migration will each move the constant again; the file is a guaranteed conflict point (DELTA 4 row 9).

---

## DELTA 12 — PR status (`gh pr list --state all --limit 40`, `gh pr view/checks`, 02:16–02:24Z)

| PR | state | draft | base ← head (head SHA) | merged / updated | CI (verify · pii-scan · Vercel) | note |
|---|---|---|---|---|---|---|
| **#261** sec(auth): C3 open-redirect fix, invite lifecycle; STAGED org_roles + training-progress repair, signup_invites v2 | OPEN | DRAFT | master ← `sec/c3-auth-orgroles` (`3233ccf7`) | upd 02:16Z | pass · pass ×2 · pass; MERGEABLE/CLEAN | independent of the credit stack; code + STAGED SQL only |
| **#260** feat(credit): C3 security foundation (DEV ONLY, stacked on #258) | OPEN | DRAFT | `feat/credit-c2-case-lifecycle` ← `feat/credit-c3-security-foundation` (`6cd8da38`) | upd 02:17Z | pass (5m12s) · pass ×2 · pass; MERGEABLE | top of the stack |
| **#259** chore: remove apps/engine and aria | **MERGED** 02:19:46Z | ready | master ← `m1/remove-superseded-prototypes` (`732bfdb8`) | — | pass · pass ×2 · pass; Cursor agents NEUTRAL | = `origin/master` `7ded46d4`; master `verify` run still in progress at 02:24Z |
| **#258** feat(credit): C2 [STACKED ON #257] | OPEN | DRAFT | `feat/credit-c1-grounded-cases` ← `feat/credit-c2-case-lifecycle` (`8da9af5f`) | upd 02:17Z | pass (4m51s) · pass ×2 · pass; MERGEABLE/CLEAN | |
| **#257** feat(credit): C1 (dev only, gate closed) | OPEN | DRAFT | master ← `feat/credit-c1-grounded-cases` (`3d6e87fb`) | upd 00:25Z | pass (3m03s) · pass ×2 · pass | bottom of the stack |
| **#256** test(profiles): adversarial privilege-escalation suite + CI (fix already applied) | OPEN | DRAFT | master ← `sec/2a-profiles-regression` (`70c3d919`) | upd 00:27Z | pass (6m19s) · pass ×2 · pass | records prod apply `20260921234148` |
| **#255** feat(supply): partner acquisition | **CLOSED** (unmerged) | ready | master ← `feat/partner-acquisition` (`aad50d47`) | closed 01:30Z | pass · pass ×2 · pass; MERGEABLE/CLEAN | its two files are byte-identical on master (0-line diff) → shipped via #254 |
| **#254** feat(command-hub): resolve the operator hub from the tenant | **MERGED** 2026-09-21 23:44Z | ready | master ← `feat/command-hub-white-label` (`79179449`) | — | pass · pass ×2 · pass | = extraction base `4cca6835`; carries `src/app/forms/partner-apply/page.tsx` (public partner form) |
| #253 feat(lp): AIXMOS front door `/lp/aixmos` | MERGED 23:43Z | ready | master ← `feat/aixmos-storefront` | — | — | |
| #252 fix(deps): clear all 8 Dependabot alerts | MERGED 22:03Z | ready | master ← `fix/next-critical-aria-engine` | — | — | |
| #251 The walk-around: inspection photos | **OPEN** | ready | master ← `feat/inspection-walkaround` (`df6f38a6`) | upd 2026-09-19 | mergeable UNKNOWN | stale-open; carries a top-level migration |
| #250 Rental board, drive-to-own, lead form | MERGED 09-17 | ready | master ← `feat/client-and-org-scoped-visibility` | — | — | |
| #249 sec(profiles) protected columns (NOT applied; owner + baton) | MERGED 09-21 21:59Z | (draft at merge) | master ← `sec/profiles-protected-columns` | — | — | fix applied later (ledger `20260921234148`, per #256) |
| #248 db: backfill 7 agent-queue migrations | MERGED 21:59Z | (draft) | master ← `agent/queue-migrations-backfill` | — | — | |
| #247 docs(schema-drift) register | MERGED 21:59Z | ready | master ← `docs/schema-drift-register` | — | — | |
| #246 fix(agent) C-21c | MERGED 09-20 | ready | `fix/c21b-…` ← `fix/c21c-…` | — | — | merged into the C-21b branch |
| #245 fix(sms) C-21b owner hold | MERGED 09-21 21:16Z | ready | master ← `fix/c21b-ai-reply-owner-hold` | — | — | |
| #244 fix(sms) C-21a deterministic opt-out | MERGED 21:06Z | ready | master ← `fix/c21a-deterministic-opt-out` | — | — | |
| #243 comms: G-02 internal destinations (applied) | **OPEN** | DRAFT | `comms/g02-shadow-phase1` ← `comms/g02-internal-destinations` | upd 09-16 | MERGEABLE/CLEAN | head is 0 ahead of master → nothing to merge; stale PR |
| #242 comms: G-02 phase 1 (applied) | MERGED 21:59Z | (draft) | master ← `comms/g02-shadow-phase1` | — | — | |
| #241 fix(va-tasks) quarantine | MERGED 21:59Z | (draft) | master ← `fix/quarantine-unverified-payment-followups` | — | — | |
| #240 sec: least privilege exec_va_tasks (applied) | MERGED 21:59Z | (draft) | master ← `sec/least-privilege-va-tasks-agent-rpcs` | — | — | |
| #239 ops: production write baton (applied) | MERGED 21:59Z | (draft) | master ← `ops/prod-write-baton` | — | — | |
| #238 fix(agent) LLM daily cap (OWNER REVIEW) | MERGED 21:59Z | ready | master ← `fix/c21-llm-cap-ts` | — | — | |
| #237 fix(webhooks) replay lookup ts (C-20) | MERGED 09-16 | ready | master ← `fix/c20-webhook-replay-ts` | — | — | |
| #236 fix(outbox) G-01 | MERGED 09-16 | ready | master ← `fix/va-stager-skip-handled-tasks` | — | — | |
| #235 docs(credit): D-22 decision + PR 224 audit | MERGED 21:59Z | ready | master ← `docs/owner-decision-credit-path` | — | — | |
| #234 fix(deps): next 16.3.3 | MERGED 09-15 | ready | master ← `fix/next-16.3.3-critical-rce` | — | — | |
| #233 docs(env): tmmtrentals.com DNS | MERGED 09-15 | ready | master ← `carry/dns-finding-note` | — | — | |
| #232 feat(front-door): tmmtrentals.com shows TMMT | **OPEN** | ready | master ← `carry/tmmt-front-door-on-master` (`3ea6a6ee`) | upd 09-17 | mergeable UNKNOWN | stale-open; touches `src/middleware.ts` |
| #231 carry/watchtower real | MERGED 09-15 | ready | master ← `carry/watchtower-real` | — | — | |
| #230 … #222 | MERGED 2026-09-09 | ready | (see `gh pr list`) | — | — | historical |

**Open PRs now: 8** — drafts #256, #257, #258, #260, #261 (all CI green, all merge = deploy); stale #232, #243, #251. **Dependency chain:** #257 → #258 → #260 (stacked); #261 standalone; #256 standalone. **#255:** CLOSED unmerged at 01:30Z, content already on master via #254 (verified by 0-line diff). **Public partner form:** shipped in #254 (`src/app/forms/partner-apply/page.tsx` present on master).

---

## Other facts observed while measuring (for the reconciliation, not new deltas)

- **`wt-c4` appeared during the measurement** (`git worktree list` at 02:14Z did not list it; at 02:22Z it did, HEAD `987b0f40` committed 02:19:14Z, 3 untracked files). Another session is active in it. Nothing in it was read beyond `status`, `log`, `diff --stat`.
- The partner-acq completion record (uncommitted, `wt-sec-partner-acq`) names its operator as `claude:101528f1-1415-4004-9b23-[phone removed]ed` and says the pre-write ledger check saw `index_hot_foreign_keys_and_drop_duplicate` from "other sessions" — i.e. the unrecorded `20260922004813` DDL (checkpoint §2) was **not** that session's write; provenance still UNKNOWN.
- GHL M0–M7 = 13 local-only branches, none pushed; the GHL router pack docs in `wt-ghl-audit` are also local-only.
- Two extraction-era statements are now stale on top of the checkpoint's list: "M7 DESIGN ONLY / `962f983a`" (now engine + db merged at `f17e8f69`) and "no C3 report / C3 not pushed" (C3 report exists; #260/#261 open).

**STOP.** No implementation, merge, apply, deploy or branch change follows from this file.
