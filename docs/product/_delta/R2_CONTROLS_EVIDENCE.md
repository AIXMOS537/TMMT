# R2 CONTROLS EVIDENCE (deltas 6 · 16 · 17 · 14 · 13)

**Produced:** 2026-09-22 (UTC) · **Lane:** R2 evidence, read-only · **Canon:** `AIXMOS537/TMMT` `origin/master` @ `4cca6835` (fetched 2026-09-22), Vercel project `tmmt-ops` (`prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV`, team `team_UzatfZkJUpFKABaO6cZTQUq7`), production Supabase `uapxakmlwnpfsftfeezx`.
**Boundaries kept:** no writes, no DDL, no baton, no workflow enable/disable, no GHL calls, no Supabase Auth changes, no secret values printed. Vercel: `list_projects` works; `filter_project_envs` returns **403 Forbidden** on this connection → every "present in Vercel?" cell below is **UNKNOWN**. GitHub: `gh api` GET / `gh run` / `gh pr list` only; branch protection and rulesets return **403 "Upgrade to GitHub Pro or make this repository public"** (private repo on free plan).

---

## DELTA 6 — `session-autopilot.yml` and `mission-daily.yml`

### 6.1 `session-autopilot.yml` (origin/master)

| Item | Evidence |
|---|---|
| Triggers | `schedule: cron '0 */6 * * *'` (every 6 h) + `workflow_dispatch` |
| Permissions block | `contents: write`, `pull-requests: write` (job token `secrets.GITHUB_TOKEN`) |
| Branch pattern | `gh api repos/$REPO/branches --paginate --jq '[.[] \| select(.name \| test("^claude/")) \| .name]'` → only `claude/*` |
| PR creation | `gh pr create --head "$branch" --base master --title "session: $branch" --body …` (stderr to `/dev/null`, failure → `echo "PR already open or conflict, skipping"`) |
| Auto-merge | `gh pr merge "$PR_NUM" --auto --merge` (failure → `echo "Auto-merge unavailable … enable branch protection to unlock"`) |
| Branch delete | when `AHEAD == 0` and no open PR: `git push origin --delete "$branch"` |
| Guards | only `AHEAD=$(git rev-list origin/master..origin/$branch --count)`; no CI check, no label, no age, no allow-list, no owner approval; `set -euo pipefail` is neutralised by `\|\| echo` on every consequential command |
| Header comment | tells the owner to add branch protection requiring `verify` + `pii-scan` and to "Allow auto-merge" — "After that, every PR merges itself the moment CI goes green. Zero human input." |

**Run evidence (`gh run list --workflow session-autopilot.yml --limit 10`):** 10/10 `schedule` runs, all `success`, roughly every 4–6 h from 2026-09-19 15:11Z to 2026-09-21 21:34Z. Latest run `35657996638` log:

```
── claude/airtable-exit-fleet-os-kywbbl        Creating PR (7 commit(s) ahead)   → PR already open or conflict, skipping
── claude/autonomous-session-policy            Creating PR (1)                    → skipping
── claude/catchup-aixmos-tmmt-5wv942           Creating PR (11)                   → skipping
── claude/credit-limit-balance-zj8551          Creating PR (3)                    → skipping
── claude/employee-fleet-local-first           Creating PR (1)                    → skipping
── claude/everything-best-mode                 Creating PR (1)                    → skipping
── claude/file-work-review-fhknek              Creating PR (4)                    → skipping
── claude/harden-approval-hook                 Creating PR (1)                    → skipping
── claude/new-session-1ex1vm                   Creating PR (1)                    → skipping
── claude/organize-chats-sessions-7t7zjy       Creating PR (147)                  → skipping
── claude/tmmt-stack-overhaul-1l45nw           (same)
Summary: PRs created=0 auto-merge-enabled=0 branches-deleted=0
```

`gh pr list --state open` → 8 open PRs, **0 with a `claude/*` head**. So "PR already open" is false; `gh pr create` is failing and the error is discarded.

**Exact reason it does nothing today (two independent blockers, in order):**

