# 11 · AUTHENTICATION & PERMISSIONS

## Model
Supabase Auth (email/password + reset) → `profiles` (3 rows) → role → **tier** (`lib/auth-roles.ts`) → home path → route access enforced in `src/middleware.ts` (272 lines). Tenancy resolved by host header (`lib/platform/tenant-resolve.ts`, `tenant-org.ts`).

Enforcement is **layered**, which is correct:
| Layer | Mechanism |
|---|---|
| Edge | `middleware.ts` — session check, tier gate, host→org |
| Server | Server components + service-role client for privileged paths |
| Database | **RLS on all 168 tables** + `is_staff()`, `is_admin()`, `is_owner()`, `is_org_member()`, `acting_org_id()` |

Crucially, **authorization is not frontend-only** — RLS is the backstop. `is_staff_fail_closed` (2026-06-28) makes the staff check deny by default.

## Roles observed
`platform_admin` · `super_admin` · `owner` · `admin` · `staff` / `internal_ops` · `dispatcher` · `operator` · `partner` · `vendor` · `investor` · `customer` / portal client · `anon`
(`org_roles` = 1 row, `employee_access_rights` = 1 row — the role system is far broader than its use.)

## Route-group access
| Group | Gate |
|---|---|
| `(admin)` | staff tier — "rentals desk" |
| `(command)` | owner/admin on the `.net` owner-hub host |
| `(executive)` / `(investor)` | owner tier |
| `(operator)` | operator tier |
| `(partner)` / `(vendor)` | external roles, org-scoped (`scope_external_roles_and_partner_rental_window`) |
| `(learn)` / `(pocket)` / `(program)` | authenticated customer |
| public | 3 allowlist functions |

## Findings
**🟠 A-1 · Three overlapping public-path allowlists.** `isFunnelPublicPath`, `isPublicPath`, `isPitchPublicPath` in `src/middleware.ts` have different, partially-overlapping membership. Determining whether a route is public requires reading all three. `isPublicPath` already delegates to `isFunnelPublicPath`, while `isPitchPublicPath` re-lists many of the same entries independently. **Consolidate to one table.**

**🟠 A-2 · Broad wildcard public prefixes.** `/api/webhooks/*`, `/api/agent/*`, `/api/forms/*` and `/forms*` are public by prefix. Any future route added under these paths is public **by default**. Each currently has its own secret check, so this is a latent risk, not a live hole.

**🟠 A-3 · `is_platform_admin()` and `acting_org_id()` are `anon`-executable over REST.** An anonymous caller can probe platform-admin and tenancy semantics. Combined with `org_id_for_host()` (also anon), the tenancy model is externally enumerable. Low severity alone; see `12_SECURITY_AUDIT.md`.

**🟡 A-4 · Auth token churn in production.** 16 `AuthApiError: Invalid Refresh Token` events across `/middleware` (2026-08-20 → 09-02, 3 distinct minified symbols = 3 deployments). Users are being logged out. Worth watching.

**🟡 A-5 · Leaked-password protection disabled** in Supabase Auth. One-click fix.

**🟡 A-6 · `/login` auth failures** — 5 events 2026-08-31 01:57–02:00, message `[login] auth failed: {}` — the empty object means **the failure reason is not being logged**. Debugging a real login problem would be blind.

## Verdict
The permission model is **the strongest part of this system**. It is layered, fails closed, and has been repeatedly hardened by deliberate migrations. Its weakness is *breadth* — a dozen roles for a business with 3 profiles — not depth.
