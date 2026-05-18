import type { AdminScope, PackageSlug, TeamDepartment, UserAccessProfile } from "./types";

/** Team sections by department (entitlement slugs). */
export const TEAM_DEPARTMENT_ENTITLEMENTS: Record<TeamDepartment, string[]> = {
  sales: [
    "team_mission",
    "team_sales_scripts",
    "team_onboarding_process",
    "team_announcements",
    "team_performance",
  ],
  support: [
    "team_mission",
    "team_support_workflows",
    "team_onboarding_process",
    "team_tasks",
    "team_announcements",
  ],
  training: [
    "team_mission",
    "team_training",
    "team_sops",
    "team_onboarding_process",
    "team_announcements",
  ],
  ops: [
    "team_mission",
    "team_sops",
    "team_support_workflows",
    "team_tasks",
    "team_onboarding_process",
    "team_performance",
    "team_announcements",
  ],
  general: [
    "team_mission",
    "team_training",
    "team_sops",
    "team_announcements",
  ],
};

/** Admin sections by scope. Super admin gets all admin_* slugs. */
export const ADMIN_SCOPE_ENTITLEMENTS: Record<AdminScope, string[]> = {
  super: [
    "admin_users",
    "admin_packages",
    "admin_entitlements",
    "admin_revenue",
    "admin_client_activity",
    "admin_team_activity",
    "admin_documents",
    "admin_training_completion",
    "admin_support_overview",
    "admin_access_overrides",
  ],
  manager: [
    "admin_users",
    "admin_client_activity",
    "admin_team_activity",
    "admin_support_overview",
    "admin_training_completion",
  ],
  finance: ["admin_revenue", "admin_packages", "admin_client_activity"],
  content: [
    "admin_documents",
    "admin_training_completion",
    "admin_entitlements",
    "admin_packages",
  ],
};

export function teamEntitlementsFor(profile: UserAccessProfile): string[] {
  const dept = profile.team_department ?? "general";
  const base = TEAM_DEPARTMENT_ENTITLEMENTS[dept] ?? TEAM_DEPARTMENT_ENTITLEMENTS.general;

  if (profile.portal_role === "manager" || profile.portal_role === "admin") {
    return [...new Set([...base, ...TEAM_DEPARTMENT_ENTITLEMENTS.ops])];
  }
  return base;
}

export function adminEntitlementsFor(profile: UserAccessProfile): string[] {
  if (profile.portal_role === "super_admin") {
    return ADMIN_SCOPE_ENTITLEMENTS.super;
  }
  if (profile.portal_role === "admin" && profile.admin_scope) {
    return ADMIN_SCOPE_ENTITLEMENTS[profile.admin_scope] ?? ADMIN_SCOPE_ENTITLEMENTS.manager;
  }
  if (profile.portal_role === "manager") {
    return ADMIN_SCOPE_ENTITLEMENTS.manager;
  }
  return [];
}

export function mergeEntitlements(
  packageSlugs: string[],
  grants: string[],
  implicit: string[]
): Set<string> {
  return new Set([...packageSlugs, ...grants, ...implicit]);
}

export function packageIncludesEntitlement(
  packageSlug: PackageSlug | null,
  entitlement: string,
  packageEntitlements: Map<string, string[]>
): boolean {
  if (!packageSlug) return false;
  if (packageSlug === "elite") {
    const elite = packageEntitlements.get("elite") ?? [];
    return elite.includes(entitlement);
  }
  if (packageSlug === "custom") return false;
  const list = packageEntitlements.get(packageSlug) ?? [];
  return list.includes(entitlement);
}