1. **PR creation is refused by the repository's Actions setting.** `gh api repos/AIXMOS537/TMMT/actions/permissions/workflow` → `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}`. With "Allow GitHub Actions to create and approve pull requests" OFF, GitHub rejects `gh pr create` from `GITHUB_TOKEN` regardless of the workflow's own `pull-requests: write` block. `PR_NUM` stays empty → the merge line is never reached → `auto-merge-enabled=0`.
2. **Auto-merge is off at repo level.** `gh api repos/AIXMOS537/TMMT` → `allow_auto_merge:false`, `allow_merge_commit:true`, `allow_squash_merge:true`, `allow_rebase_merge:true`, `delete_branch_on_merge:false`, `default_branch:master`, `private:true`, `allow_update_branch:false`. Even with a PR, `gh pr merge --auto` fails; additionally, with no branch protection (403 = feature unavailable on plan) there are no "pending requirements" for auto-merge to wait on.

**Status: RUNNING WORKFLOW + LATENT MERGE RISK.** Additionally, one path is **live, not latent**: the `git push origin --delete` branch of the script needs only `contents: write` (granted) and fires for any `claude/*` branch that reaches `AHEAD == 0` with no open PR. Today all 11 `claude/*` branches are ahead (1–147 commits), so it has not fired; a `claude/*` branch that is merged by a human, or reset to master, would be deleted within 6 h with no further gate.

**Exact configuration changes that make it dangerous (each alone or combined):**

| Change | Effect | Who can make it |
|---|---|---|
| A. Repo → Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" ON | within 6 h, 11 PRs opened automatically, including `claude/airtable-exit-fleet-os-kywbbl` (7 commits, the unclassified rules-engine track) and `claude/organize-chats-sessions-7t7zjy` (147 commits) | repo admin |
| B. Repo → Settings → General → "Allow auto-merge" ON (`allow_auto_merge:true`) **plus** a branch ruleset/protection on `master` requiring `verify` + `pii-scan` (needs GitHub Pro or a public repo) | every autopilot PR merges itself when the two checks go green; a merge to `master` auto-deploys `tmmt-ops` production (`vercel.json` `git.deploymentEnabled.master: true`) | repo admin (+ plan upgrade or making the repo public) |
| C. Editing the workflow: `gh pr merge --auto --merge` → `gh pr merge --merge` | with A alone (no protection, no auto-merge needed) every `claude/*` PR merges immediately on the next run | anyone who can push to `master` (unprotected) |
| D. Any `claude/*` branch reaching parity with `master` | deleted on the next run (live today) | any pusher |

Note the "required checks" would be `verify` (`verify.yml`, job `verify`, on `pull_request` and `push: master`) and `pii-scan` (`pii-guard.yml`, on `[push, pull_request]`). Neither runs E2E, SQL rehearsals or isolation tests (package §5).

### 6.2 `mission-daily.yml` (origin/master)

| Item | Evidence |
|---|---|
| Triggers | `schedule: cron "0 13 * * *"` (daily 13:00 UTC) + `workflow_dispatch` (inputs `audience` default **team**, `notify` default **"true"**) |
| Call | `curl -sS --fail-with-body -X POST "$MISSION_API_BASE/api/mission/generate" -H "x-cron-secret: $CRON_SECRET" -d '{"audience":"team","notify":true}'`; `MISSION_API_BASE` defaults to `https://tmmt-ops.vercel.app`; fails only if repo secret `CRON_SECRET` is unset |
| Runs | 10/10 `schedule` runs `success`, daily 2026-09-12 → 2026-09-21 (actual fire times 16:05Z–18:33Z; GitHub cron delay) |
| Latest run `35639093150` | `Calling https://tmmt-ops.vercel.app/api/mission/generate (audience=team notify=true)` → response body **`Redirecting...`** |

**Why "success" while doing nothing:** `src/middleware.ts` `isPublicPath()` does not include `/api/mission/`; the request carries no Supabase session cookie → `!user && !isPublicPath` → `307` to `/login`. `curl --fail-with-body` only fails on ≥ 400 and does not follow redirects, so the step exits 0 with the redirect body. The route handler never runs; `CRON_SECRET` is never compared.

**What it would do if the middleware let it through** (`src/app/api/mission/generate/route.ts` → `src/lib/mission/send.ts`):

