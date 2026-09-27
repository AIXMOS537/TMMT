# TMMT-AUTH-002

## TASK ID
TMMT-AUTH-002

## TITLE
A real `customer` access tier with a home page that shows only the signed-in person's own records (interim key: `current_profile_email()`)

## PM MILESTONE
PM-19 Customer identity and access path (roadmap new-build items 2 and 4; the spine-keyed RLS is deferred, see `S2_SPEC_ISSUES.md` SI-10)

## OBJECTIVE
A signed-in renter or credit client lands on a customer home instead of `/no-access`, and sees only rows that belong to them. This is the first customer face in canon and the prerequisite for the portal port (PM-16a).

## WHY (evidence refs)
- SPEC §2.1 (tier `none` ← `customer`; "No working customer path"), §2.3, §5.16 (foundation: `client_journey`, `client_renter_status`, `current_profile_email()` helpers, `vehicle_media.visible_to_client`), §23.1, §28 **KD-08**; ROADMAP PM-19 ("A `customer` tier home (not `/no-access`)"); E2 §2.1–§2.2; E5 §A.1 (`current_profile_email()` self-read on credit tables).

## CURRENT BEHAVIOR (file:line)
- `src/lib/auth-roles.ts:14-25` `APP_ROLE_TOKENS` includes `customer`; `:33-51,97-106` maps `customer` → tier `none`; `:134-147` `homePathForTier("none")` = `/no-access`.
- `src/middleware.ts:108-155` tier `none` allow-list: `/no-access`, `/clock`, `/pocket/*`, public.
- DB: `profiles.role` value `customer` exists (`src/lib/db-vocab.ts:48-54`). Self-read policies keyed on `current_profile_email()` exist on credit tables and on `vehicle-media` (E3 §4, E5 §A.1). `client_renter_status` is a view over `client_journey` + `renter_pipeline_status`; `client_journey.customer_email` is the join key (E3 §1.1).
- There is no `/client*` route in canon; the archive's `(client)/client/*` is a port candidate (E2 §5).

## EXPECTED BEHAVIOR
- New tier **`customer`** (JWT `customer` → `customer`; missing/unknown stays `none`). Home = a constant `CUSTOMER_HOME_PATH` in `auth-roles.ts`, default `/client` **pending the URL-shape OWNER DECISION** (PM-16a); the decision is requested in the PR and the constant is the only place to change.
- Middleware allow-list for `customer`: its home, `/status/`, `/intake*`, `/learn/*` (client credit face — **only if** the (learn) layout is verified to show no staff data; otherwise leave it out and record why), `/pocket/*`, `/clock`, public. Nothing under `(admin)`, `(command)`, portals.
- A minimal server-rendered home page (SSR user client, RLS-enforced): the person's journey/status via `client_renter_status` where `customer_email = current_profile_email()` (existing policy pattern), an empty state when no row matches ("Nothing on file yet. If you applied recently, we are still setting things up."), loading and error states, mobile first, token UI kit, no score/financing claims.
- **Interim key = email text.** The page and the PR state that person-spine-keyed RLS replaces it later (GHL M5 / PM-02) and that email is only trusted because `profiles.email` is a protected column (prod trigger `profiles_block_protected_self_edits`, E5 §C.2).
- `/whoami` becomes reachable for `customer` and `none` (R6 diagnostic).

## FILES (in scope)
- `src/lib/auth-roles.ts` (+ `auth-roles.test.ts`), `src/middleware.ts` (+ test)
- NEW `src/app/(client)/layout.tsx`, `src/app/(client)/client/page.tsx`, `loading.tsx`, `error.tsx` (route name per the constant)
- NEW `src/lib/client-portal/queries.ts` (+ test with a real request shape, not `fake-supabase` alone)
- Route registry CSV rows

## DATABASE ENTITIES
Read-only: `client_renter_status`, `client_journey`, `profiles` (email). If `client_renter_status` has **no** policy allowing `current_profile_email()` reads (verify in the snapshot), add a **staged** SELECT policy on `client_journey` for `authenticated` where `customer_email = current_profile_email()` + rehearsal (hostile user sees 0 rows). No other schema.

## DEPENDENCIES
- **TMMT-AUTH-001** (public customer pages) and **TMMT-ADR-001 ADR-02** (role source: the tier reads the JWT; the DB reads `profiles.role`; both must say `customer` for the same person — the sync is ADR-02's problem; until then the PR documents how a customer profile is created consistently, coordinate with Phase 2A A4b).
- TMMT-BUILD-003 snapshot (view definition and policies).
- OWNER DECISION: URL shape (PM-16a).

## CONSTRAINTS
- No writes from the home page in this task.
- No data beyond the person's own; no vehicle or payment detail (those are PM-16c after PM-05/06).
- Do not port archive pages here (PM-16).

## SECURITY REQUIREMENTS
- Tests: hostile authenticated `customer` with an email matching no row → empty; customer A cannot see B (two-customer rehearsal); staff/owner tiers unaffected; anon redirected to `/login`.
- Server-side data only (no browser anon client for customer data).
- Do not expose `client_journey` columns beyond a curated select list.

## IMPLEMENTATION NOTES
- Email comparison must be lower-cased on both sides (E3 §1.2: joins are by lower-cased email).
- Keep the home page text at a simple reading level; "Pending verification" language for anything not verified.

## ACCEPTANCE CRITERIA (testable)
1. A `customer` JWT lands on `CUSTOMER_HOME_PATH`, not `/no-access` (fails pre-fix).
2. The page renders the person's own status row and the empty state when none.
3. Two-customer rehearsal: A sees 0 of B.
4. `customer` cannot open `/desk`, `/command`, `/bookings` (307).
5. Route registry rows added; full gate passes.

## TESTS (must fail on the pre-fix code)
- `auth-roles.test.ts`: `customer maps to tier customer with its own home` (fails pre-fix: today `none` → `/no-access`).
- `middleware.test.ts`: `customer tier allow-list` (fails pre-fix).
- `client-portal/queries.test.ts` + PGlite rehearsal `customer-self-read.rehearsal.mjs`: `customer A cannot read B`, `hostile customer sees empty`.

## DO NOT CHANGE
- Staff/owner/operator tier rules (TMMT-AUTH-003 handles operator); `profiles` protected columns (Phase 2A); credit files; the `/status/[token]` token flow.

## OWNER GATE
Owner decision (URL shape; ADR-02). Any staged policy needs the prod baton. Merge = deploy: owner + baton.
