# TENANT ROLE MATRIX

Two authority domains for the shared multi-tenant SaaS. Assessed 2026-09-08.
Decisions 1-3 are **SETTLED** (2026-09-08). The P0 fix is implemented as a
prepared migration; production is not modified.

---


---

## SETTLED DECISIONS — 2026-09-08 (do not re-ask)

**DECISION 1 — TENANT ROLE MODEL: APPROVED.** Three roles only:
`TENANT_OWNER`, `TENANT_MANAGER`, `TENANT_AGENT`. No VIEWER, no speculative
roles. They belong exclusively to the tenant authority domain and must remain
distinct from platform authority. Permissions are capability-driven underneath
the roles so they can evolve without another authorization rewrite.

**DECISION 2 — SENSITIVE DATA EXPOSURE: APPROVED.**

| Surface | OWNER | MANAGER | AGENT |
|---|---|---|---|
| Payments | MASKED | MASKED | NONE |
| Screening | MASKED | MASKED | SUMMARY |
| Raw identity documents | **NONE** | **NONE** | **NONE** |

Tenant users receive only operationally necessary information. No processor
internals, secrets, tokens or raw records. The August hardening is **not**
weakened; access is delivered through purpose-built projections.

**DECISION 3 — P0 FIX: AUTHORIZED AND IMPLEMENTED.** See
`supabase/migrations/20260908120000_is_internal_ops_fail_closed.sql`.

## ARCHITECTURE INVARIANTS (permanent)

1. **PLATFORM AUTHORITY != TENANT AUTHORITY.** A tenant role must never be
   expressible as a platform role. `is_staff()` is retired from tenant paths.
2. **AUTHORIZATION FAILURE = DENY.** No authorization helper may grant authority
   because something failed. Predicates are `LANGUAGE sql`, no exception
   handlers, no fail-open branches.

---

## THE CORE SEPARATION

Today one concept does both jobs, and that is the architectural blocker:

```
is_staff()  →  profiles.role IN ('admin','internal_team')
               OR profiles.portal_role IN ('team_member','manager','admin','super_admin')
               NO org predicate
```

A tenant's manager and a platform operator are indistinguishable. They must not be.

| Domain | Answers | Derived from | Scope |
|---|---|---|---|
| **PLATFORM AUTHORITY** | "may this person act on the platform?" | `profiles.role` | across tenants, explicitly |
| **TENANT AUTHORITY** | "may this person act inside org X?" | `org_roles` for org X | one org only |

**A tenant role must never be expressible as a platform role.** That is the rule
that makes the SaaS safe.

---

## PLATFORM AUTHORITY (existing, keep)

| Role | Source | Notes |
|---|---|---|
| `PLATFORM_ADMIN` | `is_platform_admin()` = `role='admin'` | raw sensitive access; keep narrow — **2 accounts today** |
| `PLATFORM_SUPPORT` | *does not exist* | needed later for scoped support access with an audit trail |

`is_staff()` should be **retired from tenant paths** and, if kept, mean
"platform staff" only. `is_internal_ops()` **has been fixed to fail closed** —
`supabase/migrations/20260908120000_is_internal_ops_fail_closed.sql`, prepared for
owner-gated application.

---

## TENANT AUTHORITY (proposed — smallest model the workflows justify)

Derived from the 27 screens, not from a generic RBAC template. **Three roles** —
`TENANT_VIEWER` and a separate `TENANT_ADMIN` are not justified by any workflow
and are deliberately excluded (SETTLED, Decision 1).

| Role | Exists to |
|---|---|
| `TENANT_OWNER` | owns the business — sees money, manages staff, holds billing |
| `TENANT_MANAGER` | runs daily operations — fleet, maintenance, screening decisions |
| `TENANT_AGENT` | front desk — check-out/in, inspections, tickets, no revenue |
| *(no viewer yet)* | add only when a real customer asks |

Carried in `org_roles`, which already exists and already scopes `is_org_member`.
**It has 1 row system-wide, so this is greenfield — no migration of existing
assignments is required.**

---

## PERMISSION MATRIX

`FULL` = raw rows · `SUMMARY` = aggregates only · `MASKED` = projection without
sensitive payloads · `NONE` = no access.

| Capability | Platform Admin | Tenant Owner | Tenant Manager | Tenant Agent |
|---|---|---|---|---|
| Vehicles / fleet | FULL | FULL | FULL | FULL (read) |
| Customers | FULL | FULL | FULL | FULL |
| Reservations / appointments | FULL | FULL | FULL | FULL |
| Contracts | FULL | FULL | FULL | FULL |
| Check-out / check-in / handover | FULL | FULL | FULL | FULL |
| Inspections | FULL | FULL | FULL | FULL |
| Tickets | FULL | FULL | FULL | FULL |
| Maintenance | FULL | FULL | FULL | SUMMARY |
| Do-not-rent list | FULL | FULL | FULL | FULL (read) |
| Leads / waitlist | FULL | FULL | FULL | FULL |
| Tasks | FULL | FULL | FULL | FULL |
| **Payments** | FULL | **MASKED** | **MASKED** | **NONE** |
| **Deposits / refunds** | FULL | MASKED | MASKED | NONE |
| Expenses / operation costs | FULL | FULL | FULL | NONE |
| **Revenue / reporting** | FULL | **SUMMARY** | SUMMARY | NONE |
| **Screening (background checks)** | FULL | **MASKED** | **MASKED** | **SUMMARY** |
| **Renter identity documents** | FULL | **NONE** | **NONE** | **NONE** |
| Insurance records | FULL | MASKED | MASKED | NONE |
| Staff management | FULL | FULL | NONE | NONE |
| Org settings / branding | FULL | FULL | NONE | NONE |
| Billing / subscription | FULL | FULL | NONE | NONE |
| Affiliates · credit-funding · cases | FULL | NONE | NONE | NONE |

### Why MASKED and not FULL on payments and screening

**Payments — MASKED for tenant roles.** The operator needs renter name, amount,
due date and status to run the business. They do not need processor identifiers,
gateway metadata or stored instrument details. A projection delivers the business
value and removes the breach surface.

**Screening — MASKED for owner/manager, SUMMARY for agent.** They need the
decision (approved / declined / pending) and enough identity to match it to a
person. **They do not need the licence, paystub or insurance payload** — those
are third-party PII belonging to the renter, and the 2026-08-25 hardening
deliberately restricted them. An agent needs only "cleared / not cleared."

**Renter identity documents — NONE for every tenant role.** This is the line I
would not cross without explicit legal advice. Raw identity documents stay
platform-only.

---

## IMPLEMENTATION SHAPE

Follow the precedent that already exists — do **not** invent authorization:

```
partner_vehicle_rentals()  SECURITY DEFINER
                           scope from auth.uid() via an access table
                           returns a projection, not the raw row
```

New tenant RPCs needed (**not written**):

| RPC | Returns | Replaces |
|---|---|---|
| `tenant_payments()` | renter name, amount, due date, status | raw `customer_payments` |
| `tenant_screening()` | status, outcome, reason, masked identity | raw `background_checks` |
| `tenant_revenue_summary()` | aggregates only | raw payment rows |

Each derives org from `auth.uid()`, checks the caller's `org_roles` role, and
**never accepts `org_id` as a parameter**.

---

## WHAT THIS DOES NOT REQUIRE

- No change to the 18 already-scoped tables.
- No widening of `background_checks`, `customer_payments` or `insurance`.
- No reversal of the August hardening.
- No new authorization framework.
