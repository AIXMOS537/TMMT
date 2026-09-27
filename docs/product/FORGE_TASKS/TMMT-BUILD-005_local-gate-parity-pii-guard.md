# TMMT-BUILD-005

## TASK ID
TMMT-BUILD-005

## TITLE
Local gate parity (`tsc` in `verify.sh`) and `pii-guard` fails when `PII_DENYLIST` is unset

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 5)

## OBJECTIVE
The local pre-push gate must run the same checks as CI, and the PII scan must not pass while checking no PII values.

## WHY (evidence refs)
- SPEC §4.3 (typecheck missing from `verify.sh`), §24 **FS-22**, §28 **KD-45**; ROADMAP PM-01 item 5; E1 §2, §5.3 item 7, §6.
- `verify.yml` says `next build` type-checks only what it bundles, excluding `*.test.ts`. So `tsc --noEmit` is the only check that sees test fixtures, and it is missing locally.

## CURRENT BEHAVIOR (file:line)
- `scripts/verify.sh`: steps 1/4 brands, 2/4 lint, 3/4 test, 4/4 build. No `tsc`. The header comment claims "(typecheck)" via the build.
- `.github/workflows/verify.yml`: runs `npx tsc --noEmit` separately (with an explanatory comment).
- `.github/workflows/pii-guard.yml` → `ultimatrix.sh scan`. With `PII_DENYLIST` unset it prints "structural checks only" and continues (`ultimatrix.sh:196`). Whether the secret is set: UNKNOWN.

## EXPECTED BEHAVIOR
- `scripts/verify.sh` adds a step `npx tsc --noEmit` (before the build), fails the gate on error, and fixes the header comment.
- `pii-guard.yml`: when `PII_DENYLIST` is empty, the job **fails** with a clear message ("PII_DENYLIST secret not set; scan would be structural only"), unless it runs on a fork PR where secrets are unavailable. In that case it prints a warning, and a maintainer re-run is required. Record the chosen fork behaviour.

## FILES (in scope)
- `scripts/verify.sh`
- `.github/workflows/pii-guard.yml` (and `ultimatrix.sh` only if the check must live there; prefer the workflow)
- NEW `src/lib/guards/local-gate-parity.test.ts` (a static scan: `verify.sh` contains `tsc --noEmit`; `pii-guard.yml` fails on an empty denylist; non-zero targets)

## DATABASE ENTITIES
None.

## DEPENDENCIES
- **Owner decision / action:** confirm the `PII_DENYLIST` repo secret is set **before** this merges. Otherwise every PR goes red. Never paste its value anywhere.

## CONSTRAINTS
- Do not change the scan logic itself. Do not print the denylist.

## SECURITY REQUIREMENTS
- Secret handling stays inside `${{ secrets.PII_DENYLIST }}`. No echo.

## IMPLEMENTATION NOTES
- In bash: `if [ -z "${PII_DENYLIST:-}" ]; then echo "::error::PII_DENYLIST not set"; exit 1; fi`.

## ACCEPTANCE CRITERIA (testable)
1. `bash scripts/verify.sh` runs tsc; introducing a type error in a `*.test.ts` fails the local gate (it passed pre-fix).
2. The static guard test fails pre-fix and passes after.
3. The PR records that the owner confirmed the secret is set (yes/no, no value).

## TESTS (must fail on the pre-fix code)
- `local-gate-parity.test.ts`: `verify.sh runs tsc --noEmit`; `pii-guard fails when PII_DENYLIST empty`; `scanned both files`.

## DO NOT CHANGE
- `verify.yml` steps. The `ultimatrix.sh` scan patterns.

## OWNER GATE
Owner decision (confirm `PII_DENYLIST` is set). Merge: owner + baton.
