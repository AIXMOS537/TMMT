# TMMT-COMM-003

## TASK ID
TMMT-COMM-003

## TITLE
Fix the false-success senders: `addContactTag` and `sendConversationMessage` must fail loudly when GHL is not configured, and the overdue route must report the truth

## PM MILESTONE
PM-18 Communications gateway (roadmap new-build item: "Fail on missing config (FS-02)"; SPEC §24 target rule)

## OBJECTIVE
A caller can never record "Tagged" or "sent" when nothing left the building.

## WHY (evidence refs)
- SPEC §24 **FS-01**, **FS-02**, §16 (Twilio/GHL/email senders), §31.2 DoD #5 ("every write checks its result"); READINESS §3 #5; E4 §6 F1 (`overdue/route.ts:63-77`: `addContactTag` returns silently when unconfigured (`client.ts:159`) so `ghlTagApplied = true`; `sync_events` insert result unchecked `:55-61`), F2 (`client.ts:310-311` returns without error when key/location missing).
- TMMT-SEC-003 deliberately left this to COMM-003.

## CURRENT BEHAVIOR (file:line)
- `src/lib/ghl/client.ts:159`: `addContactTag` early-returns when `GHL_API_KEY`/location is missing.
- `src/lib/ghl/client.ts:310-311`: `sendConversationMessage` returns `undefined` after the gate when config is missing.
- `src/app/api/webhooks/ghl/overdue/route.ts:55-61` (sync_events insert unchecked), `:63-77` ("Tagged payment-overdue in GHL." regardless).
- Other `addContactTag` callers (E4 §1.1): `sync-outbound.ts:75`, `aixmos-prequal-act.ts:99`, `ghl-voice-handler.ts:150,172`, `ghl-voice-tags.ts:27-64` — each assumes success.

## EXPECTED BEHAVIOR
- `addContactTag`, `updateContactCustomFields`, `updateOpportunityStage`, `sendConversationMessage`: when GHL is not configured they **throw** a typed `GhlNotConfiguredError` (or return a discriminated `{ ok:false, reason:'not_configured' }` — pick one for the module and apply it consistently; prefer the result type if most callers already branch on results). A configured-but-failed HTTP call returns/throws with the status class.
- Every caller handles the outcome: the overdue route returns `{ ok:true, ghl_tag_applied:false, reason:'not_configured' }` and checks the `sync_events` insert; the other callers log a PII-free failure and propagate a non-success result (no `void`).
- No behaviour change when GHL is configured and the call succeeds.

## FILES (in scope)
- `src/lib/ghl/client.ts` (+ tests) — **GHL track reviews**
- `src/app/api/webhooks/ghl/overdue/route.ts` (+ test)
- Call sites listed above (result handling only; the DNC guard from TMMT-SEC-003 stays)

## DATABASE ENTITIES
`sync_events` (insert result checked). No schema change.

## DEPENDENCIES
- TMMT-SEC-003 (same call sites; land SEC-003 first to avoid conflicts).
- GHL track review (M6/M8 will absorb `client.ts` into `GhlGateway`; keep the change small).

## CONSTRAINTS
- Do not add retries or queues here (the drainer owns retry).
- Do not change auth or event-id handling.
- Do not change tag names.

## SECURITY REQUIREMENTS
- Error messages never include the API key, location id or contact PII.
- Failing loudly must not turn into a 500 that loses a webhook event (FS-03): the overdue route catches the typed error and responds 200 with `ghl_tag_applied:false`.

## IMPLEMENTATION NOTES
- A single `requireGhlConfig()` helper at the top of each outbound function keeps the change mechanical.

## ACCEPTANCE CRITERIA (testable)
1. With GHL env unset, `addContactTag` no longer returns silently (fails pre-fix).
2. The overdue route reports `ghl_tag_applied:false, reason:'not_configured'` and checks the `sync_events` insert (fails pre-fix: reported "Tagged").
3. `sendConversationMessage` with missing config yields a typed failure (fails pre-fix).
4. Configured-success path unchanged (regression tests).
5. Full gate passes; GHL owner review recorded.

## TESTS (must fail on the pre-fix code)
- `client.test.ts`: `addContactTag fails when unconfigured`, `sendConversationMessage fails when unconfigured` (fail pre-fix).
- `overdue/route.test.ts`: `does not claim Tagged when GHL unconfigured`, `sync_events insert error surfaces` (fail pre-fix).

## DO NOT CHANGE
- `verifyGhlWebhook`, `consumeGhlEventId`; the SMS gate call at `client.ts:299`; the DNC guard (SEC-003); prod.

## OWNER GATE
None (GHL track review). Merge = deploy: owner + baton.
