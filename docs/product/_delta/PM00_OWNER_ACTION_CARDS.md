# PM-00 OWNER ACTION CARDS (lane R3, 2026-09-22 UTC)

Five decisions only the owner can make. **Nothing on these cards was performed.** Each card states what is verified today, what Claude may re-verify read-only, and what only the owner can do. Evidence: `R2_CONTROLS_EVIDENCE.md` (R2), `R1_BRANCH_EVIDENCE.md` (R1), `PRODUCTION_MIGRATION_PROVENANCE_DELTA.md` (R2-P). Status words per the orchestration prompt §4.

In plain words: A = is the sign-up door still open? · B = a robot that could merge to production is still running every 6 hours · C = a daily job "succeeds" while doing nothing, and fixing it switches on five other things · D = there is no single off-switch for TMMT writing into GoHighLevel · E = database changes went into production without the hand-off token, and six of them have no file in the repo.

---

## Card A — Public sign-up (AUTH-SIGNUP-001 / SEC-02 / KD-02 / 2A-A4a)

**CURRENT VERIFIED STATE:** **UNVERIFIED / OWNER ACTION.** Last direct evidence: 2026-09-17 `GET /auth/v1/settings` → `disable_signup=false` (`docs/security/PROFILES-ACCESS-COLUMNS.md`). R2 found no committed publishable key on master, so per the lane rule no newer read was attempted. Aggregates on 2026-09-22: `auth.users` = 3 (0 created since 09-17), `signup_invites` = 0 rows — consistent with "open but unused", not with "closed". PR #261 (`sec/c3-auth-orgroles`) states "no Supabase Auth setting has been changed"; its design "holds even while public sign-up is still ON"; C4 (`wt-c4`) switches `signUp` to a server-side create (DEVELOPMENT ONLY).

**RISK:** anyone can create an account by `POST /auth/v1/signup` and become an authenticated principal. Tenant authorization must already hold against such an account (prompt §20); the profiles trigger (REMEDIATED 09-21) stops self-promotion, but `is_staff()`-based policies and the `change_log` `ALL true` policy (SEC-12) are what a hostile signed-in account meets.

