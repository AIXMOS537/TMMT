# TMMT-COMM-005

## TASK ID
TMMT-COMM-005

## TITLE
Read GHL per-channel DND (`dndSettings`) for a contact and expose it to the send gate — read-only, allow-listed, cached, fail-closed

## PM MILESTONE
PM-18 Communications gateway (roadmap new-build item: "A GHL per-channel DND read")

## OBJECTIVE
The send gate can ask "is this contact DND for SMS / email / calls in GHL right now?" and gets a definite answer or `unknown` (which blocks).

## WHY (evidence refs)
- SPEC §16 ("GHL per-channel DND is not read anywhere (166 SMS-DND in GHL vs 7/41 STOPs in TMMT DNC, per memory)"), §21.1 (Consent gaps), §25.2 (Comms gate: DND fails closed); ROADMAP PM-18; E4 §4 ("GHL per-channel DND: not read anywhere in `src/` (MISSING)"), §1.1 (outbound calls; `findGhlContact*` = `GET /contacts/search/duplicate`); memory: GHL DND is per-channel (`dndSettings`), top-level `dnd` undercounts.

## CURRENT BEHAVIOR (file:line)
- `src/lib/ghl/client.ts` has contact search, custom-field update, tag add, stage move, `sendConversationMessage`; no contact GET that returns `dndSettings`.
- `promote_ghl_contact` honours the mirrored top-level `dnd` on `ghl_contacts` (E3 §6) — the mirror's columns are set by the off-repo poller; whether `dndSettings` is mirrored: UNKNOWN (check `ghl_contacts` columns in the snapshot first; if present and fresh, prefer the mirror).
- GHL M4 discovery (branch) is read-only over **7 allow-listed GETs**; a contact GET is likely outside that list.

## EXPECTED BEHAVIOR
- NEW `src/lib/ghl/dnd.ts` `getContactDnd(contactId | phone, { locationId }) → { sms: 'dnd'|'ok'|'unknown', email: …, call: …, source: 'mirror'|'api', fetchedAt }`:
  1. If `ghl_contacts` carries per-channel DND columns (confirm) and `synced_at` is within the poller window (6 h + margin), answer from the mirror.
  2. Else one allow-listed `GET /contacts/{id}` (or the search-by-phone already used), parse `dndSettings` per channel (`inactive`/`active`/`permanent` → ok/dnd/dnd), with a short in-memory TTL cache per process and a durable cache row **only if** the GHL M4/M8 design has a place for it (else no durable cache).
  3. Any error, missing key/location, or unparsable shape → `unknown` for every channel (fail closed at the gate).
- The gate (TMMT-COMM-002) consumes it; nothing else does.
- Location resolution uses the existing env resolver today (`locationOr()`); it must be trivially swappable for the M3 registry.

## FILES (in scope)
- NEW `src/lib/ghl/dnd.ts` (+ `dnd.test.ts` with recorded fixture shapes, synthetic ids) — **GHL track reviews**
- `src/lib/comms/send-gate.ts` (wire)
- `.env.example` only if a new env name is needed (avoid)

## DATABASE ENTITIES
Read-only: `ghl_contacts` (mirror columns, confirm names). No schema change (a durable cache is out of scope unless M8 defines it).

## DEPENDENCIES
- **GHL track**: confirm the contact GET is acceptable under the read-only allow-list policy (M4) and how M8 wants DND exposed; if M4 says no new GET, the helper is mirror-only and `unknown` otherwise (still fail closed).
- TMMT-COMM-002 (consumer).
- The off-repo poller's mirrored fields (UNKNOWN) — an owner question.

## CONSTRAINTS
- Read-only: no tag, field or stage writes.
- No hard-coded location/pipeline ids.
- Cache TTL short (minutes); never cache `unknown`.

## SECURITY REQUIREMENTS
- Never log phone numbers or contact payloads; log contact id + per-channel result.
- Fail closed: `unknown` blocks at the gate (tested in COMM-002's matrix).
- Rate: bounded by the drainer batch size; no bulk sweeps of GHL contacts.

## IMPLEMENTATION NOTES
- Treat `permanent` as `dnd`.
- If the mirror is used, record the mirror age in the result so the gate can refuse stale answers (older than the poller window).

## ACCEPTANCE CRITERIA (testable)
1. Fixture with `dndSettings.SMS.status='active'` → `sms:'dnd'`, `email:'ok'` (fails pre-fix: helper absent).
2. Missing config / HTTP 500 / malformed → all `unknown`.
3. Mirror fresh → `source:'mirror'`, no HTTP call; mirror stale → API (or `unknown` if GET not allowed).
4. GHL owner review recorded; full gate passes.

## TESTS (must fail on the pre-fix code)
- `dnd.test.ts`: `parses per-channel dnd`, `unknown on error`, `mirror preferred when fresh`, `stale mirror not trusted`, `never caches unknown`.

## DO NOT CHANGE
- `client.ts` auth/env handling beyond adding one GET; `outbound-gate.ts`; the poller; prod.

## OWNER GATE
None for the code (GHL track review; owner question on mirror fields). Merge = deploy: owner + baton.
