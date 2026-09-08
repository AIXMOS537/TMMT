# TENANT ISOLATION TEST MATRIX

Adversarial model for the shared multi-tenant SaaS. Cross-tenant leakage is P0.
Assessed 2026-09-08. **No code or schema changed.**

The question for every path is not *"does the UI hide it?"* but
**"what stops Org A reaching Org B server-side?"**

---

## P0 FINDINGS

### P0-A · `is_internal_ops()` FAILS OPEN

```sql
CREATE FUNCTION public.is_internal_ops() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
begin
  if to_regclass('public.profiles') is null then
    return true;                    -- ← grants access
  end if;
  return exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and p.role::text in ('admin','internal_team','investor'));
exception when others then
  return true;                      -- ← grants access on ANY error
end; $$;
```

**Any exception inside this function grants internal-ops authority.** A missing
`profiles` table, a permissions error, a type error, a search-path problem — all
return `true`. It gates `cases` for SELECT and UPDATE.

Every sibling helper (`is_staff`, `is_platform_admin`, `is_org_member`) is
`LANGUAGE sql` and fails closed. This one is the exception, and it is the wrong
direction. **Security predicates must fail closed.**

Also note it grants internal-ops to the **`investor`** role.

**Severity P0** in a multi-tenant product. Currently limited to `cases`, which is
classified PLATFORM_INTERNAL — so exposure today is bounded. It must be fixed
before `cases` or `is_internal_ops` is used anywhere tenant-facing.

### P0-B · The product gate is global

`(admin)/layout.tsx:38` gates on `isStaffUser`; `is_staff()` has no org
predicate. Any user who can open the rental product can, at the database level,
read every tenant's `vehicles` (`vehicles_staff_write` is `ALL` on `is_staff()`).

### P0-C · Masked RPCs are not tenant-scoped

`bg_check_queue` and `bg_check_decide` check `is_staff()` / `is_platform_admin()`
with **no org predicate**. Granting a tenant user staff to reach the masked queue
would expose every tenant's screening queue.

---

## TEST MATRIX

Legend: **MUST DENY** = a pass means zero rows / rejected write.

### 1 · Direct table reads — Org A user vs Org B rows

| Surface | Vector | Expected | Status |
|---|---|---|---|
| 18 org-scoped tables | `select … where org_id = <B>` | MUST DENY | covered by `customer2-tenant-isolation.spec.ts` |
| `customer_payments` | same | MUST DENY | denies — but also denies **own** org |
| `background_checks` | same | MUST DENY | same |
| `insurance` | same | MUST DENY | same |
| `cases` | same | MUST DENY | **UNTESTED — `is_internal_ops` fails open** |
| `vendors` | same | n/a — no `org_id` | needs classification, not scoping |

### 2 · Mutations

| Vector | Expected |
|---|---|
| Insert a row carrying another org's `org_id` | MUST DENY (`WITH CHECK`) |
| Update a row to move it to another org | MUST DENY |
| Delete another org's row | MUST DENY |
| `adminUpsert` from a tenant session | MUST DENY — must never use service-role on a tenant path |

### 3 · SECURITY DEFINER functions — **the highest-risk class**

Every definer function bypasses RLS by construction. The only question is
whether scope comes from **trusted identity** or from a **caller-supplied
argument**.

| Function | Scope source | Verdict |
|---|---|---|
| `partner_vehicle_rentals()` | `auth.uid()` + access table | ✅ **the pattern to copy** |
| `get_partner_fleet()` | access table, no `auth.uid()` | ⚠️ verify before reuse |
| `bg_check_queue(status, limit)` | none | ❌ global |
| `bg_check_decide(7 args)` | none | ❌ global |
| `is_internal_ops()` | fails open | ❌ **P0-A** |

**Rule for every new tenant RPC:** derive `org_id` from `auth.uid()` via
membership. **Never accept `org_id` as a parameter** — that turns the RPC into an
org-id-guessing oracle.

### 4 · Non-obvious vectors — must all be tested before launch

| Vector | Risk | Status |
|---|---|---|
| Storage / document paths | `document-actions.ts:48-51` guards `licenses/background_checks/` prefixes — does it scope by org? | **UNVERIFIED** |
| Service-role code paths | 8 files import service role, incl. GHL webhooks and `cube-application-actions` | **UNVERIFIED** |
| Webhooks (`api/webhooks/ghl`) | inbound writes; which org do they attribute to? | **UNVERIFIED** |
| Realtime subscriptions | RLS applies, but channel names may leak existence | **UNVERIFIED** |
| Offline sync (`lib/offline/tables.ts`) | caches `customer_payments` locally | **UNVERIFIED** |
| Exports / reporting | aggregate queries may bypass row filters | **UNVERIFIED** |
| Background jobs / sweeps | `sweep_overdue_payments()` has no org predicate | **UNVERIFIED** |
| Host → tenant resolution | can a crafted Host header select another tenant? | **UNVERIFIED** |

**None of these are proven safe. "RLS is on 165/165 tables" does not cover any
row in this table** — every one of these paths either bypasses RLS or resolves
tenancy before RLS applies.

---

## NEGATIVE TESTS REQUIRED BEFORE ANY EXTERNAL TENANT

1. Org A user, authenticated, requests Org B rows on all 23 tables → **0 rows**.
2. Org A user calls every tenant RPC with Org B identifiers → **0 rows / rejected**.
3. Org A user requests an Org B storage path directly → **denied**.
4. Org A user replays an Org B webhook payload → **not attributed to A or B**.
5. Org A user sets `Host:` to Org B's domain → **not granted B's context**.
6. Org A user with **no** `org_roles` row → **0 rows everywhere**.
7. A user whose profile role is corrupted/null → **denied**, not granted
   (regression test for the P0-A class of defect).

Test 7 exists specifically because `is_internal_ops()` fails open today.
