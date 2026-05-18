import type { LegacyUserRole, PortalId, PortalRole, UserAccessProfile } from "./types";

/** Which top-level portals a user may open. */
export function resolvePortals(profile: UserAccessProfile): PortalId[] {
  const portals = new Set<PortalId>();

  switch (profile.portal_role) {
    case "super_admin":
      return ["client", "team", "admin", "ops"];
    case "admin":
      portals.add("admin");
      portals.add("team");
      portals.add("client");
      break;
    case "manager":
      portals.add("team");
      portals.add("client");
      break;
    case "team_member":
      portals.add("team");
      break;
    case "client":
      portals.add("client");
      break;
  }

  // Legacy ops roles keep workflow portals under "ops"
  const legacy = profile.role as LegacyUserRole;
  if (legacy === "internal_team" || legacy === "admin") {
    portals.add("ops");
  }
  if (legacy === "vendor") {
    portals.add("ops");
  }
  if (legacy === "investor") {
    portals.add("client");
  }

  return [...portals];
}

export function canAccessPortal(profile: UserAccessProfile, portal: PortalId): boolean {
  return resolvePortals(profile).includes(portal);
}

export function defaultPortalHref(profile: UserAccessProfile): string {
  const portals = resolvePortals(profile);
  if (portals.includes("admin") && profile.portal_role === "super_admin") {
    return "/admin/dashboard";
  }
  if (portals.includes("team") && profile.portal_role !== "client") {
    return "/team/dashboard";
  }
  if (portals.includes("client")) {
    return "/client/dashboard";
  }
  if (profile.role === "vendor") return "/vendor/dashboard";
  if (profile.role === "internal_team" || profile.role === "admin") {
    return "/internal/dashboard";
  }
  if (profile.role === "investor") return "/investor/dashboard";
  return "/onboarding";
}

export function portalLabel(portal: PortalId): string {
  switch (portal) {
    case "client":
      return "Client Portal";
    case "team":
      return "Team Portal";
    case "admin":
      return "Admin Dashboard";
    case "ops":
      return "TMMT Ops";
  }
}

export function portalHomeHref(portal: PortalId): string {
  switch (portal) {
    case "client":
      return "/client/dashboard";
    case "team":
      return "/team/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "ops":
      return "/internal/dashboard";
  }
}

/** Middleware-friendly portal path → allowed portal roles + legacy roles */
export const PORTAL_PATH_ACCESS: Record<
  string,
  { portalRoles: PortalRole[]; legacyRoles?: LegacyUserRole[] }
> = {
  "/client": {
    portalRoles: ["client", "team_member", "manager", "admin", "super_admin"],
  },
  "/team": {
    portalRoles: ["team_member", "manager", "admin", "super_admin"],
  },
  "/admin": {
    portalRoles: ["admin", "super_admin", "manager"],
  },
  "/internal": {
    portalRoles: ["team_member", "manager", "admin", "super_admin"],
    legacyRoles: ["internal_team", "admin"],
  },
  "/vendor": {
    portalRoles: ["team_member", "manager", "admin", "super_admin"],
    legacyRoles: ["vendor", "admin"],
  },
  "/investor": {
    portalRoles: ["client", "admin", "super_admin"],
    legacyRoles: ["investor", "admin"],
  },
};
