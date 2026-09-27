# TMMT-AUTH-003

## TASK ID
TMMT-AUTH-003

## TITLE
Fix the operator sign-in loop (R2), the "Dashboard" link to marketing (R4), the portal nav leak with the literal `__MARKETING_SITE__` (R5), and link or retire the six orphaned screens (R6)

## PM MILESTONE
PM-19 Customer identity and access path (roadmap new-build item 5: "Fix operator home (R2), Dashboard link (R4) and portal nav leak (R5). Link or retire the orphaned screens (R6)")

## OBJECTIVE
Every tier lands on a working home, the desk has a nav link, and portal users see only links they can use.

## WHY (evidence refs)
- SPEC §2.1 (operator: "home loops"), §6.4, §28 **KD-15**, **KD-30**, **KD-44**; READINESS §3 #3, #12, §10.3 #3, #6; ROADMAP PM-19; E2 **R2** (`(admin)/layout.tsx:37-38`, `auth-roles.ts:97-106,134-147`, pinned by `auth-roles.test.ts:41`), **R4** (`Sidebar.tsx:43`, `command-hub-nav.ts:49`), **R5** (`CommandHubNav.tsx:6,8`, `PortalChrome.tsx:45`, `command-hub-nav.ts:42,137-142`), **R6** (`/command/outbox`, `/operators/onboard`, `/dispatch/me`, `/dispatch/units`, `/dispatch/responders`, `/whoami`).

## CURRENT BEHAVIOR (file:line)
- R2: `homePathForTier("operator")` = `/desk` (`auth-roles.ts:134-147`); `(admin)/layout.tsx:37-38` redirects non-`isStaffUser` to `homePathForTier(tier)` = `/desk` → loop. Middleware allows operators on desk paths. Whether operator accounts exist in prod: UNKNOWN (E2 §6).
- R4: "Dashboard" → `/` in `Sidebar.tsx:43` and `command-hub-nav.ts:49`; signed-in `/` renders the public front door since `2495c0a2`; `/desk` has no nav link.
- R5: `PortalChrome.tsx:45` renders `CommandHubNav`, which uses raw `commandHubSections` (`CommandHubNav.tsx:6,8`) instead of `commandHubSectionsFor` (`command-hub-nav.ts:137-142`); `command-hub-nav.ts:42` carries `__MARKETING_SITE__`.
- R6: six screens with no inbound `href`.

## EXPECTED BEHAVIOR
- R2: `homePathForTier("operator")` = `/operator`. `auth-roles.test.ts:41` updated. The `(admin)` layout keeps rejecting non-staff.
- R4: "Dashboard" → `/desk` in both nav definitions for staff/owner; the owner's hub keeps `/command`.
- R5: `CommandHubNav` receives the tenant-aware sections (`commandHubSectionsFor(tenant, tier)` — extend the signature to filter by tier if it filters by tenant only) so portal users (executive, investor, operator, vendor) see only routes their tier may open; the `__MARKETING_SITE__` placeholder resolves to the tenant marketing URL or is omitted.
- R6: per an OWNER DECISION recorded in the PR: link `/command/outbox` from the owner hub (it becomes the PM-18 approval queue), link `/operators/onboard` from `/operators`, link the three dispatch screens from the cockpit or mark them retired (`notFound()` + registry status), make `/whoami` reachable to every tier (diagnostic).
- One nav definition per face is the PM-16 target; here only fix the entries. Do not merge the three definitions.

## FILES (in scope)
- `src/lib/auth-roles.ts` + test
- `src/components/Sidebar.tsx`, `src/lib/command-hub-nav.ts` (+ test), `src/components/CommandHubNav.tsx`, `src/components/PortalChrome.tsx`
- `src/app/(command)/operators/page.tsx`, dispatch cockpit nav (links only), `src/middleware.ts` allow-list for `/whoami` (+ test)
- Route registry CSV rows (status changes)

## DATABASE ENTITIES
None.

## DEPENDENCIES
- TMMT-AUTH-002 if the tier list changes shape (add `customer` to the nav filter); otherwise independent.
- Owner decision on the R6 items.

## CONSTRAINTS
- No new screens. No changes to `pathAllowedForTier` except `/whoami`.
- The operator portal's feed reads ghost `ops_messages` (X3); fixing the home stops the loop but the feed still errors until TMMT-DATA-002 / ADR-05. The PR says so.

## SECURITY REQUIREMENTS
- Nav filtering is **not** authorization; middleware and layouts still decide. A test proves an owner-only link is absent from the executive nav **and** that the route still 307s if typed.

## IMPLEMENTATION NOTES
- `commandHubSectionsFor` already handles tenant; add a `tier` parameter with a pure function and unit-test the matrix (5 portal tiers × sections).

## ACCEPTANCE CRITERIA (testable)
1. Operator JWT → `/operator`, no loop (fails pre-fix).
2. Sidebar "Dashboard" href is `/desk` (fails pre-fix).
3. Executive/investor/operator/vendor navs contain no `/command`, `/operators`, `/money` links and no `__MARKETING_SITE__` (fails pre-fix).
4. Each R6 screen has an inbound link or a recorded retirement; `/whoami` opens for tier `none`.
5. Full gate passes.

## TESTS (must fail on the pre-fix code)
- `auth-roles.test.ts`: `operator home is /operator` (replaces the pin at `:41`; fails pre-fix).
- `command-hub-nav.test.ts`: `portal navs exclude owner-only sections`, `no placeholder hrefs` (fail pre-fix).
- `Sidebar` static test: `dashboard links to /desk` (fails pre-fix).
- Static link test: `every non-retired page has an inbound href` (scans `src/`, asserts non-zero pages scanned).

## DO NOT CHANGE
- Layout guards (`isStaffUser`), middleware tier rules beyond `/whoami`, `config/tailor.json` (owner-managed), the dispatch cockpit itself.

## OWNER GATE
Owner decision on R6 dispositions. Merge = deploy: owner + baton.
