# THE E2E HARNESS RAN — first time, 2026-09-16

At the start of this session `e2e/customer2-tenant-isolation.spec.ts` and
`e2e/dispatch-rls.spec.ts` had **never executed**. Both open with `test.skip(...)` unless
`E2E_*` env vars are set, those vars existed only in `.env.example`, and the
`tmmt-e2e-throwaway` Supabase project created 2026-09-15 was **completely empty** — 0 rows
in every table. The dry run had been set up and abandoned.

It has now run.

## Why the throwaway and not production

`.env.local` on this machine points at **production** (`uapxakmlwnpfsftfeezx`). Running an
auth-and-read suite against the live book was not worth it, and no scoped production users
exist anyway — `org_roles` still has one row system-wide. The throwaway was seeded with two
orgs and two members who are **neither admin nor staff**, which the suite asserts first
before trusting anything else.

`TMMT_ORG` in the isolation spec became `process.env.E2E_TMMT_ORG_ID ?? <the real TMMT org>`
— a production run is unchanged, and the same invariant is now provable anywhere.

Two fixture problems had to be solved and are worth recording for the next person:
1. The schema clone had **lost every primary key and column default**. Production has them
   (verified); the clone did not.
2. Manually-inserted `auth.users` rows produce `Database error querying schema` on sign-in
   until the token columns are `''` rather than NULL.

## RESULT 1 — `customer2-tenant-isolation.spec.ts`: **8 passed, 2 failed**

**The 2 failures are the ones the spec's own docstring predicted**, written 2026-09-08:

> `customer_payments own FAIL · cross PASS` · `background_checks own FAIL · cross PASS`
> *"The two own-org failures are the Customer #2 blocker."*

So the P0-1 blocker is now **reproduced live** rather than inferred from reading policies.

**Every cross-tenant assertion passed.** Neither org could read the other's vehicles,
tickets, payments or background checks. That is the security property, and it holds.

## RESULT 2 — `masked-rpc-access.spec.ts`: **4 passed**

The two own-org failures above are NOT fixed by widening the RLS policy — the admin-only
lock is deliberate hardening from `20260828000000`, and reversing it would expose raw
licences, paystubs and insurance payloads to every member of every org. The architecture's
answer is a masked, org-scoped, SECURITY DEFINER RPC, so the product requirement is asserted
against that path:

| Assertion | Result |
|---|---|
| Neither test user is admin or staff | **PASS** — or the file proves nothing |
| `bg_check_queue` — member reads own org's rows | **PASS** |
| `customer_payments_queue` — member reads own org's rows | **PASS** |
| Two orgs never see the same row (disjoint id sets) | **PASS** for both RPCs |
| `client_bg_status` denied to a signed-in browser session | **PASS** — service_role only |

**Together the two files say the whole truth:** the raw tables stay shut, and the intended
door opens onto the caller's own org and nothing else.

## What this does NOT prove

These ran against the throwaway with the migration applied there. **Production has neither
the migration nor a single scoped user.** Until the owner-run script lands,
`is_staff()` still carries no org predicate in production and any staff account still reads
every tenant's 299 background checks.

---

# UPDATE 2026-09-17 — the permanently-red tests are gone, and the suite still bites

## The problem with leaving two tests red forever

`customer2-tenant-isolation.spec.ts` asserted that a scoped member can read their own rows
from `customer_payments` and `background_checks` **directly from the table**. Those two
failed on 2026-09-16 and were correctly described then as the Customer #2 blocker.

They were never going to pass. Both tables are admin-only at the row level by deliberate
hardening (`20260828000000`), and widening that policy would expose raw licences, paystubs
and insurance payloads to every member of every org. The requirement was real; the path was
wrong.

**The answer shipped as masked, org-scoped RPCs** (`20260916230000`, now live in
production). So the product requirement is asserted where it is actually satisfied —
`masked-rpc-access.spec.ts` — and the isolation spec now asserts what is true and desired:

```
vehicles / tickets           own > 0   · cross = 0
customer_payments / checks   own = 0   · cross = 0   <- the raw tables stay shut
```

A suite that is always red is a suite people stop reading. **15 passed, 0 failed.**

## Proving I did not simply weaken it

Changing an assertion from `> 0` to `= 0` on two tables deserves proof that the file still
catches a real breach, so isolation was deliberately broken: the Bravo member was given an
`org_roles` row in Alpha's org.

```
Error: vehicles: Pilot must not read any other org's rows
Received length: 1
Received array:  [{"id": "a1111111-..."}]
1 failed
```

Caught, with the right message. The breach was then reverted and the suite returned green.

## Previously-skipped specs now run

`dispatch-rls` needed two seeded incidents; `internal-ops-fail-closed` needed an admin
user. Both are now in the throwaway fixture, along with the two non-admin members and a
platform admin.

**Caveat worth recording:** Supabase auth rate-limits repeated `signInWithPassword` calls.
Running these suites back to back produces `Request rate limit reached` failures that have
nothing to do with the code. One flaky result above is exactly that, and it passed on retry.
