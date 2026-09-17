# REHEARSAL — financing_applications + ownership opt-in

Migration: `supabase/migrations/20260917000000_financing_applications_and_ownership_optin.sql`

**Run 2026-09-16 on `xcjuohpmtdywgzdxkssb` (`tmmt-e2e-throwaway`). Production untouched.**

## What it closes

| Gap | Before | After |
|---|---|---|
| Nothing recorded that a renter WANTS to own | ladder was a report nobody opted into | `client_journey.ownership_opt_in_at` |
| Nothing recorded a lender's decision | `financingApproved` permanently null → `pending` forever | `financing_applications` |

## Constraints, watched refusing

| # | Attempt | Result |
|---|---|---|
| R1 | `outcome='approved'` with **no `decided_at`** | **REFUSED** (check_violation) ✅ |
| R2 | `outcome='definitely_approved'` — outside the taxonomy | **REFUSED** (check_violation) ✅ |
| R3 | `decline_reason_category='NOT_A_REAL_CATEGORY'` | **REFUSED** (foreign_key_violation) ✅ |
| — | valid pending + valid declined rows | landed ✅ |
| — | `ownership_opt_in_at` set on one journey | landed ✅ |

R1 matters most: a decision with no date is unauditable, and an approval is the thing that
hands over a car.

**A fourth refusal happened unplanned and is worth recording:** the first attempt at the
valid declined row used `CREDIT_FINANCIAL`, which is not seeded in the throwaway. The FK
rejected it. The constraint caught the test's own bad data before it caught anyone else's.

## Tenant isolation

As the Alpha member (non-admin, non-staff, one `org_roles` row):

| Assertion | Expected | Got |
|---|---|---|
| sees own org's application | 1 | **1** ✅ |
| sees Bravo's application | **0** | **0** ✅ |
| total visible | 1, not 2 | **1** ✅ |

## Code

`loadLadderEvidence` now reads the verdict from `financing_applications` and nowhere else:

- `approved` → `true`
- `declined` / `withdrawn` / `expired` → `false`
- `pending`, or **no application at all** → `null`

Both null cases collapse deliberately: neither is the renter's failure, and **silence is
never approval**. A read error also returns null and logs — the table may not exist in an
environment where the migration has not run, and that must not take the renter's page down
or fabricate an approval.

Pinned by 7 tests, including *"internal progress can never produce an approval"*: every
internal source fully satisfied and 365 days of good standing still yields `pending`.

## The opt-in

`optInToOwnership(token)` is **renter-initiated only** — written from their own link, never
on their behalf. Staff opting someone in would make the journey's consent record worthless.
It is idempotent: re-pressing does not move the date, guarded both by a read-check and an
`.is("ownership_opt_in_at", null)` filter against a concurrent press.

The page only shows the ladder and readiness **after** opt-in. A renter who never asked for
this does not arrive at a page grading their credit.

## Not applied to production

The prod apply was **blocked by the safety classifier** and was not worked around. The
migration, this rehearsal and the rollback for the earlier change
(`docs/repairs/20260916-bg_check_queue.rollback.sql`) are ready for an owner-approved run.