1. `authorized()` = `CRON_SECRET ?? OPS_COMMAND_SECRET` compared against `authorization: Bearer`, `x-cron-secret` or `x-mission-secret`; unset secret → always 401. (Vercel value presence: UNKNOWN.)
2. `audience=team` (workflow default) → `sendMissionToTeam`: `getDashboardData()` → renders the Mission Control text → `createSSRClient()` (cookie-bound; a cron request has no cookies, so it runs as `anon`) → `select telegram_chat_id from profiles where telegram_chat_id is not null` → `fanOutMissionToChats(chatIds, text, notifyTelegram)`.
   - Prod facts: `profiles` rows with `telegram_chat_id` **= 0**; `anon` holds a SELECT grant on `profiles` but **0 of its 3 policies** name `anon` → RLS returns 0 rows either way. **Recipients = 0, sends = 0** today.
3. `audience=owner` (manual dispatch) → `sendOwnerMissionToTelegram` → `notifyTelegram({chatId: TELEGRAM_OWNER_CHAT_ID, text})` using `TELEGRAM_BOT_TOKEN` → **one Telegram message to the owner** containing dashboard numbers. Not customer-facing.
4. `GET` defaults `notify=true`; `POST` defaults `notify=false` but the workflow passes `notify:true` explicitly.

**Status: RUNNING WORKFLOW, currently inert (307 at the edge); re-arming = daily owner-Telegram (owner audience) or zero-recipient fan-out (team audience) until `profiles.telegram_chat_id` is populated and readable.**

---

## DELTA 16 — middleware → machine-route dependency chain

### 16.1 What `src/middleware.ts` (master) lets through without a session

`isPublicPath()` API prefixes: `/api/auth/`, `/api/webhooks/`, `/api/forms/`, `/api/agent/`, `/api/leads/`, `/api/health`, `/api/agent/health`, `/api/agent/_health`, `/api/agent/sms/`, `/api/agent/stripe/webhook/`, `/api/agent/cal/webhook/`. `/api/pocket/` and `/api/offline/` are allowed only for a signed-in user. Everything else under `/api/` hits the Supabase `getUser()` gate (fail-closed on error) and, with no user, is **307-redirected to `/login`**. The matcher covers every path except static assets.

**Machine routes redirected today (verified list from the route tree):**

| Route | Caller that exists today | Auth inside the handler | What the handler writes / sends when reachable | Risk if middleware is changed to let it through |
|---|---|---|---|---|
| `/api/cron/journey-recompute` (GET/POST) | Vercel cron `0 4 * * *` (`vercel.json`) | `CRON_SECRET ?? OPS_COMMAND_SECRET` (Bearer / `x-cron-secret`); unset → 401 | `recomputeAllActiveJourneys()` → reads `client_journey`, **inserts `client_alerts`**, upserts `journey_checkpoint_events` (service role). No external send in the handler; `client_alerts` rows surface in the customer portal. | **MEDIUM**: duplicates the DB-side `pg_cron` job 9 `aixmos_nightly_journey_recompute` (`30 4 * * *`, `recompute_all_journeys()`), i.e. two recomputes 30 min apart and possible duplicate `client_alerts`. |
| `/api/cron/marketing-kpi-ghl` (GET/POST) | Vercel cron `0 13 * * 1` | same secret | `syncMarketingKpiWeekFromGhl()` → reads **local mirrors** (`ghl_contacts`, `ghl_appointments`, `ghl_form_submissions`, `credit_billing_plans`; no GHL API call despite the name), upserts `marketing_kpi_weeks`. | LOW (internal KPI row). |
| `/api/mission/generate` (GET/POST) | GitHub `mission-daily.yml` daily | same secret (+ `x-mission-secret`) | Telegram send to owner / team fan-out (§6.2). | **MEDIUM**: re-arms a daily Telegram with dashboard data; team fan-out becomes live the moment `profiles.telegram_chat_id` is populated and readable. |
| `/api/license/heartbeat` (POST) | partner/flash-drive clients (`tmmt-agent` installs; whether any exist is UNKNOWN) | **no shared secret**; only `organization_id` + `hardware_uuid` must match an `organization_licenses` row with `install_token_used` | updates `organization_licenses.last_heartbeat_at`; `emitAudit` writes `audit_events`; returns `410 + kill_command` when `active=false` or `kill_command='wipe'` | **HIGH when opened**: unauthenticated write + an org-id/hardware oracle (404 vs 401 vs 200); also the delivery channel for remote wipe. |
| `/api/license/provision` (POST) | first-run install | one-time `install_token` (sha256 match) | binds `hardware_uuid` + `enclave_pubkey_pem`, consumes token, `audit_events` | MEDIUM (token-gated but token strength/issuance UNKNOWN; header comment: enrolment, not attestation). |
| `/api/license/revoke` (POST) | admin | `x-admin-key` vs `ADMIN_KEY` (unset → 401) | `active=false` / `kill_command='wipe'` on `organization_licenses` → consumed by heartbeat = **remote wipe of partner installs** | **HIGH when opened and `ADMIN_KEY` is set** (Vercel presence UNKNOWN). |
| `/api/audit/events` (POST) | partner clients | `x-audit-key` vs `AUDIT_INGEST_KEY` (unset → 401) | inserts up to 10,000 NDJSON rows / 1 MB into `audit_events` via service role | MEDIUM (append-only ingest; volume). |
| `/api/ops/command` (POST) | `tmmt-agent-channel/command_router.py` (Telegram / iMessage / Slack / CLI) | `Bearer OPS_COMMAND_SECRET` (unset → 503) | `executeOpsCommands`: `assign_staff` (creates **ClickUp task**, updates `cases`), `assign_vendor`, `advance_case`, **`approve_sync` → `applyVerifiedSync` → `pushCanonicalStageToGhl` (GHL tag + opportunity-stage PUT) + `syncContactPortalFields` (GHL contact PUT) + `syncClientAlertsForStage` (`client_alerts` insert)**, `post_ledger` | **HIGH**: natural-language commands from chat become outbound GHL writes and ledger posts; none of the GHL calls on this path honour any flag other than token/location presence (§17). |

