import type { LegacyUserRole, PortalRole } from "./types";

/** Keep legacy `profiles.role` aligned with portal access so RLS and /internal gates work. */
export function legacyRoleForPortalRole(portalRole: PortalRole): LegacyUserRole {
  switch (portalRole) {
    case "super_admin":
    case "admin":
      return "admin";
    case "manager":
    case "team_member":
      return "internal_team";
    case "client":
    default:
      return "customer";
  }
}

export function portalRoleForLegacyRole(role: string): PortalRole {
  switch (role) {
    case "admin":
      return "super_admin";
    case "internal_team":
      return "team_member";
    case "vendor":
      return "client";
    case "investor":
      return "client";
    default:
      return "client";
  }
}
