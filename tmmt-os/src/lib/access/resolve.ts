import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminEntitlementsFor,
  mergeEntitlements,
  teamEntitlementsFor,
} from "./entitlements";
import {
  capEntitlementsByOrg,
  expandOrgLicenseToEntitlements,
  hasOrgModule,
  parseOrgLicenseRow,
  type OrgModule,
} from "./org-license";
import { resolvePortals } from "./portals";
import type {
  AdminScope,
  LegacyUserRole,
  OrgLicense,
  PackageSlug,
  PortalRole,
  ResolvedAccess,
  TeamDepartment,
  UserAccessProfile,
} from "./types";

function mapLegacyPortalRole(role: string): PortalRole {
  switch (role as LegacyUserRole) {
    case "admin":
      return "super_admin";
    case "internal_team":
    case "vendor":
      return "team_member";
    default:
      return "client";
  }
}

async function loadOrgLicense(organizationId: string | null): Promise<OrgLicense | null> {
  if (!organizationId) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_licenses")
    .select("organization_id, license_tier, modules, max_ventures")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error?.message.includes("organization_licenses")) {
    return null;
  }
  if (!data) return null;
  return parseOrgLicenseRow(data);
}

export async function getUserAccess(): Promise<ResolvedAccess | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  type ProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    portal_role?: string | null;
    admin_scope?: string | null;
    team_department?: string | null;
    package_id?: string | null;
    organization_id?: string | null;
    packages?: { slug: string } | { slug: string }[] | null;
  };

  let row: ProfileRow | null = null;

  const full = await supabase
    .from("profiles")
    .select(
      `
      id,
      email,
      full_name,
      role,
      portal_role,
      admin_scope,
      team_department,
      package_id,
      organization_id,
      packages:package_id ( slug )
    `
    )
    .eq("id", user.id)
    .maybeSingle();

  if (
    full.error?.message.includes("portal_role") ||
    full.error?.message.includes("package_id") ||
    full.error?.message.includes("organization_id")
  ) {
    const basic = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    if (basic.error || !basic.data) return null;
    row = { ...basic.data, portal_role: mapLegacyPortalRole(basic.data.role) };
  } else if (full.error || !full.data) {
    return null;
  } else {
    row = full.data as ProfileRow;
  }

  if (!row) return null;

  const pkg = row.packages;
  const packageSlug =
    pkg && !Array.isArray(pkg) ? (pkg.slug as PackageSlug) : null;

  const profile: UserAccessProfile = {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    portal_role: (row.portal_role as PortalRole) ?? mapLegacyPortalRole(row.role),
    admin_scope: (row.admin_scope as AdminScope | null) ?? null,
    team_department: (row.team_department as TeamDepartment | null) ?? null,
    package_slug: packageSlug,
    organization_id: row.organization_id ?? null,
  };

  const userEntitlements = await loadEntitlements(profile);
  const orgLicense = await loadOrgLicense(profile.organization_id);
  const orgEntitlementCap = expandOrgLicenseToEntitlements(orgLicense);
  const entitlements = capEntitlementsByOrg(userEntitlements, orgEntitlementCap);

  return {
    profile,
    portals: resolvePortals(profile),
    entitlements,
    userEntitlements,
    orgLicense,
    orgEntitlementCap,
    packageSlug: profile.package_slug,
  };
}

async function loadEntitlements(profile: UserAccessProfile): Promise<Set<string>> {
  const supabase = createSupabaseServerClient();
  const fromPackage: string[] = [];
  const grants: string[] = [];

  if (profile.package_slug && profile.package_slug !== "custom") {
    const { data: pkg } = await supabase
      .from("packages")
      .select("id")
      .eq("slug", profile.package_slug)
      .maybeSingle();

    if (pkg?.id) {
      const { data: rows } = await supabase
        .from("package_entitlements")
        .select("entitlement_slug")
        .eq("package_id", pkg.id);
      fromPackage.push(...(rows ?? []).map((r) => r.entitlement_slug));
    }
  }

  const { data: grantRows } = await supabase
    .from("profile_entitlement_grants")
    .select("entitlement_slug")
    .eq("profile_id", profile.id)
    .or("expires_at.is.null,expires_at.gt.now()");

  grants.push(...(grantRows ?? []).map((r) => r.entitlement_slug));

  const implicit: string[] = [];
  if (profile.portal_role !== "client") {
    implicit.push(...teamEntitlementsFor(profile));
  }
  implicit.push(...adminEntitlementsFor(profile));

  return mergeEntitlements(fromPackage, grants, implicit);
}

export function hasEntitlement(access: ResolvedAccess, slug: string): boolean {
  if (access.profile.portal_role === "super_admin") return true;
  return access.entitlements.has(slug);
}

export function hasUserEntitlement(access: ResolvedAccess, slug: string): boolean {
  if (access.profile.portal_role === "super_admin") return true;
  return access.userEntitlements.has(slug);
}

export function isBlockedByOrgLicense(access: ResolvedAccess, slug: string): boolean {
  if (!access.orgEntitlementCap) return false;
  return access.userEntitlements.has(slug) && !access.orgEntitlementCap.has(slug);
}

export { hasOrgModuleAccess } from "./org-license";
