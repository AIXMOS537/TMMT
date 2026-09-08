# ADMIN SURFACE INVENTORY

Phase 1 of the shared multi-tenant SaaS conversion. Assessed 2026-09-08 against
`origin/master` and the live schema. **No code or schema changed.**

`src/app/(admin)` — **27 screens**, 36 files. Every one is gated by
`(admin)/layout.tsx:38`:

```ts
if (!isStaffUser(user)) redirect(homePathForTier(getTierForUser(user)));
```

`is_staff()` carries **no org predicate**, so today the gate is global.

---

## THE HEADLINE: MOST OF THE DATA LAYER IS ALREADY TENANT-SCOPED

Of the 23 tables these screens touch, **18 already carry an `is_org_member`
policy.** The conversion is far smaller than the UI gate suggests.

| Status | Count | Tables |
|---|---|---|
| ✅ org-scoped RLS already | **18** | fleet · vehicles · tickets · active_customers · contracts · appointments · fleet_car_inspections · maintenance_appointments · expenses · operation_costs · incoming_leads · waitlist · tasks · do_not_rent_list · former_customers · vehicle_handover · shops_mechanics_cleaning · credit_funding_sessions |
| 🔒 admin-only by deliberate design | **3** | background_checks · customer_payments · insurance |
| ⚠️ not org-scoped, other gate | **1** | cases (`is_internal_ops()`) |
| ⚠️ no `org_id` column at all | **1** | vendors (self-service by `auth_user_id`) |

**The tenant boundary is largely built. What is missing is a customer-facing way
to reach it.**

---

## SCREEN CLASSIFICATION

### CUSTOMER_REQUIRED — the minimum operating surface (17)

A rental company cannot run without these.

| Screen | Data | Tenant-ready? |
|---|---|---|
| `page.tsx` (dashboard) | aggregate counts | ⚠️ mixes admin-only counts |
| `interfaces/vehicles` | `fleet` | ✅ |
| `customers` | `active_customers` | ✅ |
| `tickets` | `tickets` | ✅ |
| `interfaces/contracts` | `contracts` | ✅ |
| `interfaces/appointments` | `appointments` | ✅ |
| `inspections` | `fleet_car_inspections` | ✅ |
| `maintenance` | `maintenance_appointments` | ✅ |
| `leads` | `incoming_leads` | ✅ |
| `waitlist` | `waitlist` | ✅ |
| `tasks` | `tasks` | ✅ |
| `expenses` | `expenses` | ✅ |
| `operation-costs` | `operation_costs` | ✅ |
| `do-not-rent` | `do_not_rent_list` | ✅ |
| `former-customers` | `former_customers` | ✅ |
| `vendors` | `shops_mechanics_cleaning` | ✅ |
| **`interfaces/payments`** | **`customer_payments`** | ❌ **admin-only** |

### CUSTOMER_REQUIRED but BLOCKED (1)

| Screen | Why |
|---|---|
| `background-checks` | `background_checks` admin-only; the masked `bg_check_queue` RPC has **no org predicate** |

### CUSTOMER_OPTIONAL — tier or later (5)

| Screen | Data | Note |
|---|---|---|
| `money` | `customer_payments` | reporting; blocked by the same table |
| `revenue` | `customer_payments` | reporting; same |
| `scorecard` | payments + time clock | staff performance; premium-tier candidate |
| `timesheets` | time clock | only if the tenant manages staff hours here |
| `insurance` | `insurance` | admin-only table; needed if tenants track renter insurance |

### PLATFORM_INTERNAL — must NOT become customer-facing (4)

| Screen | Why |
|---|---|
| `affiliates` | affiliate payout tracking — the platform's own commercial business |
| `credit-funding` | a separate vertical, legally gated (CROA/VDACS) — not part of the rental product |
| `cases` | gated by `is_internal_ops()`, which includes the `investor` role and **fails open** — see the isolation matrix |
| `workflow-vendors` | `vendors` has **no `org_id`**; it is vendor self-service keyed on `auth_user_id`, not tenant data |

---

## SHARED CAPABILITIES TO EXTRACT, NOT DUPLICATE

These are used across many screens and should be lifted into shared,
tenant-agnostic components rather than forked:

- the table/grid + filter shell used by nearly every screen
- `adminUpsert` → needs a tenant-scoped sibling that never uses service-role
- `src/lib/queries.ts` → split into platform queries and tenant queries
- document upload/view (`document-actions.ts`) → already has a path-prefix guard
- the offline sync bar (`src/lib/offline/tables.ts` lists `customer_payments`)

**Do not create a second rental application.** The goal is one component layer
with two authorization boundaries.

---

## REUSE ASSESSMENT

| Layer | Reuse | Reason |
|---|---|---|
| Database schema | **~95%** | 18/23 tables already org-scoped |
| RLS policies | **~78%** | 18/23; 5 need projections or review |
| Business logic / queries | **~70%** | mostly table reads; needs a tenant-scoped client |
| UI components | **~80%** | grids/forms are generic; branding and copy are not |
| **Route + authorization layer** | **~0%** | this is the real build |

The work is concentrated almost entirely in **authorization and routing**, not in
rebuilding rental features.
