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

export const LICENSE_TIERS = ["rentals_app", "full_os", "custom"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

export type OrgLicense = {
  organization_id: string;
  license_tier: LicenseTier;
  modules: string[];
  max_ventures: number;
};

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
  organization_id: string | null;
};

export type ResolvedAccess = {
  profile: UserAccessProfile;
  portals: PortalId[];
  /** Effective entitlements after org license cap. */
  entitlements: Set<string>;
  /** Raw user entitlements before org cap (package + grants + role). */
  userEntitlements: Set<string>;
  orgLicense: OrgLicense | null;
  orgEntitlementCap: Set<string> | null;
  packageSlug: PackageSlug | null;
};