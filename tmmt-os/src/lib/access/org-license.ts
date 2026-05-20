import type { LicenseTier, OrgLicense, ResolvedAccess } from "./types";

export type { OrgLicense };

/** Purchased org modules (SKUs). */
export const ORG_MODULES = [
  "rentals_app",
  "credit_repair",
  "lease_to_own",
  "operator_program",
  "property_arbitrage",
  "service_arbitrage",
] as const;

export type OrgModule = (typeof ORG_MODULES)[number];

/** Entitlement slugs unlocked by each org module. */
export const ORG_MODULE_ENTITLEMENTS: Record<OrgModule, readonly string[]> = {
  rentals_app: [
    "rental_hub",
    "vehicle_hub",
    "marketplace_hub",
    "billing_portal",
    "maintenance_requests",
    "support_tickets",
    "updates_hub",
    "docs_library",
    "announcements",
    "onboarding_steps",
    "app_a",
    "app_b",
  ],
  property_arbitrage: ["marketplace_hub", "app_a", "onboarding_steps", "announcements"],
  service_arbitrage: ["marketplace_hub", "app_a", "onboarding_steps", "announcements"],
  credit_repair: [
    "journey_path",
    "credit_education_hub",
    "training_credit_rebuild",
    "training_fundamentals",
    "training_advanced",
  ],
  lease_to_own: ["journey_path"],
  operator_program: ["operator_candidate", "upgrade_center"],
};

const ALL_ORG_ENTITLEMENTS = new Set(
  ORG_MODULES.flatMap((m) => ORG_MODULE_ENTITLEMENTS[m])
);

export function expandOrgLicenseToEntitlements(license: OrgLicense | null): Set<string> | null {
  if (!license) return null;

  if (license.license_tier === "full_os") {
    return new Set(ALL_ORG_ENTITLEMENTS);
  }

  const slugs = new Set<string>();
  for (const mod of license.modules) {
    const key = mod as OrgModule;
    if (ORG_MODULE_ENTITLEMENTS[key]) {
      for (const slug of ORG_MODULE_ENTITLEMENTS[key]) {
        slugs.add(slug);
      }
    }
  }
  return slugs;
}

export function capEntitlementsByOrg(
  userEntitlements: Set<string>,
  orgCap: Set<string> | null
): Set<string> {
  if (!orgCap) return userEntitlements;
  return new Set([...userEntitlements].filter((slug) => orgCap.has(slug)));
}

/** Client routes that require a lifecycle entitlement (blocked when org lacks module). */
export const CLIENT_PATH_ENTITLEMENTS: { prefix: string; entitlement: string }[] = [
  { prefix: "/client/path", entitlement: "journey_path" },
  { prefix: "/client/credit", entitlement: "credit_education_hub" },
  { prefix: "/client/training", entitlement: "training_credit_rebuild" },
  { prefix: "/client/upgrade", entitlement: "upgrade_center" },
];

export function clientPathBlockedByOrgCap(
  pathname: string,
  orgCap: Set<string> | null
): string | null {
  if (!orgCap) return null;
  for (const { prefix, entitlement } of CLIENT_PATH_ENTITLEMENTS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!orgCap.has(entitlement)) return entitlement;
    }
  }
  return null;
}

export function hasOrgModule(license: OrgLicense | null, module: OrgModule): boolean {
  if (!license) return true;
  if (license.license_tier === "full_os") return true;
  return license.modules.includes(module);
}

/** Client-safe — no Supabase / next/headers. */
export function hasOrgModuleAccess(access: ResolvedAccess, module: OrgModule): boolean {
  if (access.profile.portal_role === "super_admin") return true;
  return hasOrgModule(access.orgLicense, module);
}

/** Staff / ops routes gated by purchased org module. */
export const STAFF_PATH_MODULES: { prefix: string; module: OrgModule }[] = [
  { prefix: "/internal/journey", module: "credit_repair" },
  { prefix: "/internal/operators", module: "operator_program" },
  { prefix: "/v/", module: "rentals_app" },
];

export function staffPathBlockedByOrgLicense(
  pathname: string,
  license: OrgLicense | null
): OrgModule | null {
  if (!license) return null;
  for (const { prefix, module } of STAFF_PATH_MODULES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      if (!hasOrgModule(license, module)) return module;
    }
  }
  return null;
}

export function pathBlockedByOrgLicense(
  pathname: string,
  orgCap: Set<string> | null,
  license: OrgLicense | null
): boolean {
  const client = clientPathBlockedByOrgCap(pathname, orgCap);
  if (client) return true;
  return staffPathBlockedByOrgLicense(pathname, license) !== null;
}

export function parseOrgLicenseRow(row: {
  organization_id: string;
  license_tier: string;
  modules: string[] | null;
  max_ventures: number;
}): OrgLicense {
  return {
    organization_id: row.organization_id,
    license_tier: row.license_tier as LicenseTier,
    modules: row.modules ?? [],
    max_ventures: row.max_ventures,
  };
}
