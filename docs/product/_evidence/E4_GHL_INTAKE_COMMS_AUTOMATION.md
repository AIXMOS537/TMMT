# E4 — GHL, Universal Lead Intake, Communications, Automations, Failure States

**Date:** 2026-09-21 · **Code:** `origin/master` `4cca6835` (worktree `C:\dev\wt-master-extraction`) · **Prod:** `uapxakmlwnpfsftfeezx`. I ran only catalog and aggregate count reads. I read no row contents and made no writes.
**GHL:** not called. **Target docs (read-only):** `C:\dev\wt-ghl-m3m4\docs\audits\TMMT_GHL_MASTER_AUDIT.md` and `docs\audits\ghl-router\*`. The intake registry, SoR prep and implementation plan are byte-identical to the Desktop copies in `TMMT-GHL-ROUTER\`.
**Rule:** code is evidence. Status words: EXISTING/WORKING · EXISTING/PARTIAL · EXISTING/BROKEN · PLACEHOLDER · ORPHANED · LEGACY · PLANNED ONLY · MISSING · UNKNOWN.

---

## 0. Headline

| | CURRENT IMPLEMENTATION (master `4cca6835`) | M3/M4 TARGET (in progress, `feat/ghl-router-m3-m4` @ `21311265`, **not merged, not applied**) |
|---|---|---|
| Credential | One global env bearer `GHL_API_KEY` (`src/lib/ghl/client.ts:38-44`). No OAuth, no per-org credentials in the DB | `ghl_connections` 1:N per org, with a Vault credential ref. Only `service_role` can read it through `ghl_connection_credential` |
| Location | Env `GHL_LOCATION_ID` (Rentals). `GHL_RESTORATION_LOCATION_ID` falls back to Rentals (`client.ts:18-27`) | `ghl_locations` owned by an org. NULL means UNKNOWN, **never** the env value. `ghl_resolve_location` resolves by exact match only |
| Pipelines / stages | Env `GHL_PIPELINE_STAGE_MAP_JSON` ships empty, so every stage maps to `inquiry` (`src/lib/crm-sync/stage-map.ts`). Resolved by stage **name** at call time (`client.ts:210-230`) | `ghl_pipelines` / `ghl_pipeline_stages` from discovery snapshots; `ghl_resolve_stage`, no first-row fallback |
| Workflows / calendars / users / custom fields / tags | Not modelled. The app relies on tag side effects and a fixed list of 4 custom-field keys (`sync-contact-portal-fields.ts:15-18`) | Registry tables `ghl_workflows`, `ghl_calendars`, `ghl_users`, `ghl_custom_fields`, `ghl_tags`. Discovery is read-only (7 allow-listed GETs) |
| N-org / N-location | **MISSING.** `src/lib/ghl/org-location.ts` (per-org resolver) is **ORPHANED**: 0 callers, and its table `org_ghl_connections` is only in `_staged/`, never applied | 1:N tested in dev (M3 check `l`). Migration `20260922100000_m3_ghl_connection_registry.sql` is **not on master and not applied to prod** |
| Live data path | **Off-repo.** M1 Mac launchd `com.tmmt.ghl-supabase-sync` (6 h) → `ghl_contacts` upsert → prod trigger `promote_ghl_contact` → `incoming_leads`. Prod shows `ghl_contacts` = 1,656, `max(synced_at)` = 2026-09-21 22:05:58Z | M4 discovery covers config only. The contact sync is due to replace the M1 job in M5/M6 (shadow → compare → owner switch-off → cut-over) |

**Verdict:** today GHL is **one sub-account (Rentals) reached through one env token**, plus an unowned laptop poller. Every multi-location concept exists only on the M3/M4 branch, which is **PLANNED ONLY** from master's point of view.

---

## 1. Current GHL surface on master

### 1.1 Outbound GHL calls (`src/lib/ghl/client.ts`)

| Function | Endpoint | Callers (non-test) | Status |
|---|---|---|---|
| `findGhlContactByEmail/ByPhone`, `findGhlContactInLocation` | `GET /contacts/search/duplicate` | `ghl/resolve-contact.ts:37`, `agent/voice/ghl-voice-handler.ts:74` | EXISTING/PARTIAL: the code is live, but GHL-side traffic is UNKNOWN (`ghl_webhook_events` = 0) |
| `updateContactCustomFields` | `PUT /contacts/{id}` | `sync-contact-portal-fields.ts:68`, `voice/ghl-voice-tags.ts:30,46,70` | EXISTING/PARTIAL |
| `addContactTag` | `POST /contacts/{id}/tags` | `webhooks/ghl/overdue/route.ts:65`, `ghl/sync-outbound.ts:75`, `aixmos-prequal-act.ts:99`, `voice/ghl-voice-handler.ts:150,172`, `voice/ghl-voice-tags.ts:27-64` | EXISTING/PARTIAL |
| `findPipelineStageId` + `updateOpportunityStage` | `GET` stages, `PUT /opportunities/{id}` | `ghl/sync-outbound.ts:79`, reached via `crm-sync/apply-verified.ts:107` (`void`, fire-and-forget) | EXISTING/PARTIAL: needs a stage map, which ships empty |
| `listPipelines` | `GET /opportunities/pipelines` | none | ORPHANED (scripts and tests only) |
| `sendConversationMessage` | `POST /conversations/messages` | **none** (tests and outbox-test mocks only) | ORPHANED, see claim (d) |
| Create contact / opportunity / appointment; trigger workflow | — | — | MISSING |

**Location handling:** every live outbound call resolves `locationOr()` → env (`client.ts:190-192`); no caller passes an org-derived `locationId`. Voice passes `location_kind`, which comes from the **payload** (`rentals`/`restoration`).

### 1.2 Inbound webhooks

| Route | Auth | Replay | Idempotency | Writes | Prod evidence |
|---|---|---|---|---|---|
| `POST /api/webhooks/ghl` (`route.ts:41`) | `verifyGhlWebhook`, fails closed without `GHL_WEBHOOK_SECRET` (`webhook-auth.ts:127-130`). HMAC-SHA256 when `x-ghl-signature`/`x-wh-signature` is present, otherwise a shared header, both constant-time (`:132-147`) | 5 min, **only if a timestamp is sent** (`:103-107`) | `ghl_webhook_events` PK insert **before** processing (`route.ts:65`). Id = `webhookId‖eventId‖id‖sha256(...)` (`webhook-auth.ts:156-168`) | CRM dispatch (`route.ts:77-84`), or the legacy tag path: `customer_payments`, token top-up, referral payout, ClickUp, and notes by `ilike` email with **no org filter** (`:210-240`) | `ghl_webhook_events` = 0 → never received a verified event |
| `/ghl/contact`, `/ghl/form`, `/ghl/appointment` (each a 7-line wrapper → `ghl/http.ts:6`) | same | same | same, consumed first (`http.ts:77`) | `ghl_contacts`, `ghl_form_submissions` (+ an auto-case), `ghl_appointments` | `ghl_form_submissions` = 0, `ghl_appointments` = 0 |
| `/ghl/program` (`route.ts:25-87`) | same | same | consumed at `:48` | `program_applications` via `createProgramApplicationFromGhl` | `program_applications` = 0 |
| `/ghl/overdue` (`route.ts:28`) | `secretMatches` on `x-ghl-secret` only, no HMAC (`:29-33`) | per-day content hash (`:49`) | yes | `sync_events` + `payment-overdue` tag | 27 `payment.overdue` `sync_events` unprocessed, last 2026-06-03 |
| `/api/agent/voice/ghl` | `secretMatches` (constant-time) on `x-ghl-voice-secret` (`route.ts:38`). **The audit's claim of a non-constant-time `===` is stale on master** | `call_id` | `call_id` | leads, agent conversation, GHL tags and fields | `agent_conversations` = 0, `agent_messages` = 0 |

**GHL-side rate limiting:** none on any GHL route. **Dead-letter:** none.

### 1.3 Prod GHL tables (counts, 2026-09-21)

| Table | Rows | Latest | In repo migrations? |
|---|---:|---|---|
| `ghl_contacts` | 1,656 | synced 2026-09-21 22:05Z (M1 poller) | **No** (prod-only) |
| `ghl_webhook_events` | 0 | — | Yes (`20260825120000`, `20260909210330`) |
| `ghl_form_submissions` | 0 | — | No |
| `ghl_appointments` | 0 | — | No |
| `crm_sync_records` | 6 | 2026-06-03 | No |
| `sync_events` | 33 (27 unprocessed) | 2026-06-03 | No |
| `org_ghl_connections` | **does not exist** | — | `_staged/` only |
| M3 `ghl_connections`, `ghl_locations`, … | **do not exist** | — | branch only |

### 1.4 Hardcoded external IDs

| Literal | Where | Kind |
|---|---|---|
| Rentals location `Xcd8DZt5T4GWnBtBEC5V` | `scripts/ghl-voice-ai-provision.mjs:21` (fallback), `scripts/ghl-voice-ai-go.sh:25`; comments in `src/lib/ghl/org-location.ts:12` and `_staged/…org_ghl_connections_STAGED.sql:19` | Script fallback. `src/` runtime reads it from env only |
| UBER/LYFT pipeline `6HjUYeJhUaAyoit7lCSt` | `scripts/ghl-renter-pipeline-migrate.mjs:43` | script only |
| House org `8e651b25-…` | `src/lib/ops/va-task-outbox.ts` (`TMMT_RENTALS_ORG_ID`), and DB fn `promote_ghl_contact` (per the registry) | tenant literal |
| Custom-field keys `tmmt_case_ref`, `tmmt_track_url`, `tmmt_portal_url`, `tmmt_portal_login_url` | `sync-contact-portal-fields.ts:15-18` (env-overridable) | GHL field keys |
| Tags `payment-overdue`, `bella-*`, `vertical:<v>`, `tmmt-<canonical>`, revenue tags `member-97`, `kit-ordered-*`, `build-*-deposit`, `credit-*` | `overdue/route.ts:65`, `voice/ghl-voice-tags.ts`, `sync-outbound.ts:75`, `ghl-payment-sync.ts:12-80` | tag contracts, with no registry |
| GHL UI / checkout links | `src/lib/ghl-links.ts:5` (fallback `https://app.gohighlevel.com/`), `src/lib/ghl-offers.ts:86-126` (all `NEXT_PUBLIC_GHL_*` env) | env-driven; the fallback is generic |

---

## 2. Audit claims (a)–(d)

| Claim | Verdict | Evidence |
|---|---|---|
| **(a) Some GHL tags create payment records** | **VERIFIED (code), never exercised on prod** | `shouldRecordPayment` returns true for any tag in `REVENUE_TAGS`, or for any event containing `payment`/`invoice`/`subscription`/`order` (`src/lib/ghl-payment-sync.ts:121-130,149-153`). `recordGhlPayment` inserts `customer_payments` with **no org column** (`:254-268`). High-ticket tags insert a **second** "Pending" balance row (`:275-288`). A tag with no amount becomes "Pending"; any `amount` field makes it "Paid" (`:140-142,261`). The caller is `src/app/api/webhooks/ghl/route.ts:136-138`. A "Paid" row can then trigger a referral commission (`:173-185`) and a token grant (`:145-153`). **Prod:** `customer_payments` rows with `notes ILIKE '[GHL]%'` = **0**, so the path has never fired |
| **(b) Duplicate protection may be insufficient** | **VERIFIED** | 1. Payment dedupe is `notes ILIKE '%[ref:…]%'`, a racy read-then-insert, and it is **skipped entirely** when no transaction/order/payment id is present (`ghl-payment-sync.ts:201-211`). 2. The event id is consumed before processing, so a 500 followed by a retry gets 409 and the event is lost (`route.ts:65-68`, `ghl/http.ts:77-80`). 3. `deriveGhlEventId` prefers `body.id`, so a workflow payload whose `id` is the contact id dedupes every later event for that contact (`webhook-auth.ts:157-159`). 4. A GHL form with no submission id is a plain insert, and `GHL_FORM_AUTO_CASE` (default on) creates a case every time (`handlers/form.ts:123,136-137`). 5. `/api/leads/webhook`: `.maybeSingle()` on an already-duplicated phone+org returns an error, the error is ignored, `existing` is null, and **another row is inserted** (`src/app/api/leads/webhook/route.ts:112-116,137-155`). 6. The form path writes bare-digit `phone` with no `phone_e164` (`src/app/forms/actions.ts:111`), so the phone dedupe in `promote_ghl_contact` cannot see form leads. 7. `dealer-lead-sync.ts:62,66` uses the same `.maybeSingle()` pattern against the Command Center DB |
| **(c) Some outbound updates bypass do-not-contact checks** | **VERIFIED (code).** Whether that causes a customer message depends on GHL workflows: **UNKNOWN** | `assertOutboundAllowed` (`src/lib/outbound-gate.ts:62-111`) is called only by `twilio-send.ts:46`, `ghl/client.ts:299` (SMS branch of the orphaned sender), the SMS inbound reply (`agent/sms/inbound/route.ts:340`), the email gate and the VA outbox stager. **No DNC check** before: `addContactTag('payment-overdue')` (`overdue/route.ts:65`); `tmmt-<stage>` tag + opportunity stage move (`sync-outbound.ts:75-83`); voice tags and fields `bella-*` (`voice/ghl-voice-tags.ts:27-70`, `ghl-voice-handler.ts:150,172`); prequal tag (`aixmos-prequal-act.ts:99`); portal custom fields (`sync-contact-portal-fields.ts:68`). These tags exist to trigger GHL workflows (`TMMT_GHL_MASTER_AUDIT.md` §7). Also: `sendConversationMessage` **Email** skips the DNC/opt-out checks (`client.ts:293-306`). **DB side:** `on_new_lead` and `sweep_payment_due_notices` write `automation_outbox` with no DNC/opt-out reference in their bodies (prosrc scan), but the outbox has no drainer (§4) |
| **(d) A messaging function exists without being invoked** | **VERIFIED** | `sendConversationMessage` (`src/lib/ghl/client.ts:280`) has **0 non-test callers**. The outbox actions only stage (`src/app/(command)/command/outbox/actions.ts:37,59` → `stageVaTaskMessages`). The same holds for `sendSms` (`src/lib/agent/twilio-send.ts:39`, 0 callers) and `sendEmail` (`src/lib/email/send.ts:134`, 0 callers). Prod `agent_messages` = 0 |

