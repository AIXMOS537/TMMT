# COMMERCIAL AUTHORITY

**The owner's settled decisions. This file is authority.**

Established: 2026-09-08 · Owner: Muhammad Taha

---

## HOW TO READ THIS FILE

Every value below came from an **explicit owner decision**, recorded on the date
shown. Nothing here is a default, a recommendation, or an inference.

**Absence is not approval.** A decision that does not appear in this file is
**not settled** — it is open in `OWNER_DECISIONS.md` and its default is
`NO CHANGE / HOLD`. Do not fill a gap here from production values, public copy,
database rows, or any document that calls itself canonical.

**Sequence, never reversed:**
`COMMERCIAL_AUTHORITY.md` → `COMMERCIAL_SYNC_PLAN.md` → separately authorized
implementation.

Settling a decision here does **not** authorize a production change. Production
deploys, production writes, money movement, external sends and signatures remain
owner-gated (D-18).

---

## A-1 · PRICE AUTHORITY — one merged catalog *(settles D-1)*

**Decision:** The end state is **one catalog**, absorbing all three existing
ladders into a single list with an explicit billing basis per row.

**Hard dependency:** **D-11 must land first.** `packages` currently has
`price_cents` with **no billing interval**, and the business deliberately reuses
the same anchors for one-time and recurring charges ($1,875, $3,750 and $7,500 are
each both a one-time BUILD rung *and* a monthly RUN retainer). Merging unlike
commercial models before `billing_interval` / `pricing_model` exist would produce
a catalog that cannot tell a build fee from a retainer.

**Therefore:** until D-11 lands, the three ladders stay as they are. **No ladder
has been retired and none has been promoted.** The merge is the approved
destination, not a licence to start rewriting prices.

**Status:** SETTLED as direction · BLOCKED on D-11 for execution.

---

## A-2 · SOFTWARE TIERS — two tiers *(settles D-2)*

**Decision:** The target ladder is **two software tiers: $97 and $297.**

| Tier | Status | Basis |
|---|---|---|
| **$97** | **Current / provisionable** — subject to repository verification | 8 sources, `operator_profiles.license_fee_cents = 9700`, `scripts/onboard`, and the only implemented token grant (`member-97`) |
| **$297** | **INTENDED — NOT LAUNCH-READY** | No entitlement, grant or provisioning path exists |

**The $297 tier must not be treated as launch-ready** until its
entitlement/grant/provisioning path exists and has been tested end to end.

**Do not delete the $297 product or its implementation.** It is preserved as the
intended second tier. What is missing is catalogued in
`docs/commercialization/TIER_297_GAP.md`.

**Finding that changes the shape of this (verified 2026-09-08):** the $297 offer
is **not purchasable**. `/forms/operator-apply` renders `ProgramIntakeForm`, which
contains no checkout, payment, price link or Stripe reference of any kind. It
collects name, phone, email, notes and lane, and `submitProgramIntake` records a
lead with `priceCents: 29700` as **lead-value metadata, not a charge**.

So **no unfulfillable purchase path exists** — nobody can buy the tier. What
exists is a public page advertising "$297 / month · 2,000 tokens" that leads only
to an application. That is a **truthfulness problem in the copy**, not a
fulfilment failure, and the remedy is correspondingly smaller.

**Status:** SETTLED as direction · $297 NOT LAUNCH-READY.

---

## A-3 · VEHICLE OFFERS — retired *(settles D-20)*

**Decision:** **Stop selling vehicle offers. Product direction is software-only.**

Retired by this decision:

- the vehicle-inclusive commercial rung in every ladder,
- the DB row `packages.resale_box_plus_car` as a *vehicle* offer (the row itself is
  data, and changing it is a production write — still owner-gated),
- the `$35K` rung's "reliable economy car included" component
  (`docs/OFFER-STACK.md:34`),
- the undefined **"no backend funding fee"** alternative associated with it, which
  was priced nowhere in the repository.

**Consequently:** no quote, invoice, contract or public page may name a vehicle.
The 13-term fulfilment obligation checklist in D-20 is **moot** — it applied only
to a vehicle-inclusive option, and none is being sold.

**Status:** SETTLED. Closed.

---

## A-4 · TENANT ADMIN AUTHORITY — architectural & security invariant *(settles D-21a)*

> ### TENANT ADMIN ≠ PLATFORM ADMIN
>
> A Khan Strategies administrator must be able to administer Khan Strategies
> **without gaining visibility or authority over TMMT, AIOMS operations, or any
> other organization.**