Also redirected (not in the delta list but same class): `/api/pocket/*` for unauthenticated callers.

### 16.2 The chain

```
fix middleware (add /api/cron|/api/mission|/api/license|/api/audit|/api/ops to isPublicPath)
  ├─→ Vercel cron 04:00 journey-recompute becomes reachable
  │      └─→ handler runs 30 min before pg_cron job 9 → double recompute, client_alerts inserts (MEDIUM)
  ├─→ Vercel cron Mon 13:00 marketing-kpi-ghl reachable → marketing_kpi_weeks upsert (LOW)
  ├─→ GitHub mission-daily 13:00 reachable
  │      └─→ CRON_SECRET matches? (UNKNOWN in Vercel) → Telegram to owner / 0-recipient team fan-out (MEDIUM, grows with profiles.telegram_chat_id)
  ├─→ /api/license/heartbeat + /provision reachable → unauthenticated organization_licenses writes + oracle (HIGH)
  ├─→ /api/license/revoke reachable → if ADMIN_KEY set: remote wipe capability exposed to key holders (HIGH)
  ├─→ /api/audit/events reachable → if AUDIT_INGEST_KEY set: bulk audit_events ingest (MEDIUM)
  └─→ /api/ops/command reachable → if OPS_COMMAND_SECRET set: chat-driven approve_sync
         └─→ pushCanonicalStageToGhl + syncContactPortalFields → OUTBOUND GHL WRITES with no kill switch (HIGH)
```

Every "fires" above is conditional on the corresponding secret being present in Vercel, which this lane could not read (403). The one certainty is that today **none** of these routes can execute, and the GitHub/Vercel schedulers are all reporting green while being bounced. No recommendation to "just fix cron" — the fix is a fan-out, not a single switch.

---

## DELTA 17 — outbound-GHL kill switches on master

### 17.1 Outbound primitives (all in `src/lib/ghl/client.ts`, `GHL_BASE = https://services.leadconnectorhq.com`)

| Primitive | HTTP | Gate inside the primitive | Payload override? |
|---|---|---|---|
| `addContactTag(contactId, tag, kind)` | `POST /contacts/{id}/tags` | `isGhlConfigured(kind)` = `GHL_API_KEY` **and** (`GHL_LOCATION_ID` or, for `restoration`, `GHL_RESTORATION_LOCATION_ID`); unset → silent `return` | no |
| `updateContactCustomFields(contactId, fields, kind)` | `PUT /contacts/{id}` | same | no |
| `updateOpportunityStage({…, locationId?})` | `PUT /opportunities/{id}` | `GHL_API_KEY` **and** `locationOr(args.locationId)` — a caller-supplied `locationId` substitutes for the env location | partial (location) |
| `sendConversationMessage({…, type SMS/Email})` | `POST /conversations/messages` | SMS: `assertOutboundAllowed` (A2P + DNC + per-lead opt-out, `SmsBlockedError`); then `GHL_API_KEY` + location | `ownerApproved`, `locationId` |
| reads (`findGhlContactByPhone/Email`, `listPipelines`, `findPipelineStageId`) | GET | token + location | — |

