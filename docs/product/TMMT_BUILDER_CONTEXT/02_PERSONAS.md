# 02 — Personas and real access levels

Source: SPEC §2 (+ E2 §2, E5 §C.2) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = §1–§3 (tiers, DB vocabularies, helper semantics as they run on master and prod). **TARGET** = §4 (flagship personas; the customer, credit-client and dealer rows have **no** working path today; PM-19 / PM-16 / credit S4–S5). Note SI-02 in `S2_SPEC_ISSUES.md`: the `(admin)` desk has 29 screens, of which staff can reach 28 (`/money` is owner-only).

Only roles backed by code or confirmed requirements are listed. Do not invent roles.

## 1. App access tiers (the app's only role source)

The app derives a **tier** from JWT `app_metadata.role` (`src/lib/auth-roles.ts:14-51,97-106`). Users cannot edit `app_metadata`.

| Tier | JWT roles | Home | Persona | Reality |
|---|---|---|---|---|
| **owner** | `admin` | `/command` | Platform owner | EXISTING/WORKING. The only tier on `/command/*`, `/operators/*`, `/money` and the owner-hub host |
| **staff** | `internal_team`, `va` | `/desk` | Operator staff, VAs | EXISTING/WORKING (28 desk screens, dispatch, `/work/*`) |
| **executive** | `executive_va`, `executive` | `/executive` | Executive VA | EXISTING/BROKEN at runtime: the feed reads ghost table `ops_messages` |
| **operator** | `operator` | `/desk` → **redirect loop (R2)** | Licensee operator | EXISTING/BROKEN. `/operator/leads` reads ghost `lead_pool`. Whether operator accounts exist in prod: UNKNOWN |
| **investor** | `investor`, `partner` | `/investor` | Vehicle-owner partner / investor | EXISTING/PARTIAL. `/partner` works in code (RPC `get_partner_fleet`); `/investor` reads ghost `investor_updates` |
| **vendor** | `vendor` | `/vendor` | Shop / mechanic / cleaner | EXISTING/WORKING |
| **none** | `customer`, missing, unknown | `/no-access` | Renter / credit client | **No working customer path.** Denied `/learn/*`, `/status/[token]`, `/intake`. Can open only `/pocket` and public pages |

**Public visitor** (signed out) can open marketing pages, `/forms/*`, `/lp/*` and `/legal/*`. `/intake*` and `/status/[token]` are wrongly login-walled (R3).

## 2. Database role vocabularies (RLS side)

| Vocabulary | Values | Read by | Note |
|---|---|---|---|
| `profiles.role` (`public.user_role`) | admin, internal_team, investor, vendor, customer | `is_platform_admin()`, `is_staff()`, `is_internal_ops()`, `is_org_member()` | **Authoritative in the DB.** `va`, `executive_va`, `executive`, `operator`, `partner` have no DB value, so RLS cannot see them |
| `profiles.portal_role` | client, team_member, manager, admin, super_admin | no app reader; **read by DB `is_staff()` and `is_admin()`** | An unmanaged privilege input. Protected from self-edit since 2026-09-21 |
| `org_roles.role` | tenant_admin, dispatcher, responder, viewer | dispatch layout; `is_org_member()` | Its policy has 42P17 recursion and fails closed (2A-A12) |
| notification `recipient_role` | owner, staff, operator, system | addressing only | not authZ |
| Cube personas | client, coach, admin, supervisor | client-side demo switch | **not authZ**; off in prod unless `NEXT_PUBLIC_CUBE_DEMO_CONTROLS=1` |

**Split brain:** the app authorizes on JWT `app_metadata.role`, while the DB authorizes on `profiles.role`. Nothing syncs them. Both fail closed. **OWNER DECISION (PM-02):** pick one source of truth and sync or derive the other.

## 3. DB helper semantics (prod)

- `is_platform_admin()` = `profiles.role='admin'`
- `is_admin()` = role admin OR portal_role ∈ {admin, super_admin}
- `is_staff()` = role ∈ {admin, internal_team} OR portal_role ∈ {team_member, manager, admin, super_admin}. It is **global, not per org**, and appears in 189 policies.
- `is_internal_ops()` = role ∈ {admin, internal_team, **investor**}. The investor inclusion is an open finding (SEC-19).
- `is_org_member(org)` = an `org_roles` row, OR (`profiles.organization_id = org` AND role ∈ {admin, internal_team})

## 4. Target personas (flagship)

| Persona | Face | Supported today | Direction |
|---|---|---|---|
| Renter / applicant | Customer Portal | No | NEW BUILD on existing foundation (`/status/[token]`, `client_journey`, `client_renter_status`; archive `(client)/client/*` port) — PM-19, PM-16 |
| Credit client | Customer Portal (Credit Center) | No | After credit track S4/S5 and ⚖️ gates |
| Operator staff / VA | Operator Console | Yes | Consolidate |
| Operator owner (licensee) | Operator Console | Partially (broken home) | Fix (PM-19) + consolidate |
| Dealer | Operator Console (dealer desk) | No (marketing `/dealers` only) | Port from archive (PM-16) |
| Vehicle-owner partner / investor | Partner view | Partially | Keep narrow, read-only |
| Vendor | Vendor view | Yes | Keep |
| Dispatcher / responder | Dispatch cockpit | Yes | Separate rescue vertical; do not merge with rental incidents |
| Platform owner | Admin Console | Yes | Consolidate |

"Owner Desk" is not a route or label in canon. `/desk` (the staff KPI dashboard) and `/command/desk` (the owner → VA relay) are unrelated screens. `/operators` (owner provisioning) and `/operator` (the operator's own portal) are also different.
