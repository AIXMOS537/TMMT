# TMMT-AUTH-004

## TASK ID
TMMT-AUTH-004

## TITLE
Server-issued customer invitation / claim flow tied to an existing lead, application or booking, without reopening AUTH-SIGNUP-001

## PM MILESTONE
PM-19 Customer identity and access path (roadmap new-build item 3)

## OBJECTIVE
Staff can invite a specific person (an existing `incoming_leads` / `background_checks` / `bookings` record) to create a customer account; the account is bound to that record; nobody can self-register into a customer role without the invite.

## WHY (evidence refs)
- SPEC §5.17 (acceptance: "signup cannot create an account without a server-issued invite"), §20.1, §20.3 **SEC-02**, §28 **KD-02**; ROADMAP PM-19 ("It must be server-issued and must not reopen AUTH-SIGNUP-001"), PM-16b (T08 dealer-admin invite → `signup-invite.ts`); E5 §C.1 (`login/actions.ts:51,61,108-114,130`; `signup_invites` 0 rows; GoTrue signup state UNKNOWN); E6 (T08 invite flow rescued; `src/lib/invites/` never captured).

## CURRENT BEHAVIOR (file:line)
- `src/app/(auth)/login/actions.ts:51` checks an invite code (durable limit 10/h/IP at `:61`), claims it at `:108-114`, then calls **public** `supabase.auth.signUp` at `:130`. `src/lib/signup-invite.ts` mints/claims codes against `signup_invites` (0 rows; RLS on, 0 policies → service role only).
- No DB hook binds a new `auth.users` row to an invite; a direct `POST /auth/v1/signup` bypasses the app check when GoTrue signup is enabled (Phase 2A A4a toggle UNKNOWN; A4b = server-side `admin.createUser`).
- `profiles.role` / `email` / `organization_id` are protected from self-edit (prod trigger, E5 §C.2), so a self-signed-up user cannot promote themselves; they would still be a `customer`-less `none` account.
- The T08 rescue has `agency/invite-actions.ts`, `invite-dealer-admin-form.tsx` (dealer admins), not customers.

## EXPECTED BEHAVIOR
- Staff action `inviteCustomer({ leadId | backgroundCheckId | bookingId })` (server, `isStaffUser`, org-scoped): validates the record belongs to the caller's org, mints a `signup_invites` row with `role='customer'`, `org_id`, the bound record ref, expiry and single use, and returns a link **for staff to send through the gated channel** (PM-18) — this task does **not** send anything.
- Claim: the invite code path in `login/actions.ts` sets `app_metadata.role='customer'` and `profiles.role='customer'`, `organization_id`, and links the bound record (write the `profile_id`/email link on the bound table only if a column exists in the snapshot; otherwise record the link on `signup_invites` and stop — do not invent columns).
- **Prefer A4b**: creation through `supabase.auth.admin.createUser` (service role, server-only) with the invite, so the public `signUp` call is no longer used by the app. Coordinate with Phase 2A; if A4b is implemented there, reuse it and only add the customer binding.
- If GoTrue public signup is still on, the PR states it and the owner action remains (2A-A4a). Do not claim the gate is closed.

## FILES (in scope)
- `src/lib/signup-invite.ts` (+ test), `src/app/(auth)/login/actions.ts` (claim branch only; coordinate 2A), NEW `src/app/(admin)/customers/invite-actions.ts` (+ test)
- A minimal staff UI entry (button on `/background-checks` or `/bookings` detail) using the token kit
- Possibly a staged migration adding `role`, `org_id`, `bound_ref` columns to `signup_invites` **only if absent in the snapshot** (+ rehearsal)

## DATABASE ENTITIES
`signup_invites` (service-role only today), `profiles`, `auth.users` (via admin API), read: `incoming_leads`, `background_checks`, `bookings`.

## DEPENDENCIES
- **Phase 2A A4a/A4b is the authoritative account-provisioning / auth architecture.** This task is **BLOCKED on a written answer from the Phase 2A owner** before any edit to `src/app/(auth)/login/actions.ts` or any use of `auth.admin.createUser`: either (i) A4b exists or is scheduled — then this task adds **only** the customer binding (`role='customer'`, org, bound record) on top of A4b's path, or (ii) the 2A owner hands the createUser path to this task in writing — then it is built here once, and 2A references it. There is no option (iii) "build a parallel invite/auth system". AUTH-SIGNUP-001 (SEC-02) stays OPEN / OWNER ACTION regardless of this task; this task never claims to close it.
- TMMT-AUTH-002 (the `customer` tier must exist for the claimed account to land somewhere).
- TMMT-DATA-003 helper for the org check (or `profiles.organization_id` interim).
- OWNER DECISION: who may invite (staff vs owner only).
- PM-16b's dealer-admin invite (T08) will fold into the same `signup-invite.ts`; keep the customer path shaped so that reuse is one function, not a second module.

## CONSTRAINTS
- **STOP boundary:** if the smallest correct change means writing a new signup/auth path instead of binding to A4b's, stop and report; do not proceed.
- No sends. No customer-facing email/SMS in this task (PM-18).
- Invite links carry a random, single-use, expiring code; never the person's email in the URL.
- Do not weaken the durable rate limit on the claim path.

## SECURITY REQUIREMENTS
- Tests: hostile authenticated user cannot mint; staff of org B cannot invite org A's lead; an expired/used code is refused; the claimed account cannot end with any role but `customer`.
- Service role only in server actions; never returned to the client.
- PII: log invite ids, never emails.

## IMPLEMENTATION NOTES
- `signup_invites` has RLS on with 0 policies (E5 §C.3) — keep it service-role only; all access via server actions.
- Respect the protected-columns trigger: the service role sets `profiles.role`, not the user.

## ACCEPTANCE CRITERIA (testable)
1. Staff of the lead's org can mint an invite; other-org staff and hostile authenticated cannot (fails pre-fix: no such action).
2. Claiming creates/updates a `customer` account bound to the record; a second claim is refused.
3. The public `signUp` call is no longer reached by the app path (or the PR records why it must remain and the owner's A4a decision).
4. Two-org + hostile tests pass; full gate passes.

## TESTS (must fail on the pre-fix code)
- `invite-actions.test.ts`: `mints for own org`, `refuses other org`, `refuses hostile authenticated`.
- `signup-invite.test.ts`: `single use`, `expiry`, `role fixed to customer`.
- Claim path test with mocked admin API: `claimed profile role is customer and org set`.

## DO NOT CHANGE
- `profiles` protected-column trigger; GoTrue settings (owner); `partner_acquisition`; the dealer-admin invite (PM-16b folds T08 later).

## OWNER GATE
Owner decision (who may invite; A4a toggle). Any staged migration: prod baton. Merge = deploy: owner + baton.
