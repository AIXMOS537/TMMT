import type { User } from "@supabase/supabase-js";

/** Matches `app_metadata.role` in Supabase Auth (migration + JWT). */
export type AppRoleToken = "admin" | "va" | "partner";

/**
 * Partners only use `/partner`; staff use everything else (`admin`, `va`, or unset role).
 */
export type AccessTier = "staff" | "partner";

/** Raw role string from JWT; empty/missing behaves as staff (legacy admins). */
export function getTierForUser(user: User | null): AccessTier {
  if (!user) return "staff";
  const raw = user.app_metadata?.role;
  if (raw === "partner") return "partner";
  return "staff";
}

export function isStaffUser(user: User | null): boolean {
  return getTierForUser(user) !== "partner";
}