**This is a permanent architecture and security rule for the shared multi-tenant
SaaS model.** It is not a commercial preference and does not expire with a pricing
decision.

### Two authority domains

**PLATFORM AUTHORITY** — reserved for authorized AIOMS/platform personnel.
Platform roles may hold cross-organization capabilities **where explicitly
intended**.

**TENANT AUTHORITY** — used for Khan Strategies and every future
customer/partner organization. A tenant administrator:

- belongs to a specific organization;
- receives permissions through **organization-scoped roles** (`org_roles`, or its
  properly designed successor);
- may administer only resources belonging to organizations they are authorized for;
- **must not inherit platform-wide visibility**;
- **must not gain access to another tenant through possession of a generic or
  global `admin` role.**

### The prohibition

Tenant/partner/customer administrators **MUST** be granted authority through
`org_roles` / organization-scoped membership and permissions.

They must **NEVER** receive tenant administrative access merely through
`profiles.role = 'admin'` where that role denotes platform/global authority.

### Enforcement

**Any code path where tenant administration requires or grants global
`profiles.role = 'admin'` is an architectural defect requiring remediation.**

This applies to indirect forms too, not only the literal `profiles.role` field —
helper wrappers, JWT/`app_metadata` role reads, tier resolvers, hardcoded org ids,
and service-role clients that bypass RLS.

Audited surfaces and findings: `docs/security/TENANT-ADMIN-INVARIANT.md`.

### Owner's commercial model, recorded

The admin role is a **paid** role. Muhammad Taha and his employees hold platform
authority. **Khan Strategies is the first and currently only external party to
receive their own tenant authority** — and is therefore the exact case this
invariant exists to make safe.

**Status:** SETTLED and permanent.

**Not authorized by this decision:** the migration moving `customer_payments` and
`background_checks` onto the org-scoped policy pattern. That is a production
write and remains owner-gated (D-21b, D-18). It is not written and not applied.

---

## A-5 · CREDIT PATHWAY — active, one customer journey, software-led analysis *(settles D-22a, D-22b)*

**Decision (2026-09-16):** The credit-dispute engine is **ACTIVE** work. It is a
secondary pathway inside the TMMT customer journey — for people who cannot
currently access a suitable rental/vehicle path and may choose credit-related help
while working toward financing their own vehicle. It is not an unrelated side
project.

**Binding rules:**

- **No outcome promises** — no guaranteed improvement, removals, scores, financing
  approval, vehicle, or timeline, in software, copy, or AI output.
- **No automatic enrolment**; rental-marketing consent does **not** cover
  credit-service marketing; **no outreach to historical leads** about the credit
  service until consent, suppression and channel rules are verified.
- **PR #224 is review-required and must not be auto-merged.**
- AI output that is consequential must be traceable to stored source data and
  reviewed by a human/the customer before use.
- One person across both paths — no duplicate person records as a design choice.

**Product shape (D-22b, 2026-09-16):** a software-led credit report analysis and
guided journey inside TMMT OS — customer obtains their own report through the
owner's MyFreeScoreNow affiliate link, voluntarily uploads it, the app parses and
analyzes it with provenance, the customer verifies facts, the app builds next
steps, and a consultant is booked only when warranted and receives a prepared case
packet. Dispute letters are downstream and never automatic. No MFSN credentials or
scraping. No raw reports to external AI. Consultant/provider is a
service-provider organization, not hard-coded. Full text: `OWNER_DECISIONS.md`
D-22.

**Not settled:** D-22c, who the consultant/service provider is and who contracts,
bills and owns the service record. **Not authorized:** new screens before the gap
analysis is approved, commercial launch, customer enrolment, outreach, billing,
sending disputes, real customer reports, cross-tenant data transfer, or any
production write. Commercial readiness is a separate gate.

**Status:** SETTLED (parts a and b).

---

## STILL OPEN — not settled, not approved

`D-3` Khan referral rate · `D-4` rev-share / royalty / affiliate · `D-5` GHL
products · `D-6` `dist/` · `D-7` founder terms · `D-8` agent production authority
*(default in force: owner gate stays)* · `D-9` S3-05 reason codes · `D-11`
`packages` billing model *(now a dependency of A-1)* · `D-21b` tenant-safety
migration · `D-22c` credit consultant / service provider · and the remaining rows in `OWNER_DECISIONS.md`.

**Their default is `NO CHANGE / HOLD`. Silence is not approval.**
