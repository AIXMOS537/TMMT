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
      return "/operator";
    case "vendor":
      return "/vendor";
    case "investor":
      return "/investor";
    default:
      return "/";
  }
}
