import type { User } from "@supabase/supabase-js";

/**
 * Supabase Auth `app_metadata.role` values — the ONE app-side source for the
 * role token vocabulary (remediation F-15).
 *
 * These strings are what the JWT carries and what `getTierForUser` switches
 * on; `scripts/provision-tenant-seat.mjs` writes them from
 * `config/verticals.json`. The database's `public.user_role` enum
 * (`profiles.role`) is a five-value SUBSET, pinned against this list in
 * `src/lib/db-vocab.ts`. Do not re-list these anywhere else:
 * `src/lib/role-vocabulary.test.ts` walks the tree and fails on a copy.
 */
export const APP_ROLE_TOKENS = [
  "admin",
  "internal_team",
  "va",
  "executive_va",
  "executive",
  "operator",
  "investor",
  "partner",
  "vendor",
  "customer",
] as const;

export type AppRoleToken = (typeof APP_ROLE_TOKENS)[number];

export function isAppRoleToken(value: unknown): value is AppRoleToken {
  return typeof value === "string" && (APP_ROLE_TOKENS as readonly string[]).includes(value);
}

export type AccessTier =
  | "owner"
  | "executive"
  | "operator"
  | "staff"
  | "investor"
  | "vendor"
  /**
   * Signed in with no recognised role. Entitled to nothing beyond the public
   * pages and the everyone-surfaces (/clock, /pocket). This is the fallback,
   * and it has to be: "staff" used to be, which meant an absent or unrecognised
   * `app_metadata.role` silently granted staff.
   *
   * Its home is /no-access — a public page that says so and offers sign-out.
   * It cannot be "/" (the rentals desk): the middleware denies this tier every
   * desk path, and a home that is itself denied would redirect to itself.
   */
  | "none";

export function getAppRole(user: User | null): string {
  if (!user) return "";
  const raw = user.app_metadata?.role;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Every `AccessTier`, as a runtime list (for tests and tables that need to
 * iterate the tiers). `satisfies` pins each entry to the type above, and the
 * exhaustiveness check below fails to compile if a tier is added to the type
 * without being listed here — so the two cannot drift.
 */
export const ACCESS_TIERS = [
  "owner",
  "executive",
  "operator",
  "staff",
  "investor",
  "vendor",
  "none",
] as const satisfies readonly AccessTier[];

type _TierMissingFromList = Exclude<AccessTier, (typeof ACCESS_TIERS)[number]>;
const _accessTiersExhaustive: [_TierMissingFromList] extends [never] ? true : never = true;
void _accessTiersExhaustive;

/**
 * Route tier for middleware and post-login redirects.
 *
 * Every tier is granted by an EXPLICIT role. Anything unrecognised — including
 * a missing `app_metadata.role`, `"customer"`, and a null user — falls to
 * "none". It used to fall to "staff", which made `isStaffUser()` true for every
 * signed-in user at a time when no account carried a role. Four server actions
 * gate a service-role client (which bypasses RLS) on that check.
 *
 * Granting on absence is the bug. Do not reintroduce a permissive default here.
 *
 * The roles are set now — checked against the live database on 2026-08-31: all
 * three accounts carry `app_metadata.role`, and every one of them matches the
 * `profiles.role` the database's own `is_platform_admin()` reads. The two
 * halves agree. The older note here said no account had ever had the field set,
 * which was true when it was written and is not any more; it is worth keeping
 * that straight, because it is the fact that decides whether the admin gate can
 * safely be tightened.
 */
export function getTierForUser(user: User | null): AccessTier {
  const role = getAppRole(user);
  if (role === "admin") return "owner";
  if (role === "executive_va" || role === "executive") return "executive";
  if (role === "operator") return "operator";
  if (role === "vendor") return "vendor";
  if (role === "investor" || role === "partner") return "investor";
  if (role === "internal_team" || role === "va") return "staff";
  return "none";
}

export function isOwnerUser(user: User | null): boolean {
  return getAppRole(user) === "admin";
}

export function isExecutiveVaUser(user: User | null): boolean {
  const role = getAppRole(user);
  return role === "executive_va" || role === "executive";
}

export function isOperatorUser(user: User | null): boolean {
  return getAppRole(user) === "operator";
}

export function isStaffUser(user: User | null): boolean {
  const tier = getTierForUser(user);
  return tier === "staff" || tier === "owner";
}

export function isInvestorUser(user: User | null): boolean {
  return getTierForUser(user) === "investor";
}

export function isVendorUser(user: User | null): boolean {
  return getTierForUser(user) === "vendor";
}

export function homePathForTier(tier: AccessTier): string {
  switch (tier) {
    case "owner":
      return "/command";
    case "executive":
      return "/executive";
    case "operator":
    case "staff":
      return "/";
    case "none":
      return "/no-access";
    case "vendor":
      return "/vendor";
    case "investor":
      return "/investor";
    default: {
      const _never: never = tier;
      return _never;
    }
  }
}
