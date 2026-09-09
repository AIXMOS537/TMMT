# CUSTOMER RENTAL SURFACE PLAN

Proposed tenant-facing route architecture. Assessed 2026-09-08.
**Plan only — nothing built.**

---

## PRINCIPLE

**One component layer, two authorization boundaries.** `(admin)` stays platform.
A new tenant group reuses the same grids, forms and business logic through a
**tenant-scoped data client** that can never use service-role.

Do **not** fork the rental application. Two divergent implementations of the same
workflows is the failure mode this plan exists to avoid.

---

## PROPOSED ROUTES — `src/app/(tenant)/app/*`

Gated on **org membership**, never on `isStaffUser`.

| Route | Purpose | Source screen | Reuse | Required change | Data | Permission | Complexity |
|---|---|---|---|---|---|---|---|
| `/app` | dashboard | `(admin)/page.tsx` | 60% | drop admin-only counts; tenant aggregates only | scoped counts | any tenant role | MEDIUM |
| `/app/fleet` | vehicles | `interfaces/vehicles` | 85% | tenant client | `fleet` ✅ | owner/manager write, agent read | SMALL |
| `/app/customers` | renters | `customers` | 85% | tenant client | `active_customers` ✅ | all | SMALL |
| `/app/bookings` | appointments | `interfaces/appointments` | 85% | tenant client | `appointments` ✅ | all | SMALL |
| `/app/contracts` | agreements | `interfaces/contracts` | 80% | tenant branding on output | `contracts` ✅ | all | MEDIUM |
| `/app/handover` | check-out / in | `inspections` + handover | 75% | branding on the signed form | `fleet_car_inspections`, `vehicle_handover` ✅ | all | MEDIUM |
| `/app/tickets` | issues | `tickets` | 90% | tenant client | `tickets` ✅ | all | SMALL |
| `/app/maintenance` | servicing | `maintenance` | 85% | tenant client | `maintenance_appointments` ✅ | owner/manager | SMALL |
| `/app/leads` | inbound | `leads` + `waitlist` | 80% | merge two screens | `incoming_leads`, `waitlist` ✅ | all | SMALL |
| `/app/tasks` | to-do | `tasks` | 90% | tenant client | `tasks` ✅ | all | SMALL |
| `/app/costs` | expenses | `expenses` + `operation-costs` | 80% | merge | both ✅ | owner/manager | SMALL |
| `/app/do-not-rent` | blocklist | `do-not-rent` | 90% | tenant client | `do_not_rent_list` ✅ | all | SMALL |
| `/app/vendors` | shops | `vendors` | 85% | tenant client | `shops_mechanics_cleaning` ✅ | owner/manager | SMALL |
| **`/app/payments`** | money in | `interfaces/payments` | **40%** | **new `tenant_payments()` RPC** | projection | owner/manager MASKED | **LARGE** |
| **`/app/screening`** | check results | `background-checks` | **35%** | **new `tenant_screening()` RPC** | projection | owner/manager MASKED | **LARGE** |
| `/app/reports` | revenue | `money`+`revenue` | 40% | **new summary RPC** | aggregates | owner SUMMARY | MEDIUM |
| `/app/settings` | org + staff + branding | *none exists* | **0%** | **new** | `organizations`, `org_roles` | owner | **LARGE** |

**17 tenant screens. 13 are largely a re-host of existing components. 4 are real
builds.**

---

## STAYS PLATFORM-ONLY

`affiliates` · `credit-funding` · `cases` · `workflow-vendors` · `timesheets` ·
`scorecard` · raw `insurance`

---

## SHARED COMPONENTS TO EXTRACT FIRST

Extraction precedes route work — otherwise the tenant group copies code.

1. **Tenant data client** — a Supabase client that always runs as the user, never
   service-role. *The single most important piece.*
2. **`queries.ts` split** — `queries/platform.ts` and `queries/tenant.ts`.
3. **Table/grid shell** — already generic, lift as-is.
4. **`adminUpsert` → `tenantUpsert`** — scoped, no service-role.
5. **Branding provider** — resolve once, consume everywhere.

---

## BUILD SEQUENCE — dependency ordered

| # | Step | Complexity | Gate |
|---|---|---|---|
| 1 | Fix `is_internal_ops()` to fail closed | **SMALL** | P0 security |
| 2 | Tenant role model in `org_roles` (4 roles) | MEDIUM | owner sign-off on the matrix |
| 3 | Tenant data client + `queries.ts` split | MEDIUM | — |
| 4 | `(tenant)` route group + membership gate | MEDIUM | 2, 3 |
| 5 | Port the 13 already-scoped screens | MEDIUM | 4 |
| 6 | Adversarial isolation tests pass | MEDIUM | 5 — **hard gate** |
| 7 | `tenant_payments()` + `tenant_screening()` RPCs | **LARGE** | owner answers MASKED/SUMMARY |
| 8 | `/app/settings` — staff, branding | **LARGE** | 4 |
| 9 | Branding gap closure | MEDIUM | 8 |
| 10 | One real tenant runs a full workflow | — | **hard gate** |
| 11 | Provisioning | LARGE | 10 |
| 12 | Self-serve signup + billing | **VERY LARGE** | 11 |

**Step 6 is a hard gate. Do not proceed to 7 with a failing isolation test.**
**Step 10 is a hard gate. Do not build the vending machine until the product
being dispensed works for one real tenant.**

---

## BRANDING GAP INVENTORY

Infrastructure exists — `brand-sync.mjs` compiles `config/platform/tenants/*.json`;
`tenant-resolve.ts` maps host → tenant; non-house orgs already resolve via the
database. **The gap is call sites that ignore it.**

| Location | Issue | Severity |
|---|---|---|
| `src/app/forms/inspection/page.tsx:101` | *"before leaving TMMT Rentals premises"* on a form a **renter signs** | **HIGH — legal-flavoured** |
| `src/app/layout.tsx:8` | page title hardcoded | HIGH |
| `src/app/(partner)/layout.tsx:6` | portal title hardcoded | MEDIUM |
| `src/components/OfflineSyncBar.tsx:70-71` | copy hardcoded | MEDIUM |
| `src/app/(auth)/login/page.tsx:43` | copy hardcoded | MEDIUM |
| `src/app/build/page.tsx:136`, `build/reserved:71` | footer | LOW (platform pages) |
| Generated contracts / receipts / PDFs | **UNVERIFIED** — must inherit tenant brand | **HIGH** |
| Email templates | **UNVERIFIED** | **HIGH** |
| favicon / metadata / OG | **UNVERIFIED** | MEDIUM |

---

## EFFORT BY SUBSYSTEM

| Subsystem | Effort |
|---|---|
| Fix `is_internal_ops()` | SMALL |
| Tenant role model | MEDIUM |
| Tenant data client + query split | MEDIUM |
| Route group + membership gate | MEDIUM |
| Port 13 scoped screens | MEDIUM |
| Payments + screening projections | **LARGE** |
| Org settings / staff management | **LARGE** |
| Branding closure | MEDIUM |
| Adversarial isolation suite | MEDIUM |
| Provisioning | LARGE |
| Self-serve signup + billing | **VERY LARGE** |

No calendar estimates — there is no delivery-velocity evidence in this repository
to base them on.
