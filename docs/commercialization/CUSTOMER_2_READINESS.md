# CUSTOMER #2 READINESS

**Not commercial authority.** A technical readiness assessment for one question:

> Can an independent rental operator buy the managed rentals offer and become an
> isolated, functioning tenant without unsafe improvisation?

Assessed 2026-09-08 against the live database and `origin/master`.
**No production writes were made. No code was changed.**

---

## VERDICT — **OWNER / SECURITY POLICY REQUIRED**

Not blocked by missing code. Blocked by an undefined policy question: **who, in a
customer organisation, may read that organisation's background checks and
payments?** The admin-only lock on those tables is deliberate and recent; the
staff/masked alternative is not tenant-scoped; and no repository evidence defines
a customer-member level. Until the owner answers, any migration encodes a guess
about access to renters' licences and paystubs.

---

## OFFER BEING TESTED

Managed rentals implementation — **$12,500 setup + $2,500/mo** (hypothesis, not
authority). Manual fulfilment is expected and acceptable at this price.

## CUSTOMER PROFILE

Independent rental / BHPH operator, hypothesised at 3–30 vehicles.
**Unvalidated** — no external operator has been approached.

---

## TENANT ZERO — VERIFIED FACTS ONLY

Organisation **TMMT RENTALS** `8e651b25-e7c8-4356-af64-1716a82053b0`:

| Measure | Verified |
|---|---|
| `vehicles` (current) | **2** |
| `fleet` (historical) | **43** |
| `active_customers` (historical) | **35** |
| Tickets | **308** |
| Background checks | **299** |
| Payments | **31 / $9,510.57** |
| **Users bound to it (`org_roles`)** | **0** |

**CORRECTION to an earlier draft of this document.** A previous version called
the "43 vehicles" figure *wrong*. That was itself wrong. There are two tables:
`fleet` holds **43** historical rows and `vehicles` holds **2** current rows.
`docs/BUSINESS-REQUIREMENTS-SPEC.md:36` already records the reason — *"No
vehicles and no partners currently. The 43 `fleet` rows are sold or returned."*
The earlier figure was a **naming conflation, not a fabrication.**

**For external use:** say **2 vehicles currently**, or **43 vehicles handled
historically** — and never the second without the word "historically". Both are
true; only one describes the fleet today.

What Tenant Zero proves: **the software has run a real rental operation** — 308
tickets and 299 background checks are genuine operational volume, and 31 real
payments cleared. What it does **not** prove: that a stranger will pay, or that
the tenancy works for anyone but the house.

---

## THE PRIOR FINDING — THERE IS NO CUSTOMER-FACING RENTAL UI

Verified 2026-09-08. Every read of `background_checks` and `customer_payments`
lives in `src/app/(admin)`. The only non-admin touches are the public intake
WRITE path (`forms/actions.ts`, `forms/license-upload-actions.ts`).

`(operator)` reads only `lead_pool`, training tables, `organizations`,
`profiles` — **no rental data**. `(partner)` reads none directly.

And `(admin)/layout.tsx:38` gates the whole group on `isStaffUser`, while
`is_staff()` carries **no org predicate**.

> To use the rental back office today you must be staff, and staff is global.
> Any Customer #2 user who can operate the product can see every tenant.

This sits UPSTREAM of the two table policies. See `CUSTOMER_2_DATA_POLICY.md`
for the decision packet.

---

## THE CRITICAL STRUCTURAL FACT

**Tenant-scoped access has never been exercised in production.**

- 9 organisations exist; **8 hold zero data**
- `org_roles` has **1 row system-wide** — in Khan Strategies, not Tenant Zero
- All 3 profiles have `organization_id = NULL`
- Two profiles are `role='admin'` → **global platform admins**

Every access to Tenant Zero's data to date has been through
`is_platform_admin()` — global, unscoped. The multi-tenant machinery is
*architecturally present and well built*, and *operationally unproven*.
**Customer #2 would be the first scoped tenant user this system has ever had.**

---

## P0 BLOCKERS — sale / safety

### P0-1 · `customer_payments` and `background_checks` have no org-scoped read path

```
customer_payments_admin_only    ALL   USING is_platform_admin()
background_checks_admin_only    ALL   USING is_platform_admin()
```

There is **no `is_org_member(org_id)` branch on either table.** So for Customer #2:

- **Option A** — leave them scoped out: they cannot see their own payments or
  their own background checks. That is the core of a rental back office. The
  product does not function for them.
- **Option B** — grant `role='admin'` so they can: that is `is_platform_admin()`,
  which is **global and unscoped**. They would read Tenant Zero's 31 payments and
  **299 background checks** — third-party PII belonging to your renters.

**Neither is acceptable.** This is the hard blocker.

### ⛔ CORRECTION — the fix I first proposed was wrong and must not be applied

An earlier draft of this document proposed copying the `tickets` pattern:
`USING (is_platform_admin() OR is_org_member(org_id))`. **Do not do that.**

`supabase/migrations/20260828000000_sensitive_tables_admin_only.sql` shows the
admin-only lock is a **deliberate security hardening applied 2026-08-25**, in its
own words:

> *"Before: any internal_team / team_member account could read all
> background_checks, customer_payments, documents and insurance rows. Now those
> four are admin-only at the row level, and staff keep the background-check job
> through two RPCs that return masked contact details and document-presence flags
> instead of the underlying licence, paystub and insurance payloads."*

Adding an `is_org_member` branch would **reverse that control two weeks after it
was applied**, and would expose raw licences, paystubs and insurance payloads to
every member of every org. That is precisely the "weaken sensitive data so the
new customer passes" mistake.

**The established pattern is: sensitive tables stay admin-only; access is through
masked, security-definer RPCs.** Any Customer #2 fix must follow that pattern —
an org-scoped masked RPC — not a widened table policy.

### And the masked path is itself not tenant-scoped

Verified against production:

| Function | Checks | Org predicate |
|---|---|---|
| `bg_check_queue(p_status, p_limit)` | `is_staff()` / `is_platform_admin()` | **none** |
| `bg_check_decide(7 args)` | `is_staff()` / `is_platform_admin()` | **none** |
| *(any masked payments RPC)* | — | **does not exist** |

So the staff/masked route returns **all tenants' rows**, and there is **no masked
route for `customer_payments` at all**. Granting Customer #2 staff to reach the
masked queue would hand them Tenant Zero's 299 background checks in masked form.

### ⛔ STOP — `BACKGROUND_CHECK ROLE POLICY — OWNER/SECURITY SEMANTICS REQUIRED`

The repository establishes exactly two authorization levels for these tables:
**platform admin → raw**, and **staff → masked, global**. It establishes
**nothing** about what a *customer organisation member* should see.

That is a genuine gap in policy, not in code, and it cannot be resolved by
reading the repository. The owner must decide, per table:

1. May a customer org member see **their own** background checks at all?
2. If yes — raw, or masked (last-four phone, presence flags)?
3. Which of their org's members: every member, or an operator/finance role?
4. Same three questions for `customer_payments`.
5. Should the masked RPCs gain an org predicate so staff access is scoped too?

**No migration has been written and none should be until 1–4 are answered.**
Writing one now would encode a guess about who may read a renter's licence and
paystub.

### P0-2 · No role grants own-org access without cross-tenant reach

| Role given to Customer #2 | Effect |
|---|---|
| `role='admin'` | `is_platform_admin()` → **every table, every org** |
| `role='internal_team'` | `is_staff()` → **all vehicles in all orgs** (`vehicles_staff_write` is `ALL`) |
| `org_roles` row only | correctly scoped — but hits P0-1 on payments/checks |

`is_staff()` reads `profiles.role` and `profiles.portal_role` with **no org
predicate at all**. The only correctly-scoped path is a bare `org_roles` row, and
that path has one row in the entire system.

---

## P1 BLOCKERS — onboarding

### P1-1 · Customer-facing branding is hardcoded

Most serious: **`src/app/forms/inspection/page.tsx:101`** — the vehicle inspection
form a renter signs reads *"before leaving TMMT Rentals premises."* Customer #2's
renters would sign a document naming your company.

Also `src/app/layout.tsx:8` (page title), `(partner)/layout.tsx:6` (partner
portal title), `OfflineSyncBar.tsx:70-71`, `(auth)/login/page.tsx:43`.

Fix is narrow: these strings need to come from the tenant brand map that
**already exists** (`brand-sync.mjs` compiles `config/platform/tenants/*.json`).
The plumbing is built; these call sites just don't use it.

### P1-2 · First-ever exercise of scoped access

See the structural fact above. This is not a defect to fix — it is a **test to
run** before an external customer, using a throwaway org.

---

## NOT BLOCKERS — verified good

Worth stating, because these are the parts people usually get wrong:

- **Adding a tenant needs no code change.** `SLUG_TO_ORG` in
  `tenant-org.ts` is explicitly house-brands-only; the comment states non-house
  orgs "go through the database like any other tenant." Confirmed by reading it.
- **Licensing already gates customers correctly.** `guardOrganization()` exempts
  house orgs deliberately and licence-checks everyone else against
  `organization_licenses` — which has **4 rows, 1 active**. Issuing Customer #2 a
  licence is one INSERT, not a build.
- **`tickets` is properly org-scoped** (`is_platform_admin() OR is_org_member`) —
  the correct pattern already exists in the codebase to copy for P0-1.
- **A smoke-test org already exists**: "Pilot Motors (smoke)", zero data.

---

## CUSTOMER JOURNEY

| Step | Status |
|---|---|
| Discover → Qualify → Quote | MANUAL, ACCEPTABLE |
| Contract | **OWNER BLOCKED** — `{{REV_SHARE_PCT}}` / `{{ROYALTY}}` unresolved |
| Pay (invoice) | MANUAL, ACCEPTABLE — do not need checkout at this price |
| Create organisation | MANUAL, ACCEPTABLE — one INSERT |
| Issue licence | MANUAL, ACCEPTABLE — one INSERT |
| Create users | MANUAL, ACCEPTABLE |
| Assign roles | **PARTIAL** — path exists, exercised once, never for rentals |
| Assign package / entitlements | MISSING — **not required at Stage 1** |
| Configure tenant branding | **BLOCKED** (P1-1) |
| Import / enter data | MANUAL, ACCEPTABLE |
| Operate: tickets | WORKING |
| Operate: vehicles | WORKING (org-scoped path exists) |
| Operate: payments | **BLOCKED** (P0-1) |
| Operate: background checks | **BLOCKED** (P0-1) |
| Train / go live / support | MANUAL, ACCEPTABLE |
| Bill recurring | MANUAL, ACCEPTABLE |
| Offboard | UNVERIFIED |

---

## WHAT CAN STAY MANUAL

At $12,500 + $2,500/mo, all of this is normal service delivery, not debt:
org creation, licence issuance, user creation, role assignment, branding config,
data import, training, invoicing, launch monitoring, support, offboarding.

**Do not build software to remove the founder from Customer #2.** Measure the
minutes instead — see below.

---

## DEFERRED — DO NOT BUILD YET

Self-serve signup · entitlement enforcement engine · provisioning workers ·
queue infrastructure · billing abstraction · subscription lifecycle · generalised
package engine. **None are on the Customer #2 path.** Each becomes justified only
when repeated onboardings prove the manual step is expensive or error-prone.

---

## TEST PLAN — before any external customer

Run against a throwaway org (**production writes — owner-authorised only**):

1. Create org "Dry Run Motors" + `organization_licenses` row (active).
2. Create a user, `profiles.role` **not** admin/internal_team, plus an
   `org_roles` row for that org only.
3. Log in as that user and attempt, recording each result:
   - read own vehicles → expect PASS
   - read own tickets → expect PASS
   - read own payments → **expect FAIL until P0-1 is fixed**
   - read own background checks → **expect FAIL until P0-1 is fixed**
   - read **Tenant Zero's** tickets / vehicles / payments / checks → **must FAIL, all four**
4. That last line is the one that matters. If any Tenant Zero read succeeds,
   stop and do not onboard anyone.

---

## OBSERVABILITY — measure during the first real onboarding

Per step: action · who · system · inputs · output · **duration in founder
minutes** · failure modes · rollback · customer-visible? · should-automate?

The founder-minute count per step is the Stage 2 roadmap. Automate by
`frequency × minutes × error risk`, after two customers — not before.

---

## EXIT CRITERIA

TechHaus can honestly say *"we can onboard an external managed rental customer"*
when:

1. P0-1 fixed and verified — a scoped user reads their own payments and checks.
2. The dry run's cross-tenant reads all fail.
3. P1-1 fixed — no "TMMT Rentals" string on a Customer #2 customer-facing surface.
4. Contract terms resolved (owner).
5. The onboarding runbook has been executed once end-to-end against the throwaway org.
