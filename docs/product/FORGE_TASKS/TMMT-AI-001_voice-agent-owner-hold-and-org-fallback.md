# TMMT-AI-001

## TASK ID
TMMT-AI-001

## TITLE
Voice agent ("Bella"): the same owner hold as SMS, and no nil-UUID org fallback (missing org slug → 4xx, never 500 and never a stored reply)

## PM MILESTONE
PM-15 AIXMOS (roadmap: "Voice agent: owner hold + no nil-UUID fallback (KD-27)")

## OBJECTIVE
Voice replies are held for owner approval exactly like SMS drafts, and a call without a resolvable tenant is refused cleanly.

## WHY (evidence refs)
- SPEC §19.1 #4, §19.3 (Voice: same owner hold; no nil-UUID fallback), §20.3 **SEC-18**, §28 **KD-27**; READINESS §3 #10; E5 §B.2 #4 (`ghl-voice-handler.ts:42-66` nil-UUID fallback → licence guard throws → 500; `ghl-voice-leads.ts:111-117` AI reply stored as outbound **without** the owner hold; `x-ghl-voice-secret` only, no rate limit), §B.2 #1 (SMS pattern: `auto-reply-policy.ts:28-39`).

## CURRENT BEHAVIOR (file:line)
- `src/lib/agent/voice/ghl-voice-handler.ts:42-66`, `ghl-voice-leads.ts:111-117`, `src/app/api/agent/voice/ghl/route.ts:38` (constant-time secret; tenant and `location_kind` from the payload).

## EXPECTED BEHAVIOR
- Org resolution: `org_slug` must resolve to an existing org; otherwise respond 400/404 with a PII-free body; no nil-UUID; no DB write.
- Reply persistence uses the SMS owner-hold policy (`auto-reply-policy.ts`): stored as `held` unless the org is in the approved auto-reply list; nothing is sent (voice sending is not built).
- `isRateLimitedDurable` on the route keyed by IP + org.
- Tags/fields written to GHL stay behind the DNC guard (TMMT-SEC-003).

## FILES (in scope)
The three files above (+ tests). GHL-adjacent: `ghl-voice-tags.ts` untouched.

## DATABASE ENTITIES
`agent_conversations`, `agent_messages` (hold status), `organizations` (slug lookup). No schema change.

## DEPENDENCIES
TMMT-SEC-003 landed. Coordinate with GHL M13 (voice will become a tool-user of `GhlGateway`).

## CONSTRAINTS
No new model calls; no send path.

## SECURITY REQUIREMENTS
Tests: missing slug → 4xx, no write; unknown slug → 4xx; secret still required; rate limit hit → 429; hold applied by default.

## IMPLEMENTATION NOTES
Reuse `resolveTenant` from the SMS agent if it exists (`lib/agent/tenant`).

## ACCEPTANCE CRITERIA (testable)
1. Missing/unknown `org_slug` → 4xx, no rows (fails pre-fix: 500 after fallback).
2. Reply stored as held for a non-auto-reply org (fails pre-fix).
3. Rate limit and secret tests pass; full gate passes.

## TESTS (must fail on the pre-fix code)
`ghl-voice-handler.test.ts`: `no nil-uuid fallback`; `ghl-voice-leads.test.ts`: `reply held by default`; route test: `rate limited`.

## DO NOT CHANGE
SMS agent; `auto-reply-policy.ts` semantics; GHL client; prod.

## OWNER GATE
None. Merge = deploy: owner + baton.
