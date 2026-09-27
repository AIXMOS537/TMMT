# TMMT-AI-002

## TASK ID
TMMT-AI-002

## TITLE
Quarantine `aria/` and `apps/engine`: guard tests that they are never deployed, wired or imported, and a retirement note (deletion is an owner decision)

## PM MILESTONE
PM-15 AIXMOS (roadmap: "Retire `aria/` and `apps/engine` (or quarantine them)"); also PM-17 retire list

## OBJECTIVE
Dead code that reads as live cannot become live by accident.

## WHY (evidence refs)
- SPEC §4.2 (`apps/engine` LEGACY/ORPHANED; `aria/` ORPHANED, unauthenticated `/api/chat`), §19.1 #13–#14, §20.3 **SEC-22**, §28 **KD-43**, §29; READINESS §8; E2 §1.1; E5 §B.2 #13–#14 (`aria/app/api/chat/route.ts:11` no auth; `portrait/route.ts` reads the filesystem; `apps/engine` excluded from tsconfig, not in `vercel.json`).

## CURRENT BEHAVIOR (file:line)
- Both folders exist at the repo root; neither is deployed; `apps/engine/middleware.ts` passes everything.

## EXPECTED BEHAVIOR
- `README-QUARANTINED.md` in each folder (status, why, owner decision pending: delete or archive).
- Guard test `src/lib/guards/quarantined-apps.test.ts`: nothing in `src/`, `packages/`, `vercel.json`, `package.json` scripts or `.github/workflows` references `aria/` or `apps/engine` (except the READMEs); `apps/engine` stays out of `tsconfig` includes; asserts non-zero files scanned.
- `scripts/vercel-ignore.sh` unaffected (verify it does not build on changes there).

## FILES (in scope)
Two READMEs; NEW guard test.

## DATABASE ENTITIES
None.

## DEPENDENCIES
None. Owner decision on deletion (later).

## CONSTRAINTS
No deletion in this task. No changes inside the folders beyond the README.

## SECURITY REQUIREMENTS
The guard prevents a future wiring of the unauthenticated chat route.

## IMPLEMENTATION NOTES
Scan with `fs`, not `git ls-files` with quoted globs (Windows-safe, see TMMT-BUILD-004).

## ACCEPTANCE CRITERIA (testable)
1. Guard passes now; fails on a synthetic `import ... from '../../aria/...'` fixture.
2. READMEs present; owner decision recorded as pending.

## TESTS (must fail on the pre-fix code)
`quarantined-apps.test.ts` (synthetic red); `scanned > 0`.

## DO NOT CHANGE
Anything else.

## OWNER GATE
Owner decision on deletion (later). Merge: owner.
