# TMMT-RENT-006

## TASK ID
TMMT-RENT-006

## TITLE
GHL stage changes become event **requests**: `runGhlStageAutoOps` records a `ghl_request` event and never calls `applyVerifiedSync` (coordinated with GHL M6/M7)

## PM MILESTONE
PM-05 Rental state machine (roadmap new-build item 5: "GHL stage changes become events only (they can request, not set). Coordinate with GHL M6/M7")

## OBJECTIVE
Make the TMMT-side half of the durable fix for V1: a GHL stage can only *ask* for a transition; a person (or a rule the owner approved) decides through `rental_transition`. **Ownership boundary:** the *inbound* half (webhook inbox, event durability, routing, stage mapping) is GHL M6/M7's and is not built here. This task only (a) stops the automatic `applyVerifiedSync` call and (b) provides `record-ghl-request.ts`, a function M7 can call. It must never grow into a second webhook inbox, router or stage map. If M6/M7 land first, this task shrinks to "delete the auto-ops path".

## WHY (evidence refs)
- SPEC §21.2 **V1**, **V3**, §10.2 rule 2 ("GHL may raise an event; only the function changes state"), §10.5 #3, §28 **KD-06**; SoR §5.2; ROADMAP PM-05, PM-00 00-e (the env kill switch is containment; this is the fix); E3 §6 (`runGhlStageAutoOps` → `applyVerifiedSync(verifiedBy:"ghl_auto_ops")` marks verified, creates/advances `cases`, assigns staff, runs routing; verified rows feed `renter_pipeline_status` → `client_renter_status`).

## CURRENT BEHAVIOR (file:line)
- `src/lib/ghl/handlers/opportunity-stage.ts:203` → `runGhlStageAutoOps` (`src/lib/ops-command/ghl-auto-ops.ts:42-48` returns `enabled:false` when `GHL_AUTO_OPS=false`).
- `src/lib/ops-command/stage-rules.ts` (every rule `auto_apply: true`; `isGhlAutoOpsEnabled()` `:95-96`).
- `src/lib/crm-sync/apply-verified.ts:107` `void pushCanonicalStageToGhl(...)`.
- `crm_sync_records.canonical_stage` (6 rows, last 2026-06-03) with `verified` state; `renter_pipeline_status` view feeds `client_renter_status`.
- Stage map ships empty → every stage `inquiry` (KD-21).

## EXPECTED BEHAVIOR
- With the kill switch **off or on**, the stage handler writes: the `crm_sync_records` row as **unverified** (as today for non-auto), plus one `rental_events` row (or the ADR's request table) with `actor_kind='ghl_request'`, `requested_status=<mapped>`, `from_status=<current or null if no booking>`, no status change. If no booking is linked to the contact, the request is recorded against the lead/contact with `booking_id null` (per RENT-001 design; if the event table requires a booking, use `sync_events` with a `kind='rental_request'` and say so).
- `applyVerifiedSync(verifiedBy:"ghl_auto_ops")` is **never** called from the stage path. `applyVerifiedSync` remains for a human verifier (staff action) that then calls `rental_transition`.
- `runGhlStageAutoOps` is reduced to "record request + notify staff queue (internal, awaited)"; `stage-rules.ts` `auto_apply` becomes `false` everywhere or is removed (owner decision; default remove the flag and the code path).
- `client_renter_status` no longer changes because of a GHL stage; a static test proves the stage handler cannot reach `applyVerifiedSync`.
- Interim behaviour while the stage map is empty is unchanged (every stage → `inquiry` request); KD-21 is GHL M4/M7's fix.

## FILES (in scope)
- `src/lib/ops-command/ghl-auto-ops.ts` (+ test), `src/lib/ops-command/stage-rules.ts` (+ test), `src/lib/ghl/handlers/opportunity-stage.ts` (call site only; **GHL track reviews**)
- NEW `src/lib/rental/record-ghl-request.ts` (+ test)
- NEW static test `src/lib/guards/ghl-cannot-set-business-state.test.ts`

## DATABASE ENTITIES
Write: `rental_events` (request rows) or `sync_events`; `crm_sync_records` (unverified only). No schema change beyond RENT-002's table. Not written any more from this path: `cases`, staff assignment, routing.

## DEPENDENCIES
- **TMMT-RENT-002** (event table + function).
- **TMMT-SEC-007** landed (containment) and its env values set.
- **GHL track M6/M7**: the webhook inbox and router will replace the handler; this task must be reviewed by the GHL owner and shaped so M7 can call `record-ghl-request.ts` directly. If M6/M7 land first, re-scope this task to "M7 emits the request event" and delete the auto-ops path.

## CONSTRAINTS
- No new GHL API call. No change to `verifyGhlWebhook` / event-id handling (M6).
- Do not touch `crm-sync/stage-map.ts` mapping (M4/M7).
- `applyVerifiedSync` for the **human** path stays; only its automatic caller goes.

## SECURITY REQUIREMENTS
- The request event carries the raw GHL stage name and the mapped canonical stage for audit, but never PII beyond the contact id.
- Tests prove: a stage webhook fixture with `GHL_AUTO_OPS` unset produces no `cases` write, no `applyVerifiedSync` call, and exactly one request event.

## IMPLEMENTATION NOTES
- Keep the request idempotent per (contact, stage, event id) so a webhook retry does not add a second request.
- Awaited internal notification (staff queue) instead of `void` (FS-05).

## ACCEPTANCE CRITERIA (testable)
1. Stage fixture → 1 request event, 0 `cases` writes, 0 `applyVerifiedSync` calls, `crm_sync_records` unverified (fails pre-fix with `GHL_AUTO_OPS` unset).
2. A human verifier action still can call `applyVerifiedSync` then `rental_transition` (regression).
3. Static guard: no import path from `src/lib/ghl/**` to `applyVerifiedSync` or to `rental_transition` with a non-request actor.
4. Retry of the same event id adds no second request.
5. GHL owner review recorded; full gate passes.

## TESTS (must fail on the pre-fix code)
- `ghl-auto-ops.test.ts`: `stage webhook never auto-verifies` (fails pre-fix); `records one request event`; `retry idempotent`.
- `ghl-cannot-set-business-state.test.ts`: static import-graph check (fails pre-fix on `opportunity-stage.ts:203` → auto-ops → apply-verified).

## DO NOT CHANGE
- Webhook auth/event-id (M6); stage map (M4/M7); `applyVerifiedSync` internals; credit files; prod.

## OWNER GATE
Owner decision on removing `auto_apply`. GHL track review. Merge = deploy: owner + baton.
