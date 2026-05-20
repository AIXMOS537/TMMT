import type { LicenseTier } from "./types";

/** SKU → org license manifest for provisioning new tenants. */
export const PROVISION_SKUS: Record<
  string,
  { license_tier: LicenseTier; modules: string[]; max_ventures: number }
> = {
  rentals_app: {
    license_tier: "rentals_app",
    modules: ["rentals_app"],
    max_ventures: 1,
  },
  full_os: {
    license_tier: "full_os",
    modules: ["rentals_app", "credit_repair", "lease_to_own", "operator_program"],
    max_ventures: 99,
  },
  credit_repair_addon: {
    license_tier: "custom",
    modules: ["rentals_app", "credit_repair"],
    max_ventures: 1,
  },
  lto_addon: {
    license_tier: "custom",
    modules: ["rentals_app", "credit_repair", "lease_to_own"],
    max_ventures: 1,
  },
  property_arbitrage: {
    license_tier: "custom",
    modules: ["property_arbitrage"],
    max_ventures: 1,
  },
  service_arbitrage: {
    license_tier: "custom",
    modules: ["service_arbitrage"],
    max_ventures: 1,
  },
};

export function manifestForSku(sku: string) {
  const manifest = PROVISION_SKUS[sku];
  if (!manifest) {
    throw new Error(`Unknown license SKU: ${sku}. Known: ${Object.keys(PROVISION_SKUS).join(", ")}`);
  }
  return manifest;
}
