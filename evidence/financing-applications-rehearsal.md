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

---

# REHEARSAL — education acknowledgement by journey (gate 10)

Migration: `supabase/migrations/20260917010000_education_ack_by_journey.sql`
Run 2026-09-17 on the throwaway. **Production untouched.**

## The bug this started from — in my own code

`loadLadderEvidence` passed the **journey id** to two tables that key on **profile_id**
(`credit_education_acknowledgments`, `training_module_progress`). Both tables are empty, so
the reader returned null either way and the mistake was invisible. It would have surfaced
only once real data arrived — reporting every renter as having done nothing. Fixed, and the
correct key for each of the four evidence tables is now recorded in the file.

## The structural gap behind it

`credit_education_acknowledgments.profile_id` was **NOT NULL**, and verified in production:
**0 of 35 journeys carry a profile_id**, because renters have no accounts.

**Gate 10 — the FIRST gate — was unevidencable for every renter alive.** Nobody could take
a single step on the ladder.

The migration adds a nullable `journey_id`, drops the NOT NULL on `profile_id`, and adds a
CHECK requiring at least one subject — so it is strictly no weaker than before.

**The rehearsal caught the incomplete first draft.** The original migration added
`journey_id` but left `profile_id NOT NULL`, which makes a journey-only acknowledgement
impossible to insert. That only showed up on the real insert attempt.

## Constraints, watched refusing

| # | Attempt | Result |
|---|---|---|
| G1 | acknowledgement with neither journey_id nor profile_id | **REFUSED** (check_violation) ✅ |
| G2 | same renter acknowledging the same section twice | **REFUSED** (unique_violation) ✅ |
| — | renter acknowledges all 3 required sections | landed ✅ — 3 of 3, gate 10 clearable |

G2 matters: without the unique index a double-tap counts twice and a renter appears to have
completed more sections than exist.

## Also learned about the clone

The throwaway had lost primary keys, column defaults (`gen_random_uuid()`, `now()`) **and
most foreign keys** — `section_id` on the acknowledgements table has no FK there, though it
may in production. A rehearsal environment built by schema-clone is not constraint-faithful;
check before trusting a "pass" that depends on a constraint existing.

## Shipped with it

`education.ts` + a renter-facing screen: read a section, tap "I've read this", gate 10
advances. Idempotent — a second tap is success, not a duplicate. A read failure **throws**
rather than rendering zero progress, because silently showing 0 of 3 would erase work the
renter actually did.
