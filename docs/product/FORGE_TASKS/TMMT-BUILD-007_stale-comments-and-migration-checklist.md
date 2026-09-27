# TMMT-BUILD-007

## TASK ID
TMMT-BUILD-007

## TITLE
Fix stale comments that mislead builders, and add the migration checklist (default-ACL REVOKE rule)

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 6)

## OBJECTIVE
Comments that say a live guard is "not applied" or a live RPC is "staged" make agents re-do or weaken work. Correct them, and make the default-ACL hazard a written rule for every new migration.

## WHY (evidence refs)
- SPEC §20.3 **SEC-16**, **SEC-24**, §28 **KD-41**, §30 item 5; ROADMAP PM-01 item 6; E3 §8, E5 §C.3, §C.5, E2 R7.

## CURRENT BEHAVIOR (file:line)
- `src/lib/rental-pricing/create-booking.ts:19-20,35`: `BOOKING_GUARD_NOTE` and the header say the EXCLUDE constraint applies "until the migration is applied". It **is live** on prod (`bookings_no_double_booking`, prod `20260917200051`).
- `src/lib/rate-limit-durable.ts:10-20`: says `rate_limit_hit` is STAGED. It **exists on prod**.
- `src/app/(admin)/layout.tsx:9-16`: says "31 admin screens" at `/payments`, `/contracts`. There are 29, and those paths are redirects to `/interfaces/*` (`next.config.ts:47-50`).
- Default ACL: objects created by `supabase_admin` grant `anon`/`authenticated` `arwdDxtm` (includes TRUNCATE). There is no written checklist in the repo telling migration authors to REVOKE.

## EXPECTED BEHAVIOR
- Comments corrected to the facts with a date and evidence pointer. If `BOOKING_GUARD_NOTE` is exported and used in UI text, change only the wording, and keep the export name so no callers break (grep first).
- NEW `supabase/migrations/CHECKLIST.md`: the SPEC §30 item 5 rules (idempotent; `REVOKE ALL … FROM anon, authenticated` then explicit grants; RLS on + explicit policies; org column `NOT NULL`, server-derived; PGlite rehearsal wired into CI; staged until owner + baton; pre-apply snapshot; postcondition queries recorded; never apply the `generate_va_tasks_idempotent` landmine).
- A static test: every **new** file under `supabase/migrations/_staged/` created after this PR (by filename timestamp > the PR's) that contains `create table` also contains `revoke` for anon/authenticated.

## FILES (in scope)
- `src/lib/rental-pricing/create-booking.ts` (comments / wording only)
- `src/lib/rate-limit-durable.ts` (comment only)
- `src/app/(admin)/layout.tsx` (comment only)
- NEW `supabase/migrations/CHECKLIST.md`
- NEW `src/lib/db/staged-migration-revoke.test.ts`

## DATABASE ENTITIES
None (documentation + static test).

## DEPENDENCIES
None.

## CONSTRAINTS
- No logic changes in the three source files.
- The static test must not flag the historic files (timestamp cutoff) and must assert it scanned the directory.

## SECURITY REQUIREMENTS
The checklist is the SEC-16 control until a DB-level default ACL change is approved (an owner decision; out of scope).

## IMPLEMENTATION NOTES
- Use a cutoff constant equal to the PR date in `YYYYMMDDHHMMSS` form.

## ACCEPTANCE CRITERIA (testable)
1. `grep -n "until the migration is applied\|STAGED" src/lib/rental-pricing/create-booking.ts src/lib/rate-limit-durable.ts` shows no stale claims.
2. The checklist exists and is linked from `supabase/migrations/_staged/README` (if present) or `docs/`.
3. The static test passes now, and fails on a synthetic new staged file with `create table` and no `revoke` (fixture inside the test).
4. The full gate passes.

## TESTS (must fail on the pre-fix code)
- `staged-migration-revoke.test.ts`: `flags a new staged create table without revoke` (synthetic input); `scanned _staged dir`. (Pre-fix, the rule does not exist; the red evidence is the synthetic fixture.)

## DO NOT CHANGE
- Any migration content. Any runtime logic.

## OWNER GATE
None for the code. Merge: owner + baton.
