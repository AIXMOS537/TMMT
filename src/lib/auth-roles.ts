import type { User } from "@supabase/supabase-js";

/** Supabase Auth `app_metadata.role` values */
export type AppRoleToken =
  | "admin"
  | "internal_team"
  | "va"
  | "investor"
  | "partner"
  | "vendor"
  | "customer";

export type AccessTier = "staff" | "investor" | "vendor";

export function getAppRole(user: User | null): string {
  if (!user) return "";
  const raw = user.app_metadata?.role;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Route tier for middleware and post-login redirects */
export function getTierForUser(user: User | null): AccessTier {
  const role = getAppRole(user);
  if (role === "vendor") return "vendor";
  if (role === "investor" || role === "partner") return "investor";
  return "staff";
}

export function isStaffUser(user: User | null): boolean {
  return getTierForUser(user) === "staff";
}

export function isInvestorUser(user: User | null): boolean {
  return getTierForUser(user) === "investor";
}

export function isVendorUser(user: User | null): boolean {
  return getTierForUser(user) === "vendor";
}

export function homePathForTier(tier: AccessTier): string {
  switch (tier) {
    case "vendor":
      return "/vendor";
    case "investor":
      return "/investor";
    default:
      return "/";
  }
}
