# TMMT-COMM-006

## TASK ID
TMMT-COMM-006

## TITLE
Rental and payment message types (payment due, agreement ready, handoff, return reminder) with mercy-rule copy, plus delivery-status write-back and an `/command/outbox` approval queue

## PM MILESTONE
PM-18 Communications gateway (roadmap new-build items: "Delivery status write-back"; "Rental/payment message types … Collections copy must follow the mercy rules")

## OBJECTIVE
The gateway can carry the messages the rental journey needs, each staged as an outbox row with a template id and variables, approved where policy requires, and written back with its delivery result.

## WHY (evidence refs)
- SPEC §7 (J4–J10 "Notification: gated …" rows), §16 (target steps 3 and 5), §22.3 #7–#8 (money/state never shown as done unless verified; plain words; collections follow mercy), §23.3 (Comms outbox = the approval queue), §26 (Outbox: delivery status), §31.1; ROADMAP PM-18, PM-09 (reminders via PM-18); E2 §1.3 (`/command/outbox` PARTIAL + ORPHANED: stages `exec_va_tasks` into `automation_outbox`, not linked); E4 §4 (35 rows are `notify-new-lead`/email; `client_alerts` 0 rows).

## CURRENT BEHAVIOR (file:line)
- `automation_outbox` kinds today: `notify-new-lead` (email) from the trigger, payment-due SMS from the sweep, VA task messages from the stager (`src/lib/ops/va-task-outbox.ts`; `(command)/command/outbox/{actions.ts:37,59,page.tsx}`).
- No template registry; bodies are composed inline in SQL/TS.
- No delivery status columns beyond `sent_at` (confirm in the snapshot).
- `client_alerts` (in-app, 0 rows) written only from the GHL stage handler (`client-rental/sync-alerts.ts:5`).

## EXPECTED BEHAVIOR
- NEW `src/lib/comms/templates/` with a typed registry: `payment_due`, `agreement_ready`, `handoff_ready`, `return_reminder` (and `hold_expiring` if PM-05 wants it): each has channel(s), required variables, approval policy (`owner`/`staff`/`none`), and copy in plain words; **no** interest language, no late-fee-as-penalty language, no score/financing claims; collections copy states the grace/hardship path (⚖️ owner + counsel review of the wording before live).
- NEW `src/lib/comms/stage.ts` `stageMessage({ templateId, orgId, recipientRef, vars, requestedBy })` → one `automation_outbox` row with `template_id`, `vars` (JSON, no PII beyond what the template needs), `audience='customer'`, approval state per policy. It reuses the stager's DNC pre-check (fails closed) — the send-time gate still runs later.
- Delivery write-back columns (staged migration, only if absent): `delivery_status`, `provider_message_id`, `delivered_at`, `failed_at`, `last_error_class`; a webhook/status hook is out of scope unless a provider path already exists (Twilio status callback route does not exist; record as follow-up).
- `/command/outbox` becomes the approval queue: lists `awaiting_approval` rows by template, lets the owner approve/reject (server action, owner-only, writes the approval mark the gate reads), shows delivery status; linked from the owner hub (TMMT-AUTH-003 R6). Token kit; four states; no `alert()`.
- Producers wire-up for the rental journey happens in PM-09/PM-08/PM-13 (they call `stageMessage`); this task ships the registry, the stager, the queue and the write-back.

## FILES (in scope)
- NEW `src/lib/comms/templates/*.ts` (+ tests incl. a banned-claims/interest-word lint test), NEW `src/lib/comms/stage.ts` (+ test)
- `src/app/(command)/command/outbox/{page.tsx,actions.ts}` (+ tests), `src/lib/command-hub-nav.ts` (link)
- NEW `supabase/migrations/_staged/<ts>_outbox_delivery_columns_STAGED.sql` (+ rehearsal) only if columns are absent
- `src/lib/comms/drainer.ts` (write-back)

## DATABASE ENTITIES
`automation_outbox` (new nullable columns if absent; `template_id`, `vars`, `audience`, approval mark — align names with GHL M8), read: `organizations` (brand name for copy). No new table.

## DEPENDENCIES
- **TMMT-COMM-001/002** (drainer + gate) and **GHL M8** column vocabulary.
- G-02 (#243) audience field.
- ⚖️ Owner + counsel review of collections copy before any `live` send (recorded as an owner gate, not a code check).
- PM-05 (booking refs for variables) for the rental templates' producers; the registry itself does not depend on it.

## CONSTRAINTS
- No send; no producers switched on; the queue only stages and approves.
- Variables must not include SSN/DOB/licence data; a test rejects forbidden keys.
- Copy length fits SMS segments; email variant optional.

## SECURITY REQUIREMENTS
- Approval action is owner-only (`isOwnerUser`) with a hostile-authenticated and staff negative test.
- Recipient resolved server-side from `recipientRef` (lead/booking id), never from client-supplied phone/email.
- Template lint: banned words (`interest`, `penalty`, `guaranteed`, `approved for`, score claims) fail the test.

## IMPLEMENTATION NOTES
- Keep templates as data + a render function; render at drain time so approved copy changes do not require re-staging.
- The approval mark must be a DB column the gate reads (COMM-002), not a payload flag.

## ACCEPTANCE CRITERIA (testable)
1. Each template renders with required vars and refuses missing/forbidden vars.
2. Banned-claims lint passes on the shipped copy and fails on a synthetic violation.
3. `stageMessage` writes one row with the correct approval state; DNC recipient → refused at stage (fails pre-fix: no stager for these kinds).
4. Owner can approve/reject from `/command/outbox`; staff cannot (server-side).
5. Drainer write-back records `sent`/`failed`/`blocked` with provider id and error class (dry mode: `dry_run`).
6. Route registry row for `/command/outbox` updated; full gate passes.

## TESTS (must fail on the pre-fix code)
- `templates.test.ts`: `renders`, `rejects forbidden vars`, `banned words lint` (synthetic red).
- `stage.test.ts`: `stages with approval state`, `refuses DNC at stage`.
- `outbox/actions.test.ts`: `approve is owner-only` (hostile + staff refused).
- Drainer test extended: `write-back on each outcome`.

## DO NOT CHANGE
- `va-task-outbox.ts` semantics for VA task messages; `client_alerts`; senders; prod.

## OWNER GATE
⚖️ Copy review (owner + counsel) before live; **prod baton** for any staged columns; live sends stay behind TMMT-COMM-001's switch.
