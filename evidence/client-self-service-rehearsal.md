# REHEARSAL — client self-service + org-scoped sensitive access

Migration: `supabase/migrations/20260916230000_client_and_org_scoped_sensitive_access.sql`

**Run 2026-09-16 against Supabase project `xcjuohpmtdywgzdxkssb` (`tmmt-e2e-throwaway`).**
**Production `uapxakmlwnpfsftfeezx` was READ ONLY throughout. Nothing was applied to it.**

The throwaway project was created 2026-09-15 with the full schema cloned and had sat
empty — 0 rows in every table. This is the first time it has been used.

## Fixture

Two tenants, two members, **neither an admin and neither internal_team** — that is the
whole point of the exercise. `is_platform_admin()` and `is_staff()` were asserted false
for the test session before any other assertion was trusted.

| Org | Member | background_checks | customer_payments |
|---|---|---|---|
| Alpha Rentals | `alpha.member` (`org_roles` only) | 4 (pending · DOCUMENT_ADMIN · DNC_DNR · expired token) | 1 |
| Bravo Motors | `bravo.member` (`org_roles` only) | 1 | 1 |

Every background-check row was seeded with a non-null `review_notes` and
`background_check_screenshot` so any leak of either would show up.

## Org scoping — "new org members get access to only their own information"

| # | Assertion | Expected | Got |
|---|---|---|---|
| T1/T3 | Alpha member reads Alpha rows | 4 | **4** ✅ |
| T2 | Alpha member reads Bravo background checks | **0** | **0** ✅ |
| T4 | Alpha member reads own payments | 1 | **1** ✅ |
| T5 | Alpha member reads Bravo payments | **0** | **0** ✅ |
| T6 | Alpha member is NOT a platform admin | false | **false** ✅ |
| T7 | Alpha member is NOT staff | false | **false** ✅ |

T6/T7 matter: granting admin to make the reads pass would have defeated the test.

## The renter gate — "their own, once it comes back"

| # | Assertion | Expected | Got |
|---|---|---|---|
| R1 | Pending row leaks no decision | `pending`, elig/reason/date all NULL | **exactly that** ✅ |
| R2 | `DOCUMENT_ADMIN` reason IS shown | label + recoverable=true | **shown** ✅ |
| R3 | **`DNC_DNR` reason is REFUSED** | reason NULL, description NULL | **NULL / NULL** ✅ |
| R4 | Expired token | no row | **no row** ✅ |
| R5 | Unknown token | no row | **no row** ✅ |

**R3 is the one that matters.** `reason_categories` carries `customer_msg = false` on
`DNC_DNR`, `FRAUD_SECURITY` and `OTHER`. Without the join gate, this path would have
told a renter they are on a do-not-rent list. It was watched refusing, per
`gate-must-be-seen-refusing`.

## Negative controls

| # | Assertion | Got |
|---|---|---|
| N1 | `anon` / `authenticated` may call `client_bg_status` | **false / false** ✅ (service_role only) |
| N1b | `anon` may call either staff queue | **false / false** ✅ |
| N2 | Platform admin still sees ALL background checks (no back-office regression) | **5 of 5** ✅ |
| N3 | Platform admin still sees ALL payments | **2 of 2** ✅ |
| N4 | `payment_method` is reduced to type only | stored `Visa 4111111111111111` → **`Visa`** ✅ |

N4 is the PII control: the stored card number never crosses the RPC boundary.

## Middleware

`/status/<token>` was **not** in `isPublicPath`, so every renter would have been
redirected to a login they can never pass. Added, and pinned by a test in
`src/middleware.test.ts`. **Verified the test fails without the fix** — removing the one
line produced `1 failed | 453 passed`, restoring it produced `454 passed`.

## Suite

`npx vitest run` → **108 files / 1,707 tests, all passing.** `tsc --noEmit` exit 0.
`eslint` clean on every touched file.

## NOT DONE — and why

**The renter's own payments are not exposed, deliberately.** Verified on production:

- `background_checks.lead_id` — **0 of 299 populated**
- `customer_payments.incoming_lead_id` — **0 of 31 populated**

There is no join key between a renter's screening record and their payments. The only
remaining candidate is phone-string matching, measured on production:

- only **13 of 31** payments match any background check by normalised phone (58% miss)
- **16 phone numbers appear on more than one `background_checks` row**
- at least one payment matches **two different** background-check rows

Shipping that would show one renter another renter's payment history. Per prime
directive 5 — refuse rather than guess — the payments half stops here until an explicit
customer identity link exists. **This is an owner/data decision, not a coding task.**
