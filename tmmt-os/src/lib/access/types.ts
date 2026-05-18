export const PORTAL_IDS = ["client", "team", "admin", "ops"] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

export const PORTAL_ROLES = [
  "client",
  "team_member",
  "manager",
  "admin",
  "super_admin",
] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export const ADMIN_SCOPES = ["super", "manager", "finance", "content"] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];

export const TEAM_DEPARTMENTS = ["sales", "support", "training", "ops", "general"] as const;
export type TeamDepartment = (typeof TEAM_DEPARTMENTS)[number];

export const PACKAGE_SLUGS = ["starter", "growth", "elite", "custom"] as const;
export type PackageSlug = (typeof PACKAGE_SLUGS)[number];

/** Legacy workflow role from profiles.role */
export type LegacyUserRole =
  | "admin"
  | "internal_team"
  | "investor"
  | "vendor"
  | "customer";

export type UserAccessProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: LegacyUserRole | string;
  portal_role: PortalRole;
  admin_scope: AdminScope | null;
  team_department: TeamDepartment | null;
  package_slug: PackageSlug | null;
};

export type ResolvedAccess = {
  profile: UserAccessProfile;
  portals: PortalId[];
  entitlements: Set<string>;
  packageSlug: PackageSlug | null;
};