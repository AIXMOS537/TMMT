# 09 — GHL (GoHighLevel): current vs M0–M13 target

Source: SPEC §14, §15, §21 (+ E4 §0–§2, §7; E6 Task 3) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "Current implementation", "Every current violation" and "Hazards" (master; all violations latent because no verified GHL webhook has ever arrived). **IN-FLIGHT / TARGET** = the M0–M13 table (branches `feat/ghl-router-m*`, none merged, none applied to prod). "What this lane may do" is PM-00 containment on the current code only.

> **The GHL router track (M0–M13) owns the target.** Do not propose or write schema or code for the connection registry (M3), discovery (M4), identity linking (M5), the webhook inbox (M6), routing — the M7 deterministic engine + dry-run simulator (zero GHL writes; **shadow mode and live routing are later steps, not M7**) — the intake contract or outbox design (M8), the isolation matrix (M9) or the admin UI (M12). Those compete with M3–M13. Contain hazards in the current code only (PM-00), and have the GHL track review any change to GHL webhook files. Every M-row below is CODE ON ACTIVE DEV BRANCH or DESIGN ONLY, **as observed by E6 on 2026-09-21** (M3 dev-only and not applied; M4 dev CLI; M5/M6 design; M7–M13 planned). **The GHL track's latest integrated milestone report supersedes this table**: the owner's orchestration prompt (2026-09-22) reports M0–M4, M5 identity and M6 webhook reliability progressed on the track's branches and M7 separately authorized; this pack did not re-verify those branches, and none of it is usable from master or applied to prod. **Outbound GHL writes are frozen** (no contact/opportunity/stage/tag/workflow/message/calendar mutation) until the owner explicitly authorizes them; PM-00's guards only *stop* writes, they never add any.

## Current implementation (master `4cca6835`)

| Aspect | Reality |
|---|---|
| Credential | One global env bearer `GHL_API_KEY` (`src/lib/ghl/client.ts:38-44`). No OAuth, no per-org credential |
| Location | Env `GHL_LOCATION_ID` (Rentals). `GHL_RESTORATION_LOCATION_ID` falls back to Rentals (`client.ts:18-27`). Every live outbound call resolves `locationOr()` → env |
| Stages | `GHL_PIPELINE_STAGE_MAP_JSON` ships empty → **every stage maps to `inquiry`** (KD-21). Stages resolved by name at call time |
| Not modelled | workflows, calendars, users, custom fields, tags (tags are the only coupling to GHL workflows) |
| Per-org resolver | `src/lib/ghl/org-location.ts` ORPHANED (its table `org_ghl_connections` is `_staged/` only) |
| Live data path | **Off-repo** M1 launchd poller (6 h) → `ghl_contacts` → `promote_ghl_contact` → `incoming_leads` |
| Inbound webhooks | `/api/webhooks/ghl` + `/contact`, `/form`, `/appointment`, `/program`, `/overdue`; `/api/agent/voice/ghl`. HMAC/shared secret, fails closed. **Never received a verified event** (`ghl_webhook_events` = 0) |
| Outbound | contact search, custom-field update, tag add, opportunity stage move. `sendConversationMessage` (`client.ts:280`) has 0 callers |
| Hard-coded IDs | house org `8e651b25-…` in `src/lib/ops/va-task-outbox.ts` and DB `promote_ghl_contact`. The Rentals location and UBER/LYFT pipeline IDs appear only in scripts. `src/` reads locations from env only. **Never add a hard-coded GHL ID** |

## Target (GHL track, not yours)

| M | Name | Position 2026-09-21 |
|---|---|---|
| M0 | Honest baseline | branch |
| M1 | Close tenant holes | branch; prod migration `20260921130000_m1_intake_tenant_trust.sql` NOT applied |
| M2 | Codify what prod runs | branch |
| M3 | Connection registry (`ghl_connections`, `ghl_locations`, Vault credential ref) | dev only |
| M4 | Discovery sync (read-only, 7 allow-listed GETs) | dev CLI |
| M5 | Identity links | design |
| M6 | Webhook inbox (fixes event loss) | design |
| M7 | Router core + simulator (dry-run) | planned |
| M8 | Universal intake + outbox (not live) | planned |
| M9 | Tenant isolation matrix in CI (**release blocker**) | planned |
| M10 | First live intake `web-lead-intake` → Rentals | owner go-live gate |
| M11 | Migrate the rest | planned |
| M12 | Admin UI | planned |
| M13 | AIXMOS on top (read tools + confirm-gated action tools via `LeadRoutingService` / `GhlGateway`) | planned |

Goal: **N orgs, N connections, N locations, N intake forms.** A NULL location means UNKNOWN, never the env default. Release blockers B-1…B-8 gate production activation.

## System-of-record rules

- **GHL never sets business state** [SoR §5.2]. GHL = conversations + marketing attribution. GHL may raise an event; a person or a Supabase rule decides.
- Customer conversations stay in GHL; TMMT stores pointers only.
- Consent: `do_not_contact_numbers` fails closed. GHL per-channel DND is **not read anywhere** (MISSING). Memory notes 166 SMS-DND contacts in GHL vs 7 of 41 STOPs in the TMMT DNC.

## Every current violation (all latent: none has fired on prod)

| # | Path | Evidence |
|---|---|---|
| V1 | GHL stage → `crm_sync_records.canonical_stage` → `runGhlStageAutoOps` → `applyVerifiedSync(verifiedBy:"ghl_auto_ops")` marks the sync verified and creates/advances `cases`. Default ON (`isGhlAutoOpsEnabled()` = `GHL_AUTO_OPS !== "false"`, `src/lib/ops-command/stage-rules.ts:95-96`) | E3 §6 |
| V2 | A revenue tag or payment-sounding event → `customer_payments` Paid/Pending, with no org column (`shouldRecordPayment` `ghl-payment-sync.ts:149-153`; insert `:254-268`; "Paid" `:261`; caller `api/webhooks/ghl/route.ts:136-137`). **CODE CAPABILITY on master; PRODUCTION OBSERVATION: 0 GHL-sourced rows, never fired** | E4 §2(a) |
| V2b | Token grant (`route.ts:145-153`) and referral commission (`route.ts:173-185`) fire from the GHL claim | E4 §2(a) |
| V3 | GHL stages map to `booked`, `payment_pending`, `active_renter`, `extended`, `return_due`, `returned`, `escalation`, states with no TMMT writer | E3 §2 |
| V4 | GHL form webhook with `GHL_FORM_AUTO_CASE` (default on, `handlers/form.ts:135-137`) creates a `cases` row every time. The env switch alone does not contain it: a payload `create_case: true` overrides `GHL_FORM_AUTO_CASE=false` (SI-04; precedence fix in TMMT-SEC-007) | E4 §2(b) |
| V5 | `/ghl/program` → `program_applications` (borderline; decided in GHL M7) | E4 §1.2 |
| V6 | Two overdue truths: `/api/webhooks/ghl/overdue` tag + pg_cron date sweep | E3 §3.2 |
| V7 | The legacy Airtable verified webhook re-enters V1 (`api/webhooks/airtable/route.ts:135`) | E4 §3 |
| V8 | `upsertGhlContact` writes `location_id: null`, `tags: []` (mirror wipe) | E4 §6 F9 |

## Hazards (for anyone touching GHL files)

- **Event id consumed before processing** (`route.ts:65`, `ghl/http.ts:77`): a 500 → retry 409 → event lost (FS-03). Durable fix = GHL M6.
- `deriveGhlEventId` prefers `body.id`, so a contact-id payload dedupes every later event for that contact.
- Payment dedupe is `notes ILIKE '%[ref:…]%'`, and it is skipped when there is no id (KD-19).
- **DNC bypass** (KD-13): no `assertOutboundAllowed` before `addContactTag('payment-overdue')` (`overdue/route.ts:65`), `tmmt-<stage>` tag + stage move (`sync-outbound.ts:74-83`), voice tags/fields (`voice/ghl-voice-tags.ts:27-70`, `ghl-voice-handler.ts:150,172`), prequal tag (`aixmos-prequal-act.ts:99`), portal custom fields (`sync-contact-portal-fields.ts:68`). The `sendConversationMessage` **Email** branch skips DNC (`client.ts:293-306`). These tags exist to trigger GHL workflows.
- `addContactTag` returns silently when GHL is unconfigured (`client.ts:159`) → the overdue route reports "Tagged" (FS-01). `sendConversationMessage` returns without error when the key/location is missing (FS-02).

## What this lane may do (PM-00 containment only)

- Owner sets `GHL_AUTO_OPS=false` and `GHL_FORM_AUTO_CASE=false` (Vercel env + baton).
- Code guard: never "Paid" from GHL; no commission or token grant from GHL claims.
- Code guard: DNC/opt-out check before outbound GHL tag/field/stage writes and the email branch.
- Each is a small guard the GHL track can absorb into M6/M8. Coordinate with the GHL owner before opening the PR.
