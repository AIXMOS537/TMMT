# CUSTOMER #2 — SENSITIVE DATA POLICY DECISION PACKET

**Decision-ready. No migration written. No production change made.**
Companion to `CUSTOMER_2_READINESS.md`. Assessed 2026-09-08.

---

## THE PRIOR QUESTION NOBODY HAS ASKED

Before "what may Customer #2 read from these two tables", there is a larger
question the code answers plainly:

> **What interface does Customer #2 actually log into?**

Verified:

| Route group | Reads |
|---|---|
| `(admin)` | vehicles · tickets · **background_checks** · **customer_payments** — the entire rental back office |
| `(operator)` | `lead_pool`, `operator_training_modules`, `operator_training_progress`, `organizations`, `profiles` — **no rental data at all** |
| `(partner)` | nothing directly; fleet via `get_partner_fleet` |

**Every read of both sensitive tables lives in `src/app/(admin)`.** The only
non-admin touches are `forms/actions.ts` and `forms/license-upload-actions.ts` —
the public intake **write** path, which is what `anon_insert_bg_checks` exists for.

And `(admin)/layout.tsx:38` gates the whole group:

```ts
if (!isStaffUser(user)) redirect(homePathForTier(getTierForUser(user)));
```

`is_staff()` has **no org predicate**. So:

> **To use the rental back office today you must be staff, and staff is global.
> Any Customer #2 user who can operate the product can see every tenant.**

That is the real P0. The two table policies are downstream of it. **There is
currently no scoped customer-facing rental UI to grant access to** — which means
choosing "no customer access" costs Customer #2 nothing they have today, because
they have nothing today.

---

## BACKGROUND CHECKS

### Minimum capability an external rental operator actually needs

Tracing the rental workflow, the operator needs to answer *"can this person take
the car?"* — which decomposes to:

| Need | Data required | Raw? |
|---|---|---|
| Is screening pending / complete? | status enum | no |
| Approved or declined? | outcome | no |
| Why declined? | reason code | no |
| Which applicant? | masked identity (name, last-4 phone) | no |
| Chase a missing document | presence flags | no |
| Read the licence / paystub / insurance | **raw payload** | **yes** |

Only the last line needs raw data — and that is the compliance/screening job,
which in a **managed** offer TechHaus performs. "Uses background checks" is not
"needs raw background-check records."

### Option A — No customer access *(recommended)*

Screening stays entirely inside the managed service. Customer #2 receives
outcomes through TechHaus, not through a table.

- **For:** costs nothing today — no customer surface reads this table. Preserves
  the August hardening untouched. Zero migration. Smallest possible attack
  surface for renters' licences and paystubs. Honest to the managed-service
  promise the offer already makes.
- **Against:** every screening question routes through you. Does not scale past
  a handful of customers without becoming a support burden.

### Option B — Org-scoped masked access

New security-definer RPC returning status, outcome, reason and masked identity
for the caller's own org only.

- **For:** operator self-serves the common questions. Raw payloads stay admin-only.
- **Against:** real work — new RPC, new UI to display it, new tests. Builds a
  customer surface before a customer exists.

### Option C — Role-scoped masked access

As B, but only a designated customer-side role (e.g. an operator/manager role)
may call it.

- **For:** least privilege within the customer's own org. Appropriate if their
  front-desk staff shouldn't see screening outcomes.
- **Against:** requires a customer-side role model that does not exist yet —
  `org_roles` holds **one row system-wide**.

### Option D — Raw access

- **Exceptional justification only.** Would expose licences, paystubs and
  insurance to org members and reverse the 2026-08-25 hardening. **Not recommended
  under any commercial pressure.**

### RECOMMENDATION *(non-binding)*

**Option A now, Option B when a second customer asks for it.** Nothing is lost
today, the hardening stays intact, and B remains cheap later because the RPC
pattern already exists (`partner_vehicle_rentals`).

---

## PAYMENTS — analysed independently

Payments are **less sensitive than screening documents** and **more central to
daily operation**. They should not automatically follow the background-check answer.

### Minimum capability

| Need | Data required |
|---|---|
| Who owes me money? | renter name, amount, due date, status |
| Did this payment clear? | status, date, amount |
| What did I collect this month? | totals |
| Processor/gateway internals | **not needed** |

### Option A — No direct view; managed reporting

TechHaus supplies a statement. **Weak** — an operator asking "who owes me money?"
should not have to email their vendor.

