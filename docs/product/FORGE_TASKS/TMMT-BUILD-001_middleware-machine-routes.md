# TMMT-BUILD-001

## TASK ID
TMMT-BUILD-001

## TITLE
Middleware: machine APIs reach their own auth checks (401 without a credential, never a 307 to `/login`)

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 1)

## OBJECTIVE
The 8 machine-to-machine APIs currently get `307 → /login` before their own secret checks run, so both Vercel crons are dead (the KPI table was last written 2026-05-20). Let them through the middleware so that each route's own authentication decides: 2xx with the right credential, 401 without it.

## WHY (evidence refs)
- SPEC §6.3 (8 machine APIs), §17 ("Crons blocked by middleware"), §20.3 **SEC-11**, §28 **KD-11**; ROADMAP PM-01 item 1 ("Gate: ships only after 00-d"); E2 §1.4 **R1**; E5 §C.5.
- `src/middleware.test.ts:237-239` pins the wrong behaviour (`/api/cron/anything`, `/api/ops/command` "redirects to /login").

## CURRENT BEHAVIOR (file:line)
- `src/middleware.ts:47-69` `isPublicPath` + `:11-31` `isFunnelPublicPath` whitelist `/api/auth/`, `/api/webhooks/`, `/api/forms/`, `/api/agent/`, `/api/leads/`, `/api/health`. `:266` `if (!user && !isPublicPath(pathname))` → redirect to `/login`.
- Route auth as it is today (verify each):
  - `src/app/api/cron/journey-recompute/route.ts:8-16` and `cron/marketing-kpi-ghl/route.ts:9-17`: `CRON_SECRET ?? OPS_COMMAND_SECRET`, Bearer or `x-cron-secret`, 401.
  - `src/app/api/mission/generate/route.ts:10,46`: same secret, 401.
  - `src/app/api/ops/command/route.ts:54-62`: `OPS_COMMAND_SECRET`, 401 (500 if unset).
  - `src/app/api/audit/events/route.ts:13-22`: `x-audit-key` vs `AUDIT_INGEST_KEY`, constant-time, 401.
  - `src/app/api/license/revoke/route.ts:28`: `adminAuthorized`, 401.
  - `src/app/api/license/provision/route.ts`: a one-time install token (hashed lookup); no rate limit.
  - `src/app/api/license/heartbeat/route.ts:14-37`: **no secret.** The caller supplies `organization_id` + `hardware_uuid`. The service role reads `organization_licenses`, returns license state, and updates `last_heartbeat_at`. No rate limit.

## EXPECTED BEHAVIOR
- Add a dedicated `isMachineApiPath()` (exact prefixes: `/api/cron/`, `/api/mission/`, `/api/ops/command`, `/api/audit/`) that the middleware lets through without a session. Each route's own check returns 401.
- **`/api/license/*` needs a separate decision.** heartbeat has no secret, and neither heartbeat nor provision has a rate limit. Either:
  - (a) add `isRateLimitedDurable` (keyed by IP, plus org for heartbeat) to heartbeat and provision in this PR and then open `/api/license/`, **or**
  - (b) leave `/api/license/*` behind the middleware and record it as an open item for the owner.
  Default: **(b)**, unless the owner approves (a). This gap is recorded in `S2_SPEC_ISSUES.md`.
- `middleware.test.ts` is updated: machine paths without a session are **not** 307. Owner/desk paths are still 307 for signed-out users.
- No other public-path change.

## FILES (in scope)
- `src/middleware.ts`
- `src/middleware.test.ts` (replace the `/api/cron/anything`, `/api/ops/command` expectations)
- NEW or extended route tests for the 6 routes (401 without a credential), e.g. `src/app/api/cron/journey-recompute/route.test.ts`
- Only if option (a) is approved: `src/app/api/license/{heartbeat,provision}/route.ts` + tests

## DATABASE ENTITIES
None directly (the routes' own writes are unchanged). Once the crons are reachable, `marketing_kpi_weeks` and the journey recompute will run again (observable by the owner).

## DEPENDENCIES
- **TMMT-SEC-005 (mission-daily owner-only default) MUST be merged first.** Otherwise opening `/api/mission/*` re-arms the daily team broadcast. State this in the PR and check it.
- Owner decision on option (a)/(b) for `/api/license/*`.
- Related: TMMT-BUILD-006 (the duplicate journey recompute). Once the Vercel cron works again, the recompute runs twice until BUILD-006 lands. Tell the owner.

## CONSTRAINTS
- Exact prefix matching (no `startsWith("/api/")` shortcuts). Do not open `/api/pocket/*`, `/api/offline/*`, `/api/rental/*`, `/api/cube/*`.
- Do not change the routes' auth logic (except option (a)).
- Do not change tier rules (`pathAllowedForTier`).

## SECURITY REQUIREMENTS
- Every newly reachable route must authenticate by itself. List each route and its check in the PR; this is the "public path = public write path" writer audit.
- A route whose secret env is unset returns 401/500, never success (verify `ops/command` returns 500 when unset; acceptable).
- Tests prove 401 for: no header, wrong secret, and a **signed-in non-owner session cookie without a secret** (a session must not substitute for the machine secret).

## IMPLEMENTATION NOTES
- Keep `isPublicPath` for pages; add the machine check next to it in the `!user` branch so tier rules for signed-in users are not affected. Consider a signed-in user hitting `/api/cron/*`: it should also reach the route (401 without a secret), not a tier redirect.

## ACCEPTANCE CRITERIA (testable)
1. For each of `/api/cron/journey-recompute`, `/api/cron/marketing-kpi-ghl`, `/api/mission/generate`, `/api/ops/command`, `/api/audit/events`: the middleware does not redirect a session-less request.
2. For each: the route handler returns 401 without a credential and with a wrong credential.
3. `/customers`, `/command`, `/money`, `/api/pocket/chat`, `/api/offline/merge` still 307 to `/login` when signed out.
4. `/api/license/*` behaves per the recorded option.
5. The PR shows TMMT-SEC-005 merged (commit ref).
6. The full gate passes.

## TESTS (must fail on the pre-fix code)
- `middleware.test.ts`: `machine API paths are not redirected to login` (table over the 5 paths); fails pre-fix.
- Route tests: `<route> returns 401 without secret`, `<route> returns 401 with wrong secret`, `<route> ignores a session cookie without the secret`.
- Regression: `owner and desk paths still redirect signed-out users`.

## DO NOT CHANGE
- `pathAllowedForTier`, tier homes, other public paths, the mission route and libs, webhook routes.

## OWNER GATE
Owner decision (`/api/license/*` option) + merge = deploy (owner + baton). Pre-condition: TMMT-SEC-005 merged.
