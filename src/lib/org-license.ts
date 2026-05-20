/** Shared org license helpers for Command Center (same DB as TMMT OS). */

export const ORG_MODULES = [
  "rentals_app",
  "credit_repair",
  "lease_to_own",
  "operator_program",
] as const;

export type OrgModule = (typeof ORG_MODULES)[number];

export type OrgLicense = {
  organization_id: string;
  license_tier: "rentals_app" | "full_os" | "custom";
  modules: string[];
  max_ventures: number;
};

export function hasOrgModule(license: OrgLicense | null, module: OrgModule): boolean {
  if (!license) return true;
  if (license.license_tier === "full_os") return true;
  return license.modules.includes(module);
}

export function staffPathBlocked(
  pathname: string,
  license: OrgLicense | null
): boolean {
  if (!license) return false;
  if (pathname.startsWith("/v/") && !hasOrgModule(license, "rentals_app")) return true;
  return false;
}

export function parseOrgLicenseRow(row: {
  organization_id: string;
  license_tier: string;
  modules: string[] | null;
  max_ventures: number;
}): OrgLicense {
  return {
    organization_id: row.organization_id,
    license_tier: row.license_tier as OrgLicense["license_tier"],
    modules: row.modules ?? [],
    max_ventures: row.max_ventures,
  };
}
