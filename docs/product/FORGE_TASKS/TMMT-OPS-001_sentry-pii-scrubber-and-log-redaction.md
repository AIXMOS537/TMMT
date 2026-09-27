# TMMT-OPS-001

## TASK ID
TMMT-OPS-001

## TITLE
Sentry `beforeSend` PII scrubber and redaction of the three known plaintext log sites

## PM MILESTONE
PM-17 Production hardening (roadmap: "Sentry PII scrubber"; SPEC §26 Error tracking / Logging)

## OBJECTIVE
No phone, email, IP or payload body reaches Sentry or the logs.

## WHY (evidence refs)
- SPEC §20.3 **SEC-21**, §26, §28 **KD-40**, §31.2 DoD #12; E5 §C.6 (emails/IPs at `login/actions.ts:101,117`; plaintext phone at `lib/agent/compliance/record-opt-out.ts:55`; stringified payload at `lib/degraded.ts:106`; Sentry has no `beforeSend`); E1 §1 (`sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation*.ts`; deprecated root `withSentryConfig` import at `next.config.ts:4`).

## CURRENT BEHAVIOR (file:line)
As cited above. `redactPii` exists (used before model calls and Slack, E5 §C.6).

## EXPECTED BEHAVIOR
- `beforeSend`/`beforeSendTransaction` in all three Sentry configs applying `redactPii` to message, exception values, breadcrumbs, request headers/cookies/body and `user` (keep only an opaque id).
- The three log sites use `redactPii` / structured fields (ids only).
- Migrate the deprecated `withSentryConfig` import (`next.config.ts:4`) to the documented path for the installed major.
- A guard test scanning `src/` for `console.log(` with `phone`/`email`/`payload` identifiers in the same statement (non-zero scan).

## FILES (in scope)
The three Sentry configs, `next.config.ts` (import only), the three log sites, NEW guard test, `redact-pii` tests extended.

## DATABASE ENTITIES
None.

## DEPENDENCIES
None.

## CONSTRAINTS
Do not change what is logged for security events beyond redaction; keep Sentry DSN handling as is.

## SECURITY REQUIREMENTS
Scrubber tested with fixtures containing phones (E.164 and formatted), emails, IPv4/IPv6, and a JSON body.

## IMPLEMENTATION NOTES
Apply the scrubber to `extra`/`contexts` too.

## ACCEPTANCE CRITERIA (testable)
1. Scrubber unit tests pass; a synthetic event with PII is redacted in every field.
2. The three sites no longer log PII (grep + guard).
3. Build has no Sentry deprecation warning; full gate passes.

## TESTS (must fail on the pre-fix code)
`sentry-scrub.test.ts` (fails pre-fix: no hook); guard test (fails pre-fix on the three sites).

## DO NOT CHANGE
Opt-out semantics in `record-opt-out.ts`; prod.

## OWNER GATE
None. Merge = deploy: owner + baton.