**EXACT OWNER DECISION REQUIRED:**
1. Turn GoTrue public sign-up **off** now in the Supabase dashboard (Authentication → Providers → Email → "Allow new users to sign up" = off) **or** record, dated, why it stays on.
2. Record who implements 2A-A4b (server-side invite/create): the C3/C4 session (PR #261 + C4) is doing it today; the extraction reserved `login/actions.ts` for 2A. One name, in writing.
3. Whether #261 may be reviewed/merged before or after the toggle (the branch says either order is safe; the owner decides).

**WHAT CLAUDE MAY VERIFY READ-ONLY:** `GET https://uapxakmlwnpfsftfeezx.supabase.co/auth/v1/settings` with a publishable key **the owner hands over or authorizes fetching** (`get_publishable_keys`) → `disable_signup` value; `auth.users` count and `signup_invites` count (aggregates); PR #261 diff (already read).

**WHAT REQUIRES OWNER ACTION:** the dashboard toggle; the A4b ownership statement; the merge of #261 (merge = deploy: owner + prod baton).

**POST-ACTION VERIFICATION:** same `GET /auth/v1/settings` → `disable_signup=true`; a synthetic `POST /auth/v1/signup` with a throw-away address returns the "signups not allowed" error (no real account created); record date + result in `docs/security/`.

**ROLLBACK / RECOVERY:** the toggle is reversible in the dashboard in one click; existing sessions are unaffected; invite-based creation (once #261/C4 land) does not depend on the toggle.

---

## Card B — `session-autopilot.yml` (SEC-04 / KD-04 / TMMT-SEC-004 / 00-c)

**CURRENT VERIFIED STATE:** **RUNNING WORKFLOW + LATENT MERGE RISK; one leg LIVE.** Schedule `0 */6 * * *`; 10/10 recent runs `success`; permissions `contents: write`, `pull-requests: write`. Each run iterates every `claude/*` branch (11 today, incl. `claude/airtable-exit-fleet-os-kywbbl` 9 ahead and `claude/organize-chats-sessions-7t7zjy` 147 ahead) and:
- `gh pr create` → **refused** by the repository Actions setting `can_approve_pull_request_reviews:false` ("Allow GitHub Actions to create and approve pull requests" OFF); the error is discarded and logged as "PR already open or conflict, skipping" (0 open PRs have a `claude/*` head).
- `gh pr merge --auto --merge` → never reached (no PR number); would also fail because `allow_auto_merge:false`; branch protection cannot be set on this plan (403).
- **`git push origin --delete "$branch"`** when `AHEAD == 0` and no open PR → **LIVE today**; needs only `contents: write`; has not fired only because all 11 branches are ahead.

**RISK:** (i) flipping the Actions setting ON opens 11 PRs within 6 h; (ii) setting ON + `allow_auto_merge` ON + a plan upgrade/public repo with a `master` ruleset = every `claude/*` PR merges itself when `verify` + `pii-scan` go green, and **every merge to `master` auto-deploys `tmmt-ops` production**; (iii) editing `--auto` out of the merge line makes (i) alone sufficient for immediate merges; (iv) any `claude/*` branch merged by a human or reset to parity is deleted within 6 h with no further gate (history stays in the merge, but the ref and any unmerged reflog-only work are gone).

**EXACT OWNER DECISION REQUIRED:**
1. **Option A (recommended by SEC-004):** remove the `schedule` trigger (keep `workflow_dispatch` only, or delete the file) and delete the auto-merge and branch-delete steps. **Option B:** report-only (lists branches; `contents: read`, `pull-requests: read`). Pick one, dated.
2. Confirm the two repository settings stay as they are: Actions "Allow GitHub Actions to create and approve pull requests" = **OFF**; "Allow auto-merge" = **OFF**. (They are what blocks the merge leg today; SEC-004 must not touch them and no one else should either.)
3. Whether `claude/airtable-exit-fleet-os-kywbbl` should be moved out of the `claude/*` namespace (or given a PR) so the delete leg can never reach it while it is unreviewed.

**WHAT CLAUDE MAY VERIFY READ-ONLY:** `gh api repos/AIXMOS537/TMMT/actions/permissions/workflow`, `gh api repos/AIXMOS537/TMMT` (`allow_auto_merge`, `delete_branch_on_merge`), `gh run list --workflow session-autopilot.yml`, run logs, `gh pr list --state open`, `git rev-list origin/master..origin/<claude-branch> --count` for each `claude/*` branch.

**WHAT REQUIRES OWNER ACTION:** the A/B decision; merging the SEC-004 PR (a push to `master` = owner + prod baton, even though `vercel-ignore.sh` skips the build for workflow-only changes); any repository settings change.

**POST-ACTION VERIFICATION:** the SEC-004 guard test (`workflows-no-unattended-merge.test.ts`: no `gh pr merge --auto`, no `push origin --delete`, ≥1 workflow scanned) green on master; `gh run list --workflow session-autopilot.yml` shows no new `schedule` runs after the merge (Option A) or runs with the new report-only log (Option B); the two settings re-read unchanged.

**ROLLBACK / RECOVERY:** revert the single workflow commit; nothing else changes. A branch deleted by the live leg can be restored from the merge commit it was equal to (it only deletes at parity), so data loss is limited to reflog-only work.

---

## Card C — `mission-daily.yml` and the middleware machine-route chain (SEC-11 / KD-11 / KD-12 / KD-36 / TMMT-SEC-005 / TMMT-BUILD-001 / TMMT-BUILD-006 / 00-d)

**CURRENT VERIFIED STATE:** **RUNNING WORKFLOW, currently inert.** Daily 13:00 UTC (fires 16:05–18:33Z), 10/10 `success`, `curl --fail-with-body -X POST …/api/mission/generate -d '{"audience":"team","notify":true}'`. `src/middleware.ts` `isPublicPath()` does not include `/api/mission/`, the request has no session cookie → **307 to `/login`** with body `Redirecting...`; `--fail-with-body` only fails on ≥ 400 and does not follow redirects → green. The handler never runs; `CRON_SECRET` is never compared. If reachable: `audience=team` → `sendMissionToTeam` → `createSSRClient()` runs as `anon` → `select telegram_chat_id from profiles` → **0 rows** (0 populated; 0 of 3 policies name `anon`) → **0 recipients today**; `audience=owner` (manual dispatch) → one Telegram message to `TELEGRAM_OWNER_CHAT_ID` with dashboard numbers.

**RISK — the fix is a fan-out, not a switch ("do not just fix cron"):** adding `/api/cron|/api/mission|/api/license|/api/audit|/api/ops` to `isPublicPath` opens, in one change:

| Route | What starts happening (if its secret is present in Vercel — UNKNOWN, 403) | Risk |
|---|---|---|
| `/api/cron/journey-recompute` (Vercel 04:00) | `recomputeAllActiveJourneys()` → inserts `client_alerts`, upserts `journey_checkpoint_events` **30 min before pg_cron job 9 `aixmos_nightly_journey_recompute` (04:30)** → double recompute, duplicate alerts | MEDIUM (BUILD-006 first) |
| `/api/cron/marketing-kpi-ghl` (Mon 13:00) | upserts `marketing_kpi_weeks` from local mirrors (no GHL call) | LOW |
| `/api/mission/generate` (GitHub daily) | owner Telegram / team fan-out (0 today; live the moment `profiles.telegram_chat_id` is populated **and** readable) | MEDIUM (SEC-005 first) |
| `/api/license/heartbeat` (POST) | **no shared secret**: `organization_id` + `hardware_uuid` match → updates `organization_licenses.last_heartbeat_at`, writes `audit_events`; 404/401/200 = an org/hardware oracle; delivers `410 + kill_command` | HIGH |
| `/api/license/provision` (POST) | one-time `install_token` (sha256) binds hardware + enclave key | MEDIUM |
| `/api/license/revoke` (POST) | `x-admin-key` vs `ADMIN_KEY` → `active=false` / `kill_command='wipe'` → **remote wipe of partner installs** via heartbeat | HIGH if `ADMIN_KEY` set |
| `/api/audit/events` (POST) | `x-audit-key` → up to 10,000 NDJSON rows / 1 MB into `audit_events` (service role) | MEDIUM |
| `/api/ops/command` (POST) | `Bearer OPS_COMMAND_SECRET` → `executeOpsCommands`: `assign_staff` (ClickUp task), `advance_case`, **`approve_sync` → `applyVerifiedSync` → `pushCanonicalStageToGhl` (GHL tag + stage PUT) + `syncContactPortalFields` (GHL contact PUT)** — chat commands become **outbound GHL writes with no kill switch** | HIGH (card D first) |

Today none of these can execute, and both schedulers report green while being bounced.

**EXACT OWNER DECISION REQUIRED:**
1. `mission-daily.yml`: scheduled default **`audience=owner, notify=false`**, or **disable the schedule** (manual dispatch only). (SEC-005 makes the step fail on non-2xx / non-JSON either way.)
2. Which machine routes may be opened by BUILD-001, per route: `/api/cron/*` (only with/after BUILD-006 A or B), `/api/mission/*` (only after SEC-005 merged), `/api/audit/*`, `/api/ops/command` (only after card D gives GHL outbound a real switch, or with `approve_sync` disabled), `/api/license/*` (option (a) rate-limit + open, or (b) stay closed — BUILD-001 default (b)).
3. BUILD-006 option A (drop the Vercel cron, keep pg_cron) or B (staged `cron.unschedule`, baton).
4. Confirm, names only, which of `CRON_SECRET`, `OPS_COMMAND_SECRET`, `ADMIN_KEY`, `AUDIT_INGEST_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID` are present in Vercel Production (Claude cannot read them: 403).

**WHAT CLAUDE MAY VERIFY READ-ONLY:** workflow file + run logs (`gh run view <id> --log`), the middleware and route sources at `origin/master`, `cron.job` list and `profiles.telegram_chat_id` aggregate on prod, the pg_cron/Vercel schedule pairing.

**WHAT REQUIRES OWNER ACTION:** decisions 1–4; merges of SEC-005 → BUILD-006 → BUILD-001 (each merge = deploy, owner + baton); any env change; switching `team`/`notify=true` back on later is a "switch on live communication" action (owner + baton).

**POST-ACTION VERIFICATION:** SEC-005 static test green; a manual `workflow_dispatch` with `audience=owner, notify=false` returns 2xx JSON (after BUILD-001) with `sent=0`; `gh run list --workflow mission-daily.yml` shows red on any 3xx; BUILD-006 static test pins one scheduler; per opened route: 401 without credential, 401 with wrong credential, 401 with a session cookie and no secret (BUILD-001 tests); `/api/license/*` behaves per the recorded option.

**ROLLBACK / RECOVERY:** each PR reverts independently; reverting BUILD-001 restores the 307 for all routes at once; `journey-recompute` duplicates are visible in `client_alerts` (dedupe is a human step — reason to land BUILD-006 first).

---

## Card D — GHL outbound kill switches (V1 / V4 / KD-06 / SEC-08 / KD-13 / TMMT-SEC-007 / TMMT-SEC-003 / 00-e)

**CURRENT VERIFIED STATE (master, R2 §17):** **no dedicated kill switch exists.** Four outbound primitives in `src/lib/ghl/client.ts` (`addContactTag`, `updateContactCustomFields`, `updateOpportunityStage`, `sendConversationMessage`), all gated only by `GHL_API_KEY` + a location id (silent `return` when unset). Seven live call paths:

| # | Path | Switch beyond token/location presence |
|---|---|---|
| 1 | `POST /api/webhooks/ghl/overdue` → `addContactTag("payment-overdue")` | **none** |
| 2 | `POST /api/agent/voice/ghl` → voice tags ×≥5 + custom fields ×3 | **none** |
| 3 | staff sets `background_checks.eligibility_status` → prequal `addContactTag(decision.ghlTag)` | **none** |
| 4 | GHL `opportunity.stage_changed` webhook → `runGhlStageAutoOps` → `applyVerifiedSync` → tag + stage PUT + contact PUT | **`GHL_AUTO_OPS`** (default ON unless literally `"false"`; per-stage `GHL_STAGE_OPS_JSON`) — not payload-overridable |
| 5 | same webhook → `syncContactPortalFields` directly when a case is linked | **none** |
| 6 | `approve_sync` (`/api/ops/command`, UI apply-verified) → same two GHL writes | **none** |
| 7 | any unified intake → `processUnifiedIntake` → `syncContactPortalFields` | GHL-form leg **`GHL_FORM_AUTO_CASE`** (default ON; **webhook payload `create_case` wins over the env**); other intake sources **none** |
| 8 | `sendConversationMessage` (the only writer with a DNC/A2P gate) | **0 call sites** |

Inventory: 1 env-gated non-overridable, 1 payload-overridable, 5 with none; 0 dedicated kill switch, 0 DB flag (no `feature_flag*`/`*_settings`/`kill*` table on prod), 0 dry-run mode; `ghl_connections` registry (M3) exists on branches only (0 of 8 M3/M5/M6/M7 tables on prod). **Vercel env presence for `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_RESTORATION_LOCATION_ID`, `GHL_AUTO_OPS`, `GHL_FORM_AUTO_CASE`, `GHL_STAGE_OPS_JSON`, `GHL_WEBHOOK_SECRET*`: UNKNOWN (403).** All seven paths are latent today only because no verified GHL webhook has ever arrived (`ghl_webhook_events` = 0) and the voice/overdue/prequal/ops paths have not been exercised; the M7 branch does not add any outbound write (prompt §11/§12 freeze intact).

**RISK:** when GHL M6/M10 connects webhooks, or BUILD-001 opens `/api/ops/command`, paths 1–7 write tags/fields/stages into GHL — tags trigger GHL workflows that message people, including DNC contacts (SEC-08) — with no single place to stop it. `GHL_FORM_AUTO_CASE=false` can be overridden by an inbound payload (V4).

**EXACT OWNER DECISION REQUIRED (proposal options only, nothing done):**
1. **Env values now (00-e):** set `GHL_AUTO_OPS=false` and `GHL_FORM_AUTO_CASE=false` in Vercel Production + Preview (prod config change → owner + baton). Contains paths 4 and 7 (GHL-form leg) only; V4's payload override remains until the SEC-007 precedence fix lands (that file is now edited by M7 — see the delta).
2. **Switch design (pick one for a contract task; GHL owner reviews; not a Forge task yet):**
   - (a) one choke point inside `client.ts` (`ghlHeaders()` + `fetchWithTimeout(GHL_BASE…)`) honouring a single `GHL_OUTBOUND_ENABLED` (or inverse `GHL_OUTBOUND_FROZEN`), **default OFF**, refusing loudly (logged, `SmsBlockedError`-style) instead of a silent return — one flag, no payload can override, covers all 7 paths;
   - (b) structural: confirm `GHL_API_KEY` is **absent** in Vercel Production (writers then no-op) and replace the silent return with an explicit refusal so absence is visible;
   - (c) route all outbound through the M3 registry / M8 outbox design where only the outbox worker holds credentials (GHL track; later).
   Note SEC-007's constraint: "do not change default-on semantics when the env is unset" was written for `GHL_AUTO_OPS`/`GHL_FORM_AUTO_CASE`; a **new** flag with default OFF is a different decision and is the owner's.
3. Whether paths 1, 2, 3, 5, 6 may keep running with **no** switch until (a)/(b)/(c) exists, or whether the code guard (SEC-003 DNC before every writer) must land first.
4. Names only: which GHL env variables are present in Vercel Production today.

**WHAT CLAUDE MAY VERIFY READ-ONLY:** the code inventory above (done at `4cca6835`; `client.ts` unchanged on M7 and on every other branch); prod aggregates (`ghl_webhook_events` 0, `automation_outbox` 35/0 sent, `ghl_contacts` 1,656, catalog has no flag table); GHL branch diffs for new writers (none found).

**WHAT REQUIRES OWNER ACTION:** the Vercel env reads and changes (baton); the design decision; merges (SEC-007 test half, SEC-003 lib, the future contract task) — each merge = deploy, owner + baton. **No GHL call of any kind by Claude.**

**POST-ACTION VERIFICATION:** owner reads the env names in the Vercel dashboard and records presence (never values); unit tests: `GHL_AUTO_OPS=false` → `enabled:false`, no `cases`/`crm_sync_records` write; `GHL_FORM_AUTO_CASE=false` + payload `create_case:true` → no case (after the precedence fix lands via M7); for design (a): a fetch-mock test proves 0 calls to `services.leadconnectorhq.com` from all 7 paths with the flag off/unset. **Do not send a signed fixture to a preview** (preview uses the prod DB) unless the owner explicitly accepts that.

**ROLLBACK / RECOVERY:** env values revert in the dashboard (baton); code guards revert per PR; there is no data to roll back because no outbound write has ever fired from these paths on prod.

---

## Card E — Prod write baton enforcement gap + fileless ledger rows (NEW SEC-26/KD-46, KD-47 — proposed ids; `20260922004813`)

**CURRENT VERIFIED STATE (R2-P):** `ops.prod_write_baton` has 7 rows (ids 1, 3, 4, 5, 7, 8, 9; ids 2 and 6 absent — UNKNOWN why), 0 unreleased, status `free`. Of the 8 prod DDL rows applied on 09-21/22, **2 were under a baton** (`20260921234148` baton 8; `20260922005007` baton 9) and **6 were not**: `20260921230719 change_log_from_airtable_retirement`, `20260921233425 partner_acquisition_supply_side`, `20260921233517 partner_acquisition_public_intake_policy`, `20260922000537 fix_v_partner_pipeline_security_invoker`, `20260922000642 revoke_anon_execute_on_internal_helpers`, `20260922004813 index_hot_foreign_keys_and_drop_duplicate`. **None of those six has a file in any branch or worktree**; `LEDGER-SNAPSHOT.txt` is 8 rows behind; `KNOWN_UNAPPLIED` cannot pin them. All 17 rows since 09-17 have `array_length(statements,1) = 1` — the shape MCP `apply_migration` leaves. The baton is enforced only by a client-side PreToolUse hook in Claude sessions (as `claude:<session_id>`); nothing server-side refuses DDL while the baton is free; MCP calls are indistinguishable by login.

**`20260922004813` specifically:** performance-only (7 FK indexes created from the advisor's list, `parties_org_idx` duplicate dropped; no constraint/FK/policy/function/trigger change; `incoming_leads_org_id_idx` used 8 times since). Applied 00:48:13Z with the baton **free**, 88 s before baton 9 was acquired by the orchestration session (`claude:101528f1-…`). That session's baton-9 write applied only `partner_acquisition_least_privilege`; its subagents were forbidden prod writes and reported none; because MCP applies are indistinguishable by login, a subagent (or any other MCP-connected session) cannot be technically excluded. R2-P records the stylistic similarity to `005007` as an **inference, not evidence**. **PROVENANCE UNKNOWN. Nobody is cleared; nobody is accused.**

**RISK:** the baton rule (prompt §23; Desktop rule 2026-09-16) is currently a convention, not a control: any MCP-connected session (Claude, Cursor, Cowork, a cloud session) can change production schema with no holder, no approval ref, no evidence row, and no repo artefact. The drift register silently widens (KD-32). Security-relevant rows (a `change_log` table creation, a policy, a `security_invoker` fix, an anon-EXECUTE revoke) exist only as prod state.

**EXACT OWNER DECISION REQUIRED:**
1. **Acknowledge** that six un-batoned prod DDL writes occurred on 09-21/22 and that `004813`'s author is unknown; decide whether to ask each active session (orchestration, C3/C4, GHL, 2A, partner-acq, the `kywbbl` cloud session) to attest in writing what it applied — or to accept UNKNOWN and move on.
2. **Enforcement policy** (pick):
   - (a) process only — every session must run under the hook; MCP `apply_migration` is forbidden outside a baton hold (written rule, no technical control);
   - (b) technical — a server-side control (e.g. an event trigger on DDL / an `ops` check that raises when `prod_baton_status()` is `free`), designed and rehearsed like any prod migration, applied by the owner **with the baton** (it is itself a prod write; the `baton_reader` login from baton 4 already exists as a building block);
   - (c) both.
3. **Ledger backfill policy** for the six fileless rows: (i) reconstruct repository files from `supabase_migrations.schema_migrations.statements[1]` (read-only prod read; SQL text only, no row data), named with the prod version, and append them to `LEDGER-SNAPSHOT.txt` — via a PR, owner merge; or (ii) record them only in BUILD-003's `VERSION_MAP.tsv` as `prod-only, no artefact`; or (iii) both. Note `chore/revoke-user-execute-internal-definer-fns` (09-08) may or may not be the same change as `000642` (MANUAL REVIEW).
4. Whether the `KNOWN_UNAPPLIED` landing order (partner-acq 54/53 → GHL 58/59 → #251) is fixed by the owner now, so each landing re-measures once.

**WHAT CLAUDE MAY VERIFY READ-ONLY:** `ops.prod_baton_status()`, `ops.prod_write_baton` rows (metadata), `schema_migrations` rows and `statements`, catalog checks that each fileless row's objects exist as described, git/worktree searches for artefacts (done: 0 hits), session transcripts **only if the owner asks**.

**WHAT REQUIRES OWNER ACTION:** decisions 1–4; any enforcement migration (owner + baton); the backfill PR merge; attestation requests to other sessions.

**POST-ACTION VERIFICATION:** for (b): a rehearsal proving DDL is refused while `free` and allowed under `assert_prod_baton`, then one owner-run negative test on prod; for backfill: `migration-drift.test.ts` green with the re-measured constant and `LEDGER-SNAPSHOT.txt` at 281 rows; `PRODUCTION_MIGRATION_PROVENANCE_DELTA.md` §3 rows 10–16 each gain an artefact path or an explicit `prod-only` marker in `VERSION_MAP.tsv`.

**ROLLBACK / RECOVERY:** the six applied changes are not being rolled back (they are the intended state per the package: `change_log` table, partner intake policy, view invoker, anon revokes, indexes); an enforcement trigger, if chosen, must ship with its own `DROP` rollback and a break-glass path so a stale baton cannot block an emergency fix (`ops.recover_stale_prod_baton` exists).

---

**STOP.** These cards ask; they do not act. No setting, env, workflow, policy, migration, GHL call or send was changed by producing them.