**`sendConversationMessage` has 0 live call sites on master** (only comments in `src/lib/ops/va-task-outbox.ts`); the only writer with a DNC gate is therefore dead code. The four tag/field/stage writers have **no DNC check** (package SEC-003).

### 17.2 Every control that exists (names only; values never read)

| Control | Where read | What it gates | Default when unset | Overridable? | Vercel? |
|---|---|---|---|---|---|
| `GHL_API_KEY` | `client.ts` (`isGhlConfigured`, every writer), `org-location.ts` `ghlAuthForTarget` | **all** outbound + reads | **closed** (writers return silently) | no | UNKNOWN |
| `GHL_LOCATION_ID` / `GHL_RESTORATION_LOCATION_ID` | `client.ts` `resolveGhlLocationId` | tag/field writers (both required); stage/message writers accept a caller `locationId` | closed for tag/field; stage/message closed unless caller passes a location | partly (stage/message) | UNKNOWN |
| `GHL_AUTO_OPS` | `src/lib/ops-command/stage-rules.ts:96` `isGhlAutoOpsEnabled` (`!== "false"`) | `runGhlStageAutoOps` on `opportunity.stage_changed` webhooks → `applyVerifiedSync` → `pushCanonicalStageToGhl` + `syncContactPortalFields` | **OPEN** (on unless literally `"false"`) | per-stage via `GHL_STAGE_OPS_JSON` `auto_apply:false`; not by payload | UNKNOWN |
| `GHL_STAGE_OPS_JSON` | `stage-rules.ts` `loadOverrides` | per-stage `auto_apply`, `assignee_email`, `case_status`, `run_routing` | built-in rules (8 stages `auto_apply:true`) | env only | UNKNOWN |
| `GHL_FORM_AUTO_CASE` | `src/lib/ghl/handlers/form.ts:137` (`!== "false" && customerName !== "GHL Form Lead"`) | `processUnifiedIntake` on GHL form webhooks → `src/lib/intake/unified.ts:146` `void syncContactPortalFields` (GHL PUT) | **OPEN** | **YES — webhook payload `create_case` wins** (`parsed.data.create_case ?? …`), so an inbound GHL form payload can force case creation and the GHL write regardless of the env flag | UNKNOWN |
| `GHL_CLIENT_ALERTS` | `handlers/opportunity-stage.ts:181` (`!== "false"`) | `syncClientAlertsForStage` → **`client_alerts` insert only** (not a GHL write) | OPEN | no | UNKNOWN |
| `GHL_WEBHOOK_SECRET`, `GHL_VOICE_WEBHOOK_SECRET`, `GHL_OVERDUE_WEBHOOK_SECRET` (falls back to `GHL_WEBHOOK_SECRET`) | webhook routes / `webhook-auth.ts` | **inbound** authentication of the routes that trigger outbound writes | closed (secretMatches against undefined fails; tests in `webhook-auth.test.ts`) | no | UNKNOWN |
| `GHL_CONVERSATION_PROVIDER_ID`, `GHL_EMAIL_FROM`, `GHL_CF_*_KEY`, `GHL_KPI_*`, `GHL_DEFAULT_ASSIGNEE_EMAIL`, `GHL_PIPELINE_STAGE_MAP_JSON`, `GHL_CASE_STATUS_MAP_JSON` | various | parameters / mappings, **not gates** | — | — | UNKNOWN |
| `DRY_RUN` / `dryRun`-style flag for GHL | grep `src` | **does not exist** on master | — | — | — |
| DB feature flags | prod catalog: no `feature_flag*`, `*_settings`, `*integration*`, `kill*` table; matches only `automation_outbox` (35 rows, 0 sent), `ghl_contacts` 1,656, `ghl_appointments` 0, `ghl_form_submissions` 0, `ghl_webhook_events` 0 | **none** | — | — | — |
| `ghl_connections` registry (GHL M3) | branches only; **0 of 8 M3/M5/M6/M7 tables on prod** | not live | — | — | — |
| `ghlAuthForTarget` (`org-location.ts`) | foreign-agency targets → `credential_pending` refusal | prevents sending the house token to a foreign agency; house targets still use `GHL_API_KEY` | closed for foreign, open for house | no | — |

