# TMMT-AUTH-001

## TASK ID
TMMT-AUTH-001

## TITLE
Middleware: make `/intake`, `/intake/[business]`, `/intake/thanks` and `/status/[token]` reachable by signed-out visitors and by `customer` accounts (fix R3), with a writer audit of every action behind them

## PM MILESTONE
PM-19 Customer identity and access path (roadmap new-build item 1: "make `/intake*` and `/status/[token]` public (fix R3); consistent with ONE_PROJECT_PLAN Phase 1")

## OBJECTIVE
A renter who follows a staff-minted status link, or a visitor who clicks "Submit a request", must reach the page instead of `/login` or `/no-access`. The pages' write paths must be audited before they become public, because a public path is a public write path.

## WHY (evidence refs)
- SPEC §2.1 (tier `none` denied `/status/[token]`, `/intake`), §5.16, §5.17, §6.3 (4 customer pages login-walled), §28 **KD-08**, X6 (ONE_PROJECT_PLAN said `/intake` was public; code says no; code wins); READINESS §3 #1; ROADMAP PM-19; E2 **R3** (`src/middleware.ts:47-67,108-155,266-279,316-320`; `trust/page.tsx:112` links to intake).

## CURRENT BEHAVIOR (file:line)
- `src/middleware.ts:47-69` `isPublicPath` (+ `:11-31` `isFunnelPublicPath`) do not include `/intake` or `/status`. `:266-279`: no user + not public → 307 `/login`. `:316-320`: tier `none` outside its allow-list → `/no-access`.
- `/status/[token]` page: `src/app/status/[token]/page.tsx` reads by the staff-minted token (`client_renter_status` view, `client_journey`; `src/lib/client-self-service.ts`); actions in `src/app/status/opt-in-actions.ts` (writes: opt-in flags on `client_journey`; confirm exact tables from the code). `FinancingReadinessPanel` renders education only.
- `/intake*` pages: `src/app/intake/page.tsx`, `intake/[business]`, `intake/thanks`; actions `src/app/intake/actions.ts` (`web-intake-hub`: durable limiter; **action not session-gated per the registry**, E4 §3).
- Tier rules: `pathAllowedForTier` (`middleware.ts:108-155`) lists `/intake` and `/status` for staff/executive/operator but not for `none`.

## EXPECTED BEHAVIOR
- `isPublicPath` includes `/intake`, `/intake/` and `/status/` (exact prefixes). Signed-out GET reaches the pages.
- Tier `none` (and the `customer` tier once TMMT-AUTH-002 lands) may open `/status/[token]` and `/intake*`.
- **Writer audit** (in the PR, one line per action): for `opt-in-actions.ts` and `intake/actions.ts`: what it writes, which client (anon / SSR user / service role), what authorizes it (the token, the session, nothing), what rate limit applies. Any action that writes with the **service role** and is authorized by nothing but "the page loaded" must get: a durable rate limit (`isRateLimitedDurable`) **and** a binding to the token (for status) or a zod-validated, capped payload (for intake). If a required fix is larger than S, STOP and split.
- The token path stays single-use / expiring as it is today (do not weaken).
- Middleware matrix test updated: signed-out → 200 (no redirect) on the 4 routes; tier `none` → allowed; owner/staff unchanged.

## FILES (in scope)
- `src/middleware.ts`, `src/middleware.test.ts`
- `src/app/status/opt-in-actions.ts`, `src/app/intake/actions.ts` (only if the audit requires a limiter/binding)
- NEW or extended tests for those actions

## DATABASE ENTITIES
Read-only in this task: `client_journey`, `client_renter_status` (view), `incoming_leads` / intake tables written by `intake/actions.ts` (list them from the code). No schema change.

## DEPENDENCIES
- **TMMT-BUILD-001** touches the same `!user` branch of the middleware; land BUILD-001 first (or rebase) to avoid conflicting edits.
- **PM-00 00-b** (signup policy) is not a blocker for making pages public, but note that public pages + open signup + any `authenticated true` policy compound (SEC-02).
- Coordinate with GHL M8/M10: `web-intake-hub` will move under the universal intake contract; do not redesign the action here, only gate it.

## CONSTRAINTS
- Exact prefixes; do not open `/status` bare (it is a `next.config.ts:21-29` rewrite to `/learn/*`, E2 §1.1) — open `/status/` (with the trailing slash, i.e. the token form) only.
- Do not change tier homes (TMMT-AUTH-002/003).
- No new public path beyond the four.

## SECURITY REQUIREMENTS
- Every newly public write path is listed with its authorization and rate limit ("public path = public write path").
- Status token must not be guessable or enumerable; do not add any listing endpoint.
- Tests include a hostile authenticated user (tier `none`, no token) attempting the status action without a valid token → refused.

## IMPLEMENTATION NOTES
- Keep the change to `isPublicPath` + the tier allow-list minimal; the tier × route matrix test (TMMT-AUTH-005) will pin it.

## ACCEPTANCE CRITERIA (testable)
1. Signed-out `GET /status/<token>` and `GET /intake` → not redirected (fails pre-fix).
2. A `customer` JWT → not `/no-access` on the four routes (fails pre-fix).
3. `/customers`, `/command`, `/desk` still redirect signed-out users.
4. The writer audit table is in the PR; any service-role action reachable from the four pages has a durable limiter and a binding.
5. Full gate passes.

## TESTS (must fail on the pre-fix code)
- `middleware.test.ts`: `status and intake pages are public` (table over the 4 paths; fails pre-fix); `tier none may open status/intake` (fails pre-fix); regression `owner/desk paths still redirect`.
- Action tests: `status opt-in refuses without a valid token`; `intake action is rate limited`.

## DO NOT CHANGE
- `homePathForTier`, `pathAllowedForTier` beyond the `none` allow-list; machine-route handling (BUILD-001); the token minting code; credit files.

## OWNER GATE
None for the code beyond the audit review. Merge = deploy: owner + baton.
