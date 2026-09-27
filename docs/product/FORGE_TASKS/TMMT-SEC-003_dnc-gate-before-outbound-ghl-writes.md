# TMMT-SEC-003

## TASK ID
TMMT-SEC-003

## TITLE
DNC / opt-out gate before outbound GHL tag, custom-field and stage writes, and on the email branch

## PM MILESTONE
PM-00 Security containment (roadmap item 00-h)

## OBJECTIVE
No TMMT code path writes a GHL tag, custom field or opportunity stage, or sends a GHL email, for a contact on the TMMT do-not-contact list or opted out. Those writes trigger GHL workflows that can message people who said STOP.

## WHY (evidence refs)
- SPEC §16 (DNC bypass paths), §20.3 **SEC-08**, §28 **KD-13**; SoR §5.6 (the opt-out gate fails closed); ROADMAP 00-h.
- E4 §2(c): `assertOutboundAllowed` is called only by the SMS path, the email gate and the VA stager. There is no check before the listed GHL writes.

## CURRENT BEHAVIOR (file:line)
Ungated outbound writes (re-verify each):
- `src/app/api/webhooks/ghl/overdue/route.ts:65` `addContactTag(contact_id, "payment-overdue")`
- `src/lib/ghl/sync-outbound.ts:74-83` `addContactTag(… tmmt-<canonical>)` + `updateOpportunityStage`
- `src/lib/agent/voice/ghl-voice-tags.ts:27-70` (tags + custom fields); `src/lib/agent/voice/ghl-voice-handler.ts:150,172`
- `src/lib/aixmos-prequal-act.ts:99` `addContactTag(contactId, decision.ghlTag)`
- `src/lib/ghl/sync-contact-portal-fields.ts:68` `updateContactCustomFields`
- `src/lib/ghl/client.ts:293-311` `sendConversationMessage`: the gate runs only for `type:"SMS"`; the **Email** branch skips it.
- The gate itself is `src/lib/outbound-gate.ts:62-111` `assertOutboundAllowed({ phone, organizationId, vertical, type, ownerApproved, db })`. It fails closed on read errors and needs a **phone**.

## EXPECTED BEHAVIOR
- A single guard (e.g. `assertGhlWriteAllowed({ contactId, phone?, organizationId?, db })`) runs before every write listed above. It resolves the contact's phone (from the caller's data if present, else from the local mirror; inspect `ghl_contacts` columns in the prod catalog / live-ledger first; do not guess) and calls `assertOutboundAllowed`.
- If the contact is DNC / opted out → the write is **skipped**, the caller gets a non-success result that says so, and the skip is logged without PII.
- If the phone cannot be resolved, or the DNC read fails → **fail closed** (skip + report), per SoR §5.6.
- The `sendConversationMessage` Email branch runs the same DNC/opt-out check (or throws `SmsBlockedError` with a clear reason).

## FILES (in scope)
- NEW `src/lib/ghl/outbound-write-guard.ts` (+ test)
- `src/app/api/webhooks/ghl/overdue/route.ts`, `src/lib/ghl/sync-outbound.ts`, `src/lib/agent/voice/ghl-voice-tags.ts`, `src/lib/agent/voice/ghl-voice-handler.ts`, `src/lib/aixmos-prequal-act.ts`, `src/lib/ghl/sync-contact-portal-fields.ts`, `src/lib/ghl/client.ts` (email branch only)
- Their existing tests (extend)

## DATABASE ENTITIES
Read-only: `do_not_contact_numbers`, `incoming_leads.opted_out`, `ghl_contacts` (phone lookup; confirm the column name in prod first). No schema change.

## DEPENDENCIES
- None blocking.
- **Coordinate with the GHL router track (M8 owns the future gateway).** Build the guard so M8 can absorb it; the GHL owner reviews the diff. Voice files are also touched later by PM-15 (TMMT-AI-001); keep the voice change to the guard call only.

## CONSTRAINTS
- Do not change `assertOutboundAllowed` semantics.
- Do not add a GHL DND read here (that is PM-18, TMMT-COMM-005).
- Do not change which tags are written, only whether they are written.
- No new GHL API calls.

## SECURITY REQUIREMENTS
- Fail closed on unknown phone, read error or missing DB client.
- No phone numbers in logs; use the existing redaction helpers.
- The guard is server-only.

## IMPLEMENTATION NOTES
- `addContactTag` itself is a thin HTTP helper. Gating at the call sites (via the shared guard) keeps `client.ts` generic and makes the skip visible to each caller. Alternatively, gate inside `addContactTag` / `updateContactCustomFields` / `updateOpportunityStage` with a required `consent` argument. Choose one, and justify it in the PR.
- The overdue route currently reports success even when the tag is not applied (FS-01). With the guard, return `ghl_tag_applied:false, reason:"dnc"`. Do not fix the unconfigured-GHL false success here (TMMT-COMM-003).

## ACCEPTANCE CRITERIA (testable)
1. For each listed call site: a DNC phone → no GHL HTTP call is made (fetch mock asserts 0 calls), and the result reports the skip.
2. An opted-out lead for the org → skipped.
3. A DNC read error → skipped (fail closed).
4. An unresolvable phone → skipped (fail closed).
5. A clear contact → the write happens exactly as before.
6. `sendConversationMessage({type:"Email"})` to a DNC contact → refused.
7. The full gate passes; the existing GHL tests stay green.

## TESTS (must fail on the pre-fix code)
- `outbound-write-guard.test.ts`: clear / dnc / opted_out / read_error / no_phone.
- Per call site (vitest, mocked fetch + fake db): `overdue route does not tag a DNC contact`; `sync-outbound skips stage push for DNC`; `prequal act skips tag for DNC`; `portal fields not written for DNC`; `voice tags skipped for DNC`; `email branch refuses DNC`. Each fails pre-fix.

## DO NOT CHANGE
- `src/lib/outbound-gate.ts` logic.
- Webhook auth / event-id handling.
- `record-opt-out.ts` and the SMS inbound route.
- Credit files.

## OWNER GATE
None for the code (GHL track review required). Merge = deploy: owner + prod baton.