### 17.3 Call paths → which switch, if any

| # | Path (trigger → writer) | Switch beyond token/location presence |
|---|---|---|
| 1 | `POST /api/webhooks/ghl/overdue` → `addContactTag(contact,"payment-overdue")` (the "GHL-tag payment capability", package SEC-002) | **none** (inbound secret only) |
| 2 | `POST /api/agent/voice/ghl` → `ghl-voice-handler` / `ghl-voice-tags`: `addContactTag` ×≥5 tags, `updateContactCustomFields` ×3 | **none** (inbound voice secret only) |
| 3 | staff sets `background_checks.eligibility_status` (`(admin)/admin-actions.ts`) → `aixmos-prequal-act.routeDeclinedApplicant` → `addContactTag(decision.ghlTag)` | **none** (consent gates only the AIXMOS handoff, not the tag) |
| 4 | GHL `opportunity.stage_changed` webhook → `runGhlStageAutoOps` → `applyVerifiedSync` → `pushCanonicalStageToGhl` (tag + stage PUT) + `syncContactPortalFields` (contact PUT) | **`GHL_AUTO_OPS`** (default open) + per-stage `auto_apply` |
| 5 | same webhook → `void syncContactPortalFields` directly (`opportunity-stage.ts:171`) when a case is linked | **none** |
| 6 | human/ops `approve_sync` (`/api/ops/command`, UI apply-verified) → `applyVerifiedSync` → same two GHL writes | **none** |
| 7 | any unified intake (`/api/forms/*`, GHL form webhook, other intake sources) → `processUnifiedIntake` → `syncContactPortalFields` | GHL-form leg: **`GHL_FORM_AUTO_CASE`**, payload-overridable; other intake sources: **none** |
| 8 | `sendConversationMessage` | DNC/A2P gate — **0 call sites** |

**Inventory:** 4 live outbound primitives · 7 live call paths · **1 path with an env switch that cannot be overridden (`GHL_AUTO_OPS`, default open)** · **1 path with a payload-overridable switch (`GHL_FORM_AUTO_CASE`)** · **5 paths with no switch at all** beyond "is a token + location present". 0 dedicated kill switch, 0 DB switch, 0 dry-run mode. Scripts under `scripts/` (5 files touching `leadconnectorhq`) run only with a local env and are outside the app runtime.

### 17.4 What would make unintended outbound GHL behaviour structurally impossible (proposals only, nothing done)

1. **One choke point, default-off.** Every writer and read goes through `ghlHeaders()` + `fetchWithTimeout(GHL_BASE…)` in `client.ts`. A single `GHL_OUTBOUND_ENABLED` (or inverse `GHL_OUTBOUND_FROZEN`) honoured *inside* that wrapper — refusing with a logged `SmsBlockedError`-style error rather than a silent return — makes the seven paths above depend on one flag that no payload can override. Default must be **off** (unlike `GHL_AUTO_OPS`/`GHL_FORM_AUTO_CASE`, which are on-unless-"false").
2. **Missing token = structural.** With `GHL_API_KEY` absent in Vercel the writers already no-op silently. This is only "structural" if the owner confirms the variable is absent in production (UNKNOWN here) and if the silent-return is replaced by an explicit refusal so the absence is visible.
3. **Network-level.** Vercel functions have no native egress allow-list; a deny for `services.leadconnectorhq.com` would need an egress proxy or a Vercel Firewall-adjacent product. Achievable only by routing GHL traffic through the M3 connection registry / M8 outbox design, where the outbox worker is the only host with credentials.
4. **Close the payload override.** `form.ts` should treat `create_case` from an inbound webhook as advisory under the env flag, not above it.
5. **DNC before every writer**, not only the unused message sender (package SEC-003).

---

## DELTA 14 — AUTH-SIGNUP-001 (public signup)

**Search for a committed, genuinely publishable key on `origin/master`:**

