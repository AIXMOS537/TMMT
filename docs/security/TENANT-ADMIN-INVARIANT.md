# TENANT ADMIN ≠ PLATFORM ADMIN

**Permanent architecture and security invariant.** Settled by the owner 2026-09-08.
Authority record: `docs/commercialization/COMMERCIAL_AUTHORITY.md` A-4.

---

## THE INVARIANT

> A **Khan Strategies administrator** must be able to administer Khan Strategies
> **without gaining visibility or authority over TMMT, TechHaus operations, or any
> other organization.**

This is a permanent rule for the shared multi-tenant SaaS model. It is not a
commercial preference and does not expire with a pricing decision.

### Two authority domains

**PLATFORM AUTHORITY** — reserved for authorized TechHaus/platform personnel.
Platform roles may hold cross-organization capabilities **where explicitly
intended**.

**TENANT AUTHORITY** — Khan Strategies and every future customer/partner
organization. A tenant administrator:

- belongs to a specific organization;
- receives permissions through **organization-scoped roles** (`org_roles`, or its
  properly designed successor);
- may administer only resources belonging to organizations they are authorized for;
- **must not inherit platform-wide visibility**;
- **must not gain access to another tenant through possession of a generic or
  global `admin` role.**

### The prohibition

Tenant/partner/customer administrators **MUST** be granted through `org_roles` /
organization-scoped membership. They must **NEVER** receive tenant administrative
access merely through `profiles.role = 'admin'` where that role denotes
platform/global authority.

**Any code path where tenant administration requires or grants global
`profiles.role = 'admin'` is an architectural defect requiring remediation** —
including indirect forms, not only the literal field.

### Owner's commercial model, recorded

The admin role is **paid**. Muhammad Taha and his employees hold platform
authority. **Khan Strategies is the first and currently only external party to
receive their own tenant authority** — and is therefore the exact case this
invariant exists to make safe.

---

## THE ROOT DEFECT

`profiles.role = 'admin'` carries **two incompatible meanings simultaneously**:

| Function | Reads `role='admin'` as | Org-scoped? | Policies |
|---|---|---|---|
| `is_platform_admin()` | **platform admin** | ❌ No | 34 |
| `is_org_member(p_org_id)` | **org membership** | ✅ Yes | 126 |
| `is_staff()` | staff (role or `portal_role`) | ❌ No | 185 |
| `is_internal_ops()` | internal ops | — | 16 |

So granting a Customer #2 administrator via `profiles.role` does not give them
*their own* organization — it makes them a **platform admin across all nine
organizations**. That single grant is the defect this invariant closes.

**The org-scoped path already exists and is the dominant pattern** (126 policies
over `is_org_member` / `org_roles`). `org_roles` holds **1 row**, so it has
effectively never been exercised.

---

## AUDIT — org-scoped coverage gaps

*Verified against production 2026-09-08. Complements the surface-level matrices in
`docs/saas/` (`TENANT_ROLE_MATRIX.md`, `ADMIN_SURFACE_INVENTORY.md`,
`TENANT_ISOLATION_TEST_MATRIX.md`) — this is the database-policy view.*

**13 tables and views carry `org_id` but have ZERO org-scoped policy.** Every one
is reachable only through a global role, so a tenant admin either sees nothing or —
if granted globally — sees everything.

| Table / view | Org-scoped | Global `is_staff` | Global `admin` | Total policies |
|---|---|---|---|---|
| `cases` | 0 | 0 | 0 | 4 |
| `customer_payments` | 0 | 0 | 1 | 1 |
| `background_checks` | 0 | 0 | 1 | 2 |
| `documents` | 0 | 0 | 1 | 1 |
| `insurance` | 0 | 0 | 1 | 1 |
| `intake_events` | 0 | 0 | 1 | 1 |
| `agent_jobs` | 0 | 0 | 1 | 1 |
| `automation_outbox` | 0 | 0 | 1 | 1 |
| `comm_channels` | 0 | 1 | 0 | 1 |
| `installations` | 0 | 1 | 0 | 1 |
| `v_customer_standing` | 0 | 0 | 0 | 0 |
| `incident_assignments_v` | 0 | 0 | 0 | 0 |
| `customer_payments_snapshot_20260706` | 0 | 0 | 0 | 0 |

**Notes on the harder rows:**

- **`cases`** has 4 policies and **none** reference org, `is_staff` or
  `is_platform_admin` — whatever gates it is a different predicate and needs
  reading before Customer #2 touches cases.
- **The three views** carry `org_id` and **zero policies of their own**. A view is
  only as safe as its base tables unless it is `security_invoker`; each needs
  checking individually.
- **`customer_payments_snapshot_20260706`** is a dated snapshot table with **no
  policies at all** and RLS presumably inherited — a snapshot of payment data is
  exactly the kind of table that gets forgotten.

### Related open P0 — not mine, not applied

A sibling session has written
`supabase/migrations/20260908120000_is_internal_ops_fail_closed.sql`
("`is_internal_ops()` must fail closed"). Verified against production:

- the migration is **NOT applied** (absent from `schema_migrations`);
- `is_internal_ops()` **exists in production** and currently backs **16 policies**.

So a function guarding 16 live policies has an identified fail-open weakness whose
fix is written and unapplied. **Applying it is a production write and stays
owner-gated (D-18).**

---

## REMEDIATION

### Before Customer #2 onboards

1. **Adopt the grant rule operationally** — tenant admins via `org_roles` only.
   *No engineering. Settled by A-4. In force now.*
2. **`customer_payments` and `background_checks`** — add org-scoped policies using
   the existing `is_org_member(org_id)` pattern. *(D-21b — written? no. applied? no.
   Owner-gated.)*
3. **Read `cases`' four policies** and establish what actually gates them.
4. **Apply the `is_internal_ops` fail-closed migration** — owner-gated.

### Hardening that can follow

5. The remaining org-scoped gaps: `documents`, `insurance`, `intake_events`,
   `comm_channels`, `installations`, `agent_jobs`, `automation_outbox`.
6. The three views — confirm `security_invoker` or add policies.
7. Decide the fate of `customer_payments_snapshot_20260706`.
8. Split the overloaded `profiles.role = 'admin'` value so platform and org
   meanings stop sharing one token. **This is the durable fix**; everything above
   is containment around it.

---

## STANDING TEST

Any change touching authorization must answer:

> **Could a Khan Strategies administrator reach TMMT data through this?**

If the answer depends on nobody setting `profiles.role = 'admin'` for them, the
answer is **yes**, and the change is not safe.
