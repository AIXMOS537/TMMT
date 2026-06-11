import type { User } from "@supabase/supabase-js";

/** Supabase Auth `app_metadata.role` values */
export type AppRoleToken =
  | "admin"
  | "internal_team"
  | "va"
  | "executive_va"
  | "executive"
  | "operator"
  | "investor"
  | "partner"
  | "vendor"
  | "customer";

export type AccessTier =
  | "owner"
  | "executive"
  | "operator"
  | "staff"
  | "investor"
  | "vendor";

export function getAppRole(user: User | null): string {
  if (!user) return "";
  const raw = user.app_metadata?.role;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Route tier for middleware and post-login redirects */
export function getTierForUser(user: User | null): AccessTier {
  const role = getAppRole(user);
  if (role === "admin") return "owner";
  if (role === "executive_va" || role === "executive") return "executive";
  if (role === "operator") return "operator";
  if (role === "vendor") return "vendor";
  if (role === "investor" || role === "partner") return "investor";
  return "staff";
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

/**
 * Roles that grant admin-write access (used by `adminUpsert` and the admin
 * route group). Explicit allowlist — deliberately does NOT fall back to
 * "staff" tier, because the staff tier is the default for users with NO
 * role token (newly-signed-up accounts, partners whose role wasn't
 * provisioned), and a missing role must NEVER mean admin write.
 */
const ADMIN_TIER_ROLES = new Set<string>([
  "admin",
  "internal_team",
  "va",
  "executive_va",
  "executive",
]);

export function isStaffUser(user: User | null): boolean {
  return ADMIN_TIER_ROLES.has(getAppRole(user));
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
      return "/operator";
    case "vendor":
      return "/vendor";
    case "investor":
      return "/investor";
    default:
      return "/";
  }
}
