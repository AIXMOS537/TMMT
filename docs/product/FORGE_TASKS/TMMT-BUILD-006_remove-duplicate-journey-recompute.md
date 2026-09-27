# TMMT-BUILD-006

## TASK ID
TMMT-BUILD-006

## TITLE
Remove the duplicate journey recompute (Vercel cron vs pg_cron)

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 2)

## OBJECTIVE
Journey recompute must run once a day, from one scheduler, with visible health.

## WHY (evidence refs)
- SPEC §17 (`aixmos_nightly_journey_recompute` 04:30 "duplicates Vercel cron at 04:00"), §28 **KD-36**; ROADMAP PM-01 item 2 (OWNER DECISION on which one stays); READINESS §8 (retire one); E4 §5.
- The Vercel cron is currently 307'd (dead). Once TMMT-BUILD-001 lands it will run **again**, and the recompute will run twice nightly.

## CURRENT BEHAVIOR (file:line)
- `vercel.json` `crons`: `{ "path": "/api/cron/journey-recompute", "schedule": "0 4 * * *" }`.
- `src/app/api/cron/journey-recompute/route.ts` (secret-checked; calls the recompute; `src/lib/client-journey/*` has 0 tests).
- pg_cron `aixmos_nightly_journey_recompute` at 04:30 → `recompute_all_journeys()` (7/7 ok runs; swallows exceptions, FS-14).

## EXPECTED BEHAVIOR (per owner decision)
- **Option A (recommended by the evidence: pg_cron is the one that runs and has run history):** remove the `journey-recompute` entry from `vercel.json` `crons`. Keep the route for manual/secret-authenticated use, or delete it if nothing else calls it (grep first).
- **Option B:** keep Vercel, and prepare a staged SQL `cron.unschedule('aixmos_nightly_journey_recompute')` for the owner to apply with the baton.
- Either way, add a unit test that pins the single scheduler (a static check on `vercel.json`).

## FILES (in scope)
- Option A: `vercel.json`; optionally `src/app/api/cron/journey-recompute/route.ts` (delete only if unreferenced)
- Option B: NEW `supabase/migrations/_staged/<ts>_unschedule_journey_recompute_dup_STAGED.sql`
- NEW `src/lib/guards/single-journey-scheduler.test.ts`

## DATABASE ENTITIES
`cron.job` (Option B only, staged). `client_journey` (written by the recompute; unchanged).

## DEPENDENCIES
- Owner decision (A/B).
- Should merge **together with or before** TMMT-BUILD-001, so the double run never happens.

## CONSTRAINTS
- `vercel.json` changes trigger a deploy on merge (it is in the `vercel-ignore.sh` build list). Owner merge + baton.
- Do not change `recompute_all_journeys()`.

## SECURITY REQUIREMENTS
None beyond the standard ones. Do not remove the route's secret check if the route is kept.

## IMPLEMENTATION NOTES
- If the route is kept for manual runs, document the curl call (with the secret placeholder, never a value) in the route header.

## ACCEPTANCE CRITERIA (testable)
1. Exactly one scheduled source of the journey recompute exists (the static test and the PR evidence).
2. Option A: `vercel.json` has only the KPI cron. Option B: a staged unschedule SQL with a postcondition query `select jobname from cron.job where jobname like '%journey%'`.
3. The full gate passes.

## TESTS (must fail on the pre-fix code)
- `single-journey-scheduler.test.ts`: `vercel.json has no journey-recompute cron` (Option A; fails pre-fix), or `staged unschedule present` (Option B).

## DO NOT CHANGE
- The KPI cron entry. `recompute_all_journeys()`. `src/lib/client-journey/*`.

## OWNER GATE
Owner decision (A/B); Option B needs the prod baton to apply. Merge: owner + baton.
