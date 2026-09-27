# TMMT-AUTH-005

## TASK ID
TMMT-AUTH-005

## TITLE
Tier × route-group matrix test in CI: every tier (7 + `customer` + signed-out) against every route group and the machine APIs

## PM MILESTONE
PM-19 Customer identity and access path (exit criterion: "A tier × route matrix test in CI covers all 7 tiers plus signed-out"); also SPEC §25.2 Permissions gate

## OBJECTIVE
One table-driven test pins who may reach what, so every later middleware or tier change is caught.

## WHY (evidence refs)
- SPEC §5.17 (acceptance: "Middleware matrix test for every tier × every route group"), §25.2 (Permissions: 7 tiers × 12 groups + machine APIs), §31.2 DoD #6; ROADMAP PM-19 exit; E2 §2.2 (the effective matrix = middleware ∩ layout guard).
- `src/middleware.test.ts` exists but pins individual cases (and today pins wrong behaviour for machine routes, `:237-243`).

## CURRENT BEHAVIOR (file:line)
- `src/middleware.ts:108-155` `pathAllowedForTier`; `:266-279` signed-out redirect; `:316-320` no-access; owner-hub host check (`isOwnerHubHost`).
- `src/lib/auth-roles.ts:33-51,97-106,134-147` tier derivation and homes.
- Layout guards: `(admin)/layout.tsx:37-38` (`isStaffUser`), `(command)/dispatch/layout.tsx:15-17` (`org_roles`), `(command)/layout.tsx` (none; relies on middleware), `/operators` page check.
- Tests: `middleware.test.ts`, `auth-roles.test.ts` (case lists, not a matrix).

## EXPECTED BEHAVIOR
- NEW `src/middleware.matrix.test.ts`: a matrix `tiers × representative routes` (one or two per route group: `(admin)`, `(auth)`, `(command)`, `/dispatch`, `/operators`, `(executive)`, `(investor)`, `(learn)`, `(operator)`, `(partner)`, `(pocket)`, `(program)`, `(vendor)`, `(client)` once it exists, public/forms/lp/legal, `/status/`, `/intake`, machine APIs) with the expected outcome per cell: `allow`, `redirect:/login`, `redirect:/no-access`, `redirect:<home>`. The expectations are taken from E2 §2.2 as of `4cca6835`, amended by the landed tasks (BUILD-001, AUTH-001/002/003).
- The test asserts the matrix has no `TODO` cells and that every route group under `src/app` appears at least once (directory scan, non-zero).
- A second table for the layout layer where the middleware lets a tier through but the layout rejects (executive on `(admin)`): tested through the layout's guard function, not by rendering.

## FILES (in scope)
- NEW `src/middleware.matrix.test.ts`, NEW `src/lib/auth/route-matrix.ts` (the table as data, exported for docs)
- `docs/saas/TENANT_ISOLATION_TEST_MATRIX.md` (link the matrix)

## DATABASE ENTITIES
None (middleware is tested with mocked sessions).

## DEPENDENCIES
- Sequence after TMMT-BUILD-001, TMMT-AUTH-001, TMMT-AUTH-002, TMMT-AUTH-003 so the expectations are the intended ones; or land first with today's matrix and update per task (either is fine; record which).

## CONSTRAINTS
- No behaviour change in this task; if the matrix reveals a wrong cell, record it in `S2_SPEC_ISSUES.md` and open a task.
- Keep runtime small (mock `createServerClient`; no network).

## SECURITY REQUIREMENTS
- The matrix includes: a **hostile authenticated user** (JWT with no `app_metadata.role`, tier `none`), the owner-hub host cases, and the machine APIs with and without a session.

## IMPLEMENTATION NOTES
- Reuse the request/session helpers from `middleware.test.ts`.
- Route group discovery: `fs.readdirSync('src/app')` for `(group)` folders; assert count ≥ **11** (the 11 parenthesised groups at `4cca6835`: `(admin)`, `(auth)`, `(command)`, `(executive)`, `(investor)`, `(learn)`, `(operator)`, `(partner)`, `(pocket)`, `(program)`, `(vendor)`; "12 groups" in SPEC §25.2 = these 11 + the ungrouped bucket, which is covered by the public/forms/lp/legal rows, SPEC §6.1). `(client)` makes it 12 once AUTH-002 lands.

## ACCEPTANCE CRITERIA (testable)
1. The matrix test runs in CI (`npm test`) and passes on the intended behaviour.
2. Flipping one expectation (e.g. `none` on `/desk` → allow) fails the test (documented in the PR).
3. Every `(group)` folder is covered (assertion).
4. The table is exported and linked from the docs.

## TESTS (must fail on the pre-fix code)
- `middleware.matrix.test.ts`: the matrix itself. Pre-fix there is no matrix; the red evidence is the deliberate flip in criterion 2.

## DO NOT CHANGE
- `src/middleware.ts`, `auth-roles.ts`, layouts (this task is test-only).

## OWNER GATE
None. Merge: owner.
