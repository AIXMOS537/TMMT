# TMMT-BUILD-002

## TASK ID
TMMT-BUILD-002

## TITLE
Wire the PGlite SQL rehearsals into CI

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 3)

## OBJECTIVE
SQL rehearsals protect prod SQL only when someone remembers to run them. Make CI run them on every PR and fail the build on regression.

## WHY (evidence refs)
- SPEC §4.3 (SQL rehearsals not in CI), §25.1, §25.2 (rehearsals in CI for money, permissions, tenant isolation, rental state), §20.3 **SEC-10**; ROADMAP PM-01 item 3; E1 §3.3, §5.3 items 6.
- 11 rehearsals exist. 8 pass as-is. `automation-repairs.pglite.test.mjs` is red by design without `--repaired`. `automation-migrations.rehearsal.mjs` and `classifier-migration.rehearsal.mjs` need undocumented path args.

## CURRENT BEHAVIOR (file:line)
- `scripts/tests/sql/*.mjs`, with its own `package.json` / `package-lock.json` (PGlite 0.5.8). There is no README in that folder.
- `.github/workflows/verify.yml` runs brand, lint, tsc, test and build only. There is no rehearsal step.
- `automation-migrations.rehearsal.mjs:3` usage: `<lease migration> <contracts migration>`; `classifier-migration.rehearsal.mjs:2` usage: `supabase/migrations/<file>.sql`. E1 could not determine the correct targets.

## EXPECTED BEHAVIOR
- A new CI job (in `verify.yml` or a new `sql-rehearsals.yml`) that runs `npm ci` in `scripts/tests/sql` and then runs each rehearsal. Any non-zero exit fails the job.
- A runner script `scripts/tests/sql/run-all.mjs` (or `.sh`) with an **explicit list**: script → args. The job fails if a `*.rehearsal.mjs` / `*.pglite.test.mjs` file exists that is not in the list (no silent skip).
- `automation-repairs.pglite.test.mjs` runs with `--repaired`.
- The two path-arg rehearsals: find the right targets (search `supabase/migrations/_staged/` for the lease-reap, contracts-date and classifier STAGED files; read each rehearsal's assertions). If the targets cannot be determined with evidence, list them as `pending` in the runner, with a reason, and **report them in the PR and in `S2_SPEC_ISSUES.md`**. Do not guess.
- A `scripts/tests/sql/README.md` documenting how to run each one.

## FILES (in scope)
- `.github/workflows/verify.yml` (add a job) **or** NEW `.github/workflows/sql-rehearsals.yml`
- NEW `scripts/tests/sql/run-all.mjs`, NEW `scripts/tests/sql/README.md`

## DATABASE ENTITIES
None (in-memory PGlite only).

## DEPENDENCIES
- **Coordinate with Phase 2A A3** (`sec/2a-profiles-regression`), which plans to put `profiles-access-columns.rehearsal` into CI. If A3 lands first, reuse its job. If this lands first, tell the 2A owner so A3 does not duplicate it. Do not edit the rehearsal itself.
- Coordinate with GHL M2/M9 (they add rehearsals too): the runner must make adding one a one-line change.

## CONSTRAINTS
- Rehearsals must never touch a real database. Assert that no `DATABASE_URL`/Supabase env is used by the runner.
- Do not modify existing rehearsal assertions.
- Keep the job duration reasonable (`profiles-access-columns` takes ~53 s); parallel steps are fine.

## SECURITY REQUIREMENTS
- The job gets no secrets (`permissions: contents: read`).
- Fixtures contain no real data.

## IMPLEMENTATION NOTES
- Node 24, `actions/setup-node` with `cache-dependency-path: scripts/tests/sql/package-lock.json`.
- The runner prints `name: PASS/FAIL (ms)` and exits non-zero if any fail or are unlisted.

## ACCEPTANCE CRITERIA (testable)
1. On a PR, the CI job runs all listed rehearsals and passes on current master.
2. Deliberately breaking one assertion locally makes the runner exit non-zero (documented in the PR).
3. Adding an unlisted `*.rehearsal.mjs` makes the runner exit non-zero.
4. The README lists every rehearsal with its command.
5. Any `pending` rehearsal is listed with evidence and reported.

## TESTS (must fail on the pre-fix code)
- `run-all.mjs --self-test` (or a vitest `scripts/tests/sql/run-all.test.ts` excluded from the app build): `fails on an unlisted rehearsal`, `fails when a rehearsal exits 1`. On the pre-fix code, CI has no rehearsal step at all; the red evidence is a deliberately broken rehearsal that passes CI before this change and fails after it.

## DO NOT CHANGE
- The rehearsal scripts' logic. `profiles-access-columns.rehearsal.mjs` (Phase 2A). Other workflow jobs' steps.

## OWNER GATE
None for the code. Merge: owner + baton (a workflow-only change does not trigger a Vercel build, but merging is an owner action).