---

## 3. Universal lead intake (master vs `TMMT_LEAD_INTAKE_REGISTRY.md` ids)

The registry was written against `49a31733`. On master `4cca6835`, the line numbers in `src/app/forms/actions.ts` have shifted (the registry's `:216` for business-line intake is now **`:286`**).

**Prod traffic (`incoming_leads` by source × month, since 2026-05):**

| Month | Rows by source |
|---|---|
| 2026-05 | ghl_form 25 · unknown 86 |
| 2026-07 | conversation 23 · form 38 · ghl_backfill 1 · other 29 |
| 2026-08 | conversation 7 · other 3 · unknown 1 |
| 2026-09 | conversation 5 · direct 9 · integration-test 1 · other 2 |

**Other tables:**
- `incoming_leads`: total 892, last 2026-09-18.
- `form_submissions`: 4, last 2026-09-17.
- `customer_intake_forms`: 5, last 2026-05-21; 0 in the last 90 days.
- `cases`: 4.
- `partner_acquisition`: 0.
- `partner-optin` leads: 0.

| intake_id | Master entry (file:line) | Status | Traffic | Flags |
|---|---|---|---|---|
| `ghl-contacts-poller` → `ghl-contact-promote` | off-repo M1 launchd → trigger `trg_promote_ghl_contact` | EXISTING/WORKING (off-repo) | **LIVE**: 1,656 contacts, synced today | Not in the repo. `promote_ghl_contact` swallows errors (`EXCEPTION WHEN OTHERS` in its body) |
| `web-lead-intake` | `forms/actions.ts:103` | EXISTING/WORKING | **LIVE** (`direct` 9 in Sep; `form_submissions` last 09-17) | No `phone_e164`; people link fire-and-forget (`:66-74`) |
| `web-program-intake` | `actions.ts:854` | EXISTING/PARTIAL | 0 | Client `lane` steers classification |
| `web-dealer-apply` | `actions.ts:150` | EXISTING/PARTIAL | 0 | Un-awaited `fanOut` (`:194`) |
| **(new, unregistered)** `web-partner-apply` | `actions.ts:226` → `partner_acquisition` | EXISTING/PARTIAL | 0 | **Not in the registry.** Needs an id |
| `web-business-line-intake` | `actions.ts:286` → `lib/intake/unified.ts` | EXISTING/PARTIAL, **UNSAFE** | 0 | Service-role writer behind an in-memory limiter only (`middleware.ts:214-217`); writes the missing `activity_logs` table; every business line goes to the Rentals GHL |
| `web-intake-hub` | `src/app/intake/actions.ts` | EXISTING/PARTIAL | 0 in the last 90 days | Durable limiter; action not session-gated (per registry) |
| `web-customer-intake` | `workflow-actions.ts` → RPC `submit_customer_intake` | EXISTING/PARTIAL, UNSAFE | 0 in the last 90 days | anon RPC, no limiter |
| `web-waitlist` / `web-background-check` / `web-ticket` / `web-appointment` | `actions.ts:440 / 366 / 498 / 332` | EXISTING/PARTIAL | imported history only | `customer_services` insert error only logged (`:437`) |
| `web-credit-funding` | `actions.ts:732` | EXISTING/PARTIAL | trace (1) | un-awaited `fanOut` (`:832`) |
| `web-vehicle-ops-forms` | `actions.ts:529 / 563 / 608` | EXISTING/PARTIAL, UNSAFE (staff forms public) | ~0 | — |
| `partner-optin` | `partners/all-in-one/actions.ts:33` | EXISTING/PARTIAL, UNSAFE (no limiter) | 0 | — |
| `api-forms-submit` | `api/forms/submit/route.ts` | ORPHANED (its only caller is retired) | 0 | durable limiter |
| `lp-leads-webhook` | `api/leads/webhook/route.ts:66` | EXISTING/PARTIAL, UNSAFE | 1 test | Anonymous overwrite of an existing lead (`:121-136`); `.maybeSingle()` dup bug; `ins.data!` crashes on insert error (`:155`) |
| `edge-intake` | `supabase/functions/intake/index.ts` (deployed v7, `verify_jwt=false`) | EXISTING, UNSAFE (CRITICAL per registry) | no app caller | caller-chosen tenant |
| `edge-capture-drive` | deployed only (v4); **not in the repo** | ORPHANED / unreproducible | 0 | — |
| `postgrest-anon-direct` | anon insert policies + RPC | EXISTING, UNSAFE | indistinguishable | — |
| `ghl-webhook-contact / form / stage / program / legacy-tag` | `webhooks/ghl/*` | EXISTING/BROKEN in practice (never received; `ghl_webhook_events` = 0) | 0 | see §2(b) |
| `ghl-voice` | `api/agent/voice/ghl/route.ts` | EXISTING/PARTIAL | 0 | Tenant and location both taken from the payload |
| `ghl-intake-lead-fn`, `ghl-verification-form-fn` | DB RPCs (prod-only) | ORPHANED (caller unknown) | 0 | — |
| `twilio-sms-inbound` | `api/agent/sms/inbound/route.ts:95` | EXISTING/BROKEN (config): **0 of 9 orgs** have `twilio_inbound_number` | 0 | Code is correct, fails closed |
| `airtable-verified-webhook` | `api/webhooks/airtable/route.ts` (+ `/locations`) | LEGACY | dead | Can still call `applyVerifiedSync` → GHL stage push (`:135`) |
| `staff-desk-upsert`, `offline-merge` | admin actions, `api/offline/merge` | EXISTING/WORKING (staff) | indistinguishable | client `org_id` accepted |
| `script-sync-airtable` | `scripts/sync-airtable.mjs` | LEGACY, DANGEROUS (delete-all) | dead (PAT dead) | quarantine |
| `unattributed-bulk-writers` | off-repo | LEGACY | historical | — |

**Counts (27 surfaces):**

| Group | Count | Surfaces |
|---|---:|---|
| Real, carrying traffic | **2** | poller→promote, web-lead-intake |
| Real, no traffic | 15 | — |
| Obsolete / legacy / orphaned | 7 | api-forms-submit, capture-drive, 2 GHL RPCs, airtable webhook, sync-airtable script, bulk writers |
| Broken by config | 1 | Twilio |

**Unsafe public writers** (service-role or anon writes without a durable limiter, or with a caller-chosen tenant): **8**. They are web-business-line-intake, web-customer-intake, web-vehicle-ops-forms, partner-optin, lp-leads-webhook (overwrite), edge-intake, capture-drive, and postgrest-anon-direct.

---

## 4. Communications: what actually sends today

| Channel | Send code | Reachable? | Configured? | Prod evidence of sends | Verdict |
|---|---|---|---|---|---|
| **Owner/staff Slack + Telegram + iMessage fan-out** | `src/lib/notify.ts:14-111` (`fanOut`) from `forms/actions.ts:194,264,832`; `agent/handoff.ts:42-76` from the voice handoff | Yes (dealer, partner-apply and credit-funding forms; voice handoff) | env-gated (`SLACK_WEBHOOK_URL`, `TELEGRAM_*`, `IMESSAGE_RELAY_*`), values UNKNOWN | none recorded (fire-and-forget, no log table) | EXISTING/PARTIAL: internal only, **un-awaited in server actions** |
| **Telegram mission / dispatch** | `lib/mission/send.ts` via `api/mission/generate` (CRON_SECRET); `notify-telegram.ts` via `(command)/dispatch/actions.ts` | mission: no Vercel cron entry; its external caller is UNKNOWN. Dispatch: staff action | env | none in DB | EXISTING/PARTIAL (internal) |
| **Twilio SMS reply (TwiML)** | `api/agent/sms/inbound/route.ts` (gated `:340`) | Yes | **0 of 9 orgs have a number** | `agent_messages` = 0 | EXISTING/BROKEN (config) |
| **Twilio outbound `sendSms`** | `agent/twilio-send.ts:39` (gated `:46`) | **0 callers** | — | 0 | ORPHANED |
| **GHL Conversations `sendConversationMessage`** | `ghl/client.ts:280` | **0 callers** | — | 0 | ORPHANED |
| **Email `sendEmail`** | `email/send.ts:134`; gate + `EMAIL_LIVE=1` + `ownerApproved`; otherwise appends a local `.outbox/email-outbox.jsonl` | **0 callers** | — | 0 | ORPHANED (and the filesystem outbox is unusable on Vercel) |
| **GHL tag-triggered workflows** | `addContactTag` calls in §1.1 | Yes | GHL workflows listening: UNKNOWN | no tag events recorded; overdue producer archived | UNKNOWN (indirect send, **ungated**) |
| **`automation_outbox`** | DB `on_new_lead`, `sweep_payment_due_notices`; app stager `ops/va-task-outbox.ts` (never sends) | writes yes | **no drainer**: n8n container `tmmt-n8n` is UNKNOWN/empty per `AUTOSTART_REGISTRY.md:204` | **35 rows, all `notify-new-lead`/email/`queued`, `sent_at` never set** (2026-08-29 → 09-18) | PLACEHOLDER (queue with no consumer) |
| **In-app client alerts** | `client-rental/sync-alerts.ts:5` from the GHL stage handler | only through the stage webhook (never fired) | — | `client_alerts` = 0 | EXISTING/PARTIAL, unused |
| **AI agent SMS/voice (`agent_messages`)** | agent state machine | — | — | `agent_messages` = 0, `agent_conversations` = 0 | never ran |

**Answer:** today **no customer-facing message is sent by TMMT code.** The only sends that can happen are internal owner/staff notifications (Slack, Telegram, iMessage relay). Everything customer-bound is ORPHANED, blocked by config, or queued with no drainer. Whether GHL workflows fire on TMMT-applied tags is UNKNOWN.

**DNC enforcement points:**
- `outbound-gate.ts:81-91`: `do_not_contact_numbers` (78 rows), fails closed on a read error.
- Per-lead `opted_out`: `incoming_leads.opted_out = true` on **0** rows.
- `promote_ghl_contact`: checks DNC and opt-out (prosrc).
- `generate_va_tasks_v2`: checks DNC and opt-out.
- The email gate.
- **GHL per-channel DND:** not read anywhere in `src/` (MISSING). The memory notes 166 SMS-DND contacts against only 7 of 41 STOPs in the TMMT DNC.

---

## 5. Automations

| Automation | Schedule / trigger | Evidence of running | Class |
|---|---|---|---|
| **pg_cron** `agent-wp-reap` | every minute | 10,080 ok / 7 d | ACTIVE |
| `leadnet-sla-sweep` | */15 | 672 ok | ACTIVE |
| `rebalance_all_orgs` | */30 | 336 ok | ACTIVE |
| `aixmos_daily_va_sweep` (`generate_va_tasks_v2`) | 12:00 | 7 ok | ACTIVE (fills `exec_va_tasks`; nothing sends) |
| `aixmos_daily_va_classify` | 12:15 | 7 ok | ACTIVE |
| `aixmos_daily_edge_brief` | 12:20 | 7 ok | ACTIVE |
| `aixmos_nightly_journey_recompute` | 04:30 | 7 ok | ACTIVE. **Duplicates** the Vercel cron `journey-recompute` at 04:00 |
| `leadnet-daily-digest` | 13:00 | 7 ok | ACTIVE |
| `sweep-overdue-payments` | 13:00 | 7 ok | ACTIVE |
| `sweep-payment-due-notices` | 13:05 | 7 ok | ACTIVE (writes the outbox, no DNC reference, no drainer) |
| **Vercel cron** `/api/cron/journey-recompute` | `0 4 * * *` | not verifiable (no log read) | UNKNOWN; duplicate of the pg_cron job |
| **Vercel cron** `/api/cron/marketing-kpi-ghl` | Mon 13:00 | `marketing_kpi_weeks` = **1 row, last 2026-05-20** → it has not written for about 17 weekly runs | EXISTING/BROKEN (or CRON_SECRET unset → 401): UNKNOWN which |
| **DB triggers on `incoming_leads`** | on insert | `trg_aa_validate_lead`, `trg_ab_affiliate_attrib`, `trg_auto_assign_lead`, `capture_lead_intake_trg`, `on_new_lead_trg`, `trg_leadnet_start_clock`, `lead_to_active_customer_trg`, `incoming_leads_set_updated_at`. `intake_events` = 908 | ACTIVE (8) |
| **Triggers on `intake_events`** | on insert | `auto_route_intake_trg`, `agent_enqueue_intake_events` | ACTIVE |
| **Trigger on `ghl_contacts`** | on insert | `trg_promote_ghl_contact` (+ `ghl_contacts_updated`) | ACTIVE (the one live lead feed) |
| **Triggers on `cases`** | on status change | **two** triggers (`cases_status_history`, `cases_status_history_trg`) both call `log_case_status_change`, which is **double history** (12 history rows for 4 cases) | ACTIVE, DUPLICATE |
| **Edge functions (deployed 7; repo 1)** | — | In repo: `intake` (v7, `verify_jwt=false`). **Not in repo:** `handoff-slack-notify` (v6, no JWT), `operator-checkin` (v4, no JWT), `operator-provision` (v4, no JWT), `blast-operators` (v9, JWT), `capture-drive` (v4, no JWT), `provision-on-payment` (v4, no JWT) | UNKNOWN activity; 6 of 7 cannot be rebuilt from the repo |
| **`agent_jobs` / `agent_definitions`** | trigger `agent_enqueue` + pull worker | 3 definitions; 32 jobs: 24 skipped (last 08-26), 7 done + 1 failed (last 09-16) | DORMANT (last activity 09-16) |
| **n8n** (`tmmt-n8n` Docker, BRAINIAC) | — | no drainer; outbox 35 queued / 0 sent | ABANDONED / UNKNOWN (`AUTOSTART_REGISTRY.md:204`) |
| **M1 launchd `com.tmmt.ghl-supabase-sync`** | 6 h | prod `ghl_contacts.synced_at` = today | ACTIVE, off-repo (`GHL_EXISTING_SYNC_JOB.md`) |
| **M1 ~20-min reader** of `customer_payments` / DNC | launchd `com.tmmt.rick-attention-watch` (probable) | per `GHL_EXISTING_SYNC_JOB.md` | UNKNOWN |
| **Windows tasks touching TMMT** | per `AUTOSTART_REGISTRY.md` | `TMMT-Watchdog` (restarts the **retired** tmmt-os on :3000); `TMMT-Autopilot-Morning`/`EOD`; `TMMT-Morning-Brief`; `TMMT-Brainiac-Obey`; `TMMT-COMPILE-CHATS`. `TMMT-Assistant` (customer auto-respond `-Live`) is **Disabled, target missing** | ACTIVE: ops/brief only, none sends to customers |
| **GHL workflows** | GHL-side | none in code or DB; tags are the only coupling | UNKNOWN |

**Active automation count:** 10 pg_cron jobs + 13 DB triggers on lead/intake/ghl/cases tables + 1 off-repo M1 sync + 1 Vercel cron with a live twin (journey) = **~25 active**. Broken or dormant: 1 Vercel cron (KPI), agent_jobs, n8n, and the outbox drain.

---

## 6. Failure states (the UI or the caller sees success when the action failed)

| # | Where | Mechanism | Effect |
|---|---|---|---|
| F1 | `src/app/api/webhooks/ghl/overdue/route.ts:63-77` | `addContactTag` **returns silently** when GHL is not configured (`client.ts:159`), so `ghlTagApplied = true` and the response says "Tagged payment-overdue in GHL." | False success. The `sync_events` insert result is also unchecked (`:55-61`) |
| F2 | `src/lib/ghl/client.ts:310-311` | `sendConversationMessage` runs the gate, then `return`s with no error when the key or location is missing | A future caller would record "sent" |
| F3 | `src/app/api/webhooks/ghl/route.ts:65` and `ghl/http.ts:77` | Event id consumed before handling; a handler 500 means the retry gets 409 | Event permanently lost |
| F4 | `src/lib/intake/unified.ts:106-117, 120-134` | `sync_events` insert unchecked. `activity_logs` insert wrapped in `try/catch`, but supabase-js **returns** errors rather than throwing, and **the table does not exist on prod** | Every intake silently drops its audit row |
| F5 | `src/lib/intake/unified.ts:146`; `handlers/opportunity-stage.ts:171,188`; `crm-sync/apply-verified.ts:107` | `void syncContactPortalFields(...)`, `.catch(() => undefined)` on client alerts, `void pushCanonicalStageToGhl(...)` | GHL portal fields / stage push / client alerts fail with only a console line (or nothing). Serverless can freeze before completion |
| F6 | `src/app/forms/actions.ts:66-74, 194-198, 264-268, 832-834`; `:304-312` | `linkFormToPerson` and owner `fanOut` are **not awaited** in server actions | People link / owner alert can be dropped after the success response (registry: 5 of 9 people links lost) |
| F7 | `src/app/forms/actions.ts:437` | `customer_services` insert error logged only; the waitlist still returns success | Service opt-ins silently lost |
| F8 | `src/app/api/leads/webhook/route.ts:112-116, 121-136, 155` | `.maybeSingle()` error ignored, so a duplicate is inserted; the update result is unchecked; `ins.data!.id` throws 500 on an insert error | Duplicates breed; an anonymous overwrite gets no error surfaced |
| F9 | `src/lib/ghl/handlers/opportunity-stage.ts:69-75, 222-234` and `form.ts:97-103` | `upsertGhlContact` result unchecked, and it writes `location_id: null`, `tags: []` when they are absent | Silently wipes mirror data |
| F10 | `src/lib/ghl/sync-event.ts:29, 38-44` | `logSyncEvent` returns `undefined` on error; `markSyncEventProcessed` result unchecked | No trace of failed events |
| F11 | `src/app/api/webhooks/ghl/route.ts:219, 240` | Notes `update` results unchecked; response `ok:true, updated:…` | False success |
| F12 | `src/lib/ghl-payment-sync.ts:277-287` | Balance "Pending" row insert result unchecked | Ledger missing contract balance |
| F13 | `src/app/api/webhooks/ghl/route.ts:117` | `programRes.json()` with no try: a non-JSON 5xx from the sub-route throws, giving a 500 after the event id was consumed | Lost event (F3) |
| F14 | DB `promote_ghl_contact` (`EXCEPTION WHEN OTHERS`) and `recompute_all_journeys` | Swallowed exceptions | A GHL contact that fails promotion never becomes a lead, with no error row |
| F15 | M1 poller | 5,000-contact cap, silent truncation; no prod trace or alert (`GHL_EXISTING_SYNC_JOB.md`) | The single live feed can stop unnoticed |
| F16 | `automation_outbox` | 35 `queued` since 08-29, no consumer | Looks like notifications are "queued"; nothing ever leaves |

**Historical, fixed on master:** `insertRow` used to fail every anonymous submission on RETURNING while the visitor saw success. It now retries without RETURNING on `42501` (`forms/actions.ts:52-59`).

---

## 7. Do-not-duplicate note

M3/M4 (`C:\dev\wt-ghl-m3m4`, `C:\dev\wt-ghl-m4app`) already covers the connection registry, discovery, ownership, the routing matrix and the anonymous-tenant audit. This file only records master's current state against that target. None of the items above should be fixed on master in a way that competes with M5/M6. That applies especially to contact sync, per-org location and webhook contract work.