- `.env.example` / `.env.legacy.example`: `NEXT_PUBLIC_SUPABASE_ANON_KEY=` **blank**.
- `sb_publishable_` occurrences: `docs/runbooks/END-TO-END-TEST.md:33,39` (prose: "must be the `sb_publishable_…` key"; also states the legacy anon JWT was **disabled on 2026-09-16**), `scripts/set-service-key.sh:38` (a `case` pattern that *rejects* a pasted publishable key). No literal key.
- Anon-JWT header string: `docs/security/GITLEAKS-PUSH-BLOCKED.md` (truncated `eyJhbGciO…`), `tools/wiki/index.html` (bare header segment, no payload). Not usable keys.

**Result:** no committed publishable key → per the lane rule **no `GET /auth/v1/settings` was attempted**. (The Supabase MCP `get_publishable_keys` tool could supply one, but that is not "committed in the repo" and was deliberately not used.)

**Status: UNVERIFIED / OWNER ACTION.** Last direct evidence remains **2026-09-17: `disable_signup=false`** (package §12/§15 blocker 1). Checkpoint §2 adds `auth.users = 3`, 0 created since 2026-09-17, `signup_invites` 0 rows — consistent with "open but unused", not with "closed".

---

## DELTA 13 — `partner_acquisition` bookkeeping

**Production catalog (read 2026-09-22):**

| Check | Value |
|---|---|
| `pg_policies` on `public.partner_acquisition` | **3**: `partner_acq_anon_insert` (INSERT, `{anon}`), `partner_acq_authenticated_intake_insert` (INSERT, `{authenticated}`), `partner_acq_platform_admin_all` (ALL, `{authenticated}`) |
| `partner_acq_authenticated` (`USING (true)`) | **absent** |
| RLS | enabled (`relrowsecurity = true`) |
| Table grants | `anon: INSERT`; `authenticated: SELECT, INSERT, UPDATE, DELETE` (REFERENCES/TRIGGER/MAINTAIN gone) |
| `v_partner_pipeline` | `authenticated: SELECT` only; `security_invoker` set by `20260922000537` and re-asserted by `005007` |
| Rows | 0 |
| Ledger | `20260922005007 partner_acquisition_least_privilege` (statements match the prepared file's intent: drop defect policy, platform-admin ALL, authenticated ungraded INSERT, revoke/regrant, view grants) |
| Baton | id 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`, result `applied+verified` |

**Status: PRODUCTION REMEDIATED / POST-APPLICATION VERIFIED.**

**Repository status (lane R1 owns landing; recorded here only):** the migration file `supabase/migrations/20260922003000_partner_acquisition_least_privilege.sql` exists **only** on local branch `sec/partner-acquisition-rls` @ `620e100e` (worktree `C:\dev\wt-sec-partner-acq`, 1 commit ahead of `4cca6835`). There is **no `origin/sec/partner-acquisition-rls`** ref (remote has only `origin/feat/partner-acquisition`, whose PR #255 is closed). Its three creating migrations (`233425`, `233517`, `000537`) have no file anywhere (see `PRODUCTION_MIGRATION_PROVENANCE_DELTA.md` §3).

---

## Baton + ledger footer

- `ops.prod_baton_status()` → `{"state":"free"}`.
- `ops.prod_write_baton`: 7 rows (ids 1, 3, 4, 5, 7, 8, 9), 0 unreleased; full summary in `PRODUCTION_MIGRATION_PROVENANCE_DELTA.md` §4.
- Production migration count: **281**.
- `cron.job` on prod: 10 active jobs (`rebalance_all_orgs` */30, `aixmos_daily_va_sweep` 12:00, `aixmos_daily_edge_brief` 12:20, `leadnet-sla-sweep` */15, `leadnet-daily-digest` 13:00, `sweep-overdue-payments` 13:00, `sweep-payment-due-notices` 13:05, `agent-wp-reap` every minute, `aixmos_nightly_journey_recompute` 04:30, `aixmos_daily_va_classify` 12:15) — listed because job 9 is the other half of the journey-recompute doubling in §16 and jobs 6/7 are the DB-side producers behind the overdue/payment paths; none of them calls GHL directly (they call `public.*` functions; `automation_outbox` 35 rows / 0 sent, no drainer).
