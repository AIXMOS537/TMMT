/**
 * Database-side role vocabularies, typed (remediation F-15).
 *
 * The app reads roles from ONE place — the JWT `app_metadata.role`, whose
 * vocabulary is `APP_ROLE_TOKENS` in `src/lib/auth-roles.ts`. The database
 * has its own, narrower role vocabularies, enforced by an enum or a CHECK
 * constraint. They are different concepts and are kept as different lists;
 * this module is where the DB-side ones are spelled out, so that app code that
 * writes them (provisioning, dispatch membership) has a typed constant instead
 * of a string, and so that a test can pin them against the live schema.
 *
 * Concept map (one source per concept — do not merge them):
 *
 *   AppRoleToken   src/lib/auth-roles.ts   JWT app_metadata.role; 10 tokens
 *   AccessTier     src/lib/auth-roles.ts   route tier derived from the token
 *   DB_USER_ROLES  here                    enum public.user_role = profiles.role
 *                                          (DB/RLS-side; is_platform_admin()
 *                                          reads it; app code does not)
 *   ORG_ROLES      here                    org_roles.role CHECK; org-scoped,
 *                                          read only by dispatch
 *   DB_PORTAL_ROLES here                   enum public.portal_role; no app-side
 *                                          reader today
 *
 * Unrelated vocabularies that happen to say "tier" or "role" and are NOT
 * projections of any of the above: `OperatorTier` (1|2|3, numeric Hail Mary
 * operator level, shared/schemas/types.ts), `UserRole` in packages/aixmos-core
 * (client/coach/admin/supervisor demo-store personas), `license_tier`,
 * `hailmary_licenses.tier`, `tmmt_token_ledger.tier`, and
 * `credit_funding_sessions.routing_tier`.
 *
 * Dependency-free on purpose: only a type import from auth-roles, so a
 * script-adjacent module, a server action, or a client component can all use
 * it. `src/lib/role-vocabulary.test.ts` holds the dated live-DB facts these
 * lists are checked against, and parses the org_roles CHECK out of the repo
 * migration.
 */

import type { AppRoleToken } from "./auth-roles";

/**
 * `public.user_role` — the enum behind `profiles.role`. Every value is also an
 * app role token; `satisfies` makes a value that is not one fail to compile.
 * (Values in use on 2026-09-08: admin, customer.)
 *
 * Refresh: `select enum_range(null::public.user_role);`
 */
export const DB_USER_ROLES = [
  "admin",
  "internal_team",
  "investor",
  "vendor",
  "customer",
] as const satisfies readonly AppRoleToken[];

export type DbUserRole = (typeof DB_USER_ROLES)[number];

export function isDbUserRole(value: unknown): value is DbUserRole {
  return typeof value === "string" && (DB_USER_ROLES as readonly string[]).includes(value);
}

/**
 * `org_roles.role` — `text` with a CHECK constraint, defined in
 * `supabase/migrations/20260530120000_rescue_dispatch_core.sql`. Org-scoped
 * membership for dispatch; provisioning writes it via `onboard_org_member`.
 *
 * Refresh: `select pg_get_constraintdef(oid) from pg_constraint
 *           where conrelid = 'public.org_roles'::regclass and contype = 'c';`
 */
export const ORG_ROLES = ["tenant_admin", "dispatcher", "responder", "viewer"] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

/** Named handles, so a call site can say `ORG_ROLE.tenantAdmin`. */
export const ORG_ROLE = {
  tenantAdmin: "tenant_admin",
  dispatcher: "dispatcher",
  responder: "responder",
  viewer: "viewer",
} as const satisfies Record<string, OrgRole>;

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);
}

/**
 * `public.portal_role` — an enum that exists in the live schema with no
 * app-side reader. Listed so the parity test notices if it changes.
 *
 * Refresh: `select enum_range(null::public.portal_role);`
 */
export const DB_PORTAL_ROLES = [
  "client",
  "team_member",
  "manager",
  "admin",
  "super_admin",
] as const;

export type DbPortalRole = (typeof DB_PORTAL_ROLES)[number];