### Option B — Projected org-scoped view *(recommended)*

Security-definer RPC returning **only** renter name, amount, due date, status —
scoped to the caller's org, with processor metadata excluded.

- **For:** answers the actual operational question. Raw table stays admin-only.
  Business fields only, no gateway internals.
- **Against:** one new RPC + one screen.

### Option C — Role-scoped projected view

As B, restricted to a finance/owner role in the customer's org.

- **For:** correct if the operator's staff shouldn't see revenue.
- **Against:** needs the customer-side role model that doesn't exist.

### Option D — Raw table access

Not recommended. Exceeds product need and reverses the hardening.

### RECOMMENDATION *(non-binding)*

**Option B.** Payments are the one surface where "ask your vendor" is a genuinely
poor product answer, and a projection carries far less risk than screening data.

---

## STAFF CROSS-TENANT ACCESS — **UNVERIFIED POLICY**

Verified facts:

| Function | Authorization | Org predicate |
|---|---|---|
| `bg_check_queue(p_status, p_limit)` | `is_staff()` / `is_platform_admin()` | **none** |
| `bg_check_decide(7 args)` | `is_staff()` / `is_platform_admin()` | **none** |
| masked payments RPC | — | **does not exist** |

Classification: **UNVERIFIED POLICY**, not DEFECT.

Both readings are coherent. **Intentional:** TechHaus managed-service staff work
across tenants by design, so a global masked queue is the point. **Unintended:**
scoping was simply never added because only one tenant existed.

The migration's own comment says staff "keep the background-check job" — implying
a single-tenant world where global *was* the job. **Only the owner can say which
it is.** Do not change staff semantics while solving customer access — that is a
separate decision with its own blast radius.

---

## THE IMPLEMENTATION PATTERN, IF B OR C IS CHOSEN

This codebase already has the right precedent — **do not invent a new one**:

```
partner_vehicle_rentals()   SECURITY DEFINER
                            derives scope from auth.uid()
                            joins an access table (partner_fleet_access)
                            returns a projection, not the raw row
```

Scope is derived from **authenticated identity**, never from a caller-supplied
`org_id`. Any Customer #2 RPC must do the same, or it becomes an org-id-guessing
oracle.

---

## TEST IMPACT — how `customer2-tenant-isolation.spec.ts` must behave

The test must reflect the **owner-selected policy**. It must not decide policy.

| Option chosen | `background_checks` / `customer_payments` assertion |
|---|---|
| **A — no customer access** | Change the own-org assertion from `> 0` to `=== 0`, and add a comment stating zero is the **intended** product policy, not a failure. Cross-org stays `=== 0`. |
| **B — masked/projected org RPC** | Keep raw-table own-org at `=== 0`. Add new assertions against the RPC: own-org rows `> 0`, and calling it while authenticated as the other tenant returns `=== 0`. |
| **C — role-scoped** | As B, plus a case proving a member **without** the designated role gets `=== 0` from the RPC. |
| **D — raw** | Own-org `> 0` on the raw table. Would also require re-testing that documents and insurance did not widen. |

**Vehicles and tickets are unaffected by this decision** — they are already
correctly org-scoped and their assertions stand as written.

---

## SMALLEST IMPLEMENTATION PER OPTION

| Option | Work |
|---|---|
| **A** | Nothing in the database. Edit two assertions + comment in the spec. Record the policy in this document. |
| **B** | 1 migration (one RPC per table, security-definer, `auth.uid()`-scoped) · grants · 1 read path in `src/lib/queries.ts` · spec update · a customer-facing screen to display it |
| **C** | B + a customer-side role convention in `org_roles` + role check inside the RPC |
| **D** | Migration widening two policies + a security review of documents/insurance + explicit written justification |

---

## THE TWO QUESTIONS

1. **Background checks:** `NONE` / `MASKED ORG` / `MASKED ROLE` / `RAW ROLE`
2. **Payments:** `NONE` / `PROJECTED ORG` / `PROJECTED ROLE` / `RAW ROLE`

A third, which the evidence says must be answered first:

3. **What does Customer #2 log into?** The admin app is staff-gated and staff is
   global. Either a scoped customer UI gets built, or Customer #2 is a
   **managed** offer where TechHaus operates the admin app on their behalf and
   the customer's own login is narrow or absent. **That choice determines whether
   questions 1 and 2 matter at all.**
