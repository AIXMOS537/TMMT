# TMMT-COMM-002

## TASK ID
TMMT-COMM-002

## TITLE
Consent at send time: one `assertSendAllowed` check in the drainer covering TMMT DNC, per-lead opt-out, GHL per-channel DND (when TMMT-COMM-005 provides it) and the owner hold — with the consent regression test SoR §5.6 requires

## PM MILESTONE
PM-18 Communications gateway (roadmap new-build items: "The consent regression test required by SoR §5.6"; exit "A DNC, opt-out or DND contact is never sent to (CI test)")

## OBJECTIVE
No customer message leaves TMMT unless, **at the moment of sending**, the recipient is not on the DNC list, has not opted out, is not DND on that channel in GHL, and the message carries the owner approval its policy requires. The check fails closed.

## WHY (evidence refs)
- SPEC §1 (principle: "The opt-out gate fails closed [SoR §5.6]"), §16 (target gateway step 2: "checked against TMMT DNC + opt-out + GHL per-channel DND at send time"), §21.1 (Consent: "enforced on SMS/email/stager only; GHL DND unread — gaps"), §25.2 (Comms gate), §31.1; ROADMAP PM-18; E4 §4 (DNC enforcement points: `outbound-gate.ts:81-91` `do_not_contact_numbers` 78 rows fails closed; `incoming_leads.opted_out` true on 0 rows; `promote_ghl_contact` and `generate_va_tasks_v2` check DNC; GHL DND not read anywhere).
- Memory note (SPEC §16): 166 SMS-DND contacts in GHL vs 7 of 41 STOPs in the TMMT DNC — the TMMT list alone is not enough.

## CURRENT BEHAVIOR (file:line)
- `src/lib/outbound-gate.ts:62-111` `assertOutboundAllowed({ phone, organizationId, vertical, type, ownerApproved, db })`: reads `do_not_contact_numbers`, per-lead opt-out, and (for marketing) requires `ownerApproved`; throws `SmsBlockedError`; fails closed on read errors; needs a phone.
- Callers: `twilio-send.ts:46`, `ghl/client.ts:299` (SMS branch only), `agent/sms/inbound/route.ts:340`, the email gate (`src/lib/email/outbound-email-gate.ts`, reads ghost `do_not_contact_emails`), the VA stager (`va-task-outbox.ts`) at **stage** time.
- Owner hold: `src/lib/agent/auto-reply-policy.ts:28-39` (`B3_AUTO_REPLY_ORGS`; drafts held by default) — SMS agent only.
- Existing tests: `record-opt-out.test.ts`, SMS gate tests (E1 §5).

## EXPECTED BEHAVIOR
- NEW `src/lib/comms/send-gate.ts` `assertSendAllowed(row, deps)`: resolves recipient (phone for SMS/voice; email for email), calls `assertOutboundAllowed` (unchanged), then checks: (1) GHL per-channel DND via the read helper from TMMT-COMM-005 (`unknown` → **blocked** until the helper exists or when it errors); (2) owner hold: rows whose `kind`/policy requires approval must carry the approval mark (reuse the stager's `ownerApproved` semantics; extend the policy table in code, not the DB); (3) channel-specific: email is blocked while `do_not_contact_emails` is absent in prod (fail closed); (4) org resolved from the row, never from the payload.
- The drainer (TMMT-COMM-001) calls it per row **immediately before** the sender; the result (`allowed`/`blocked:<reason>`) is written back.
- **Consent regression test** `src/lib/comms/consent-regression.test.ts`: a fixture set of recipients (DNC, opted-out, GHL SMS-DND, GHL email-DND, clear, unknown-phone, DB-error) × channels (sms, email, ghl-conversation) × modes (dry, live) asserting: every non-clear case is blocked in every mode; the clear case is sent only in live mode; a read error blocks. This is the CI test SoR §5.6 asks for.
- A static guard: no file under `src/lib/comms/` or `src/app/api/cron/outbox-drain/` calls `sendSms`, `sendConversationMessage` or `sendEmail` except `senders.ts`, and `senders.ts` is called only by the drainer after `assertSendAllowed` (import-graph check).

## FILES (in scope)
- NEW `src/lib/comms/send-gate.ts` (+ `send-gate.test.ts`), NEW `src/lib/comms/consent-regression.test.ts`, NEW `src/lib/guards/senders-only-via-gate.test.ts`
- `src/lib/comms/drainer.ts` (wire the gate)

## DATABASE ENTITIES
Read-only: `do_not_contact_numbers`, `incoming_leads.opted_out`, `automation_outbox`; GHL DND via TMMT-COMM-005 (read). No schema change.

## DEPENDENCIES
- **TMMT-COMM-001** (drainer). **TMMT-COMM-005** (GHL DND helper) — until it lands, DND = `unknown` = blocked for GHL-sourced contacts; the PR states the effect (nothing can send to GHL contacts until COMM-005).
- TMMT-SEC-003 (DNC on GHL writes) uses the same `assertOutboundAllowed`; keep one semantics.
- G-02 (#243) audience separation: internal notifications (Slack/Telegram to staff) are **not** subject to customer consent; the gate must distinguish by the row's audience field, per G-02.

## CONSTRAINTS
- Do not change `assertOutboundAllowed`.
- No GHL API call here (COMM-005 owns it).
- No customer send in this PR (mode stays `dry`).

## SECURITY REQUIREMENTS
- Fail closed on: missing recipient, DB error, DND unknown, missing approval.
- Recipient values never logged; log row id + reason code.
- Tests include a hostile case: a row whose payload claims `ownerApproved: true` but whose DB row lacks the approval → blocked (approval is read from the row the stager wrote, not from the message body).

## IMPLEMENTATION NOTES
- Reason codes: `dnc`, `opted_out`, `ghl_dnd_sms`, `ghl_dnd_email`, `dnd_unknown`, `no_recipient`, `approval_required`, `read_error`, `email_dnc_absent`.
- Keep the policy table (which kinds need approval) in one exported constant with a test.

## ACCEPTANCE CRITERIA (testable)
1. Consent regression matrix passes; removing any single check makes at least one cell fail (documented).
2. GHL DND `unknown` blocks; DB error blocks; missing approval blocks.
3. Static guard proves senders are reachable only through the gate.
4. Internal-audience rows bypass customer consent but still require the internal channel config (G-02 alignment).
5. Full gate passes.

## TESTS (must fail on the pre-fix code)
- `consent-regression.test.ts`: the matrix (pre-fix there is no gate; the drainer test from COMM-001 is extended so a DNC row that was `blocked` by the interim check now shows the reason code).
- `send-gate.test.ts`: per reason code; `payload approval claim ignored`.
- `senders-only-via-gate.test.ts`: import-graph (fails on a synthetic direct caller).

## DO NOT CHANGE
- `outbound-gate.ts`; `auto-reply-policy.ts`; `record-opt-out.ts`; SMS inbound route; prod.

## OWNER GATE
None for the code (mode stays `dry`). Live switch-on: owner + baton (TMMT-COMM-001).
