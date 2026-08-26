/** Map GHL kit-purchase tags to the dealer provision SKU. */

export type DealerProvisionSku = "ops" | "dealer";

const TAG_TO_SKU: Record<string, DealerProvisionSku> = {
  "kit-ordered-dealer-bundle": "dealer",
  "kit-ordered-ops-kit": "ops",
  "kit-ordered-ops": "ops",
};

export function dealerSkuFromTags(tags: string[]): DealerProvisionSku | null {
  for (const raw of tags) {
    const sku = TAG_TO_SKU[raw.trim().toLowerCase()];
    if (sku) return sku;
  }
  return null;
}

export function dealerProvisionCommand(sku: DealerProvisionSku, dealer: string, email: string): string {
  return `npm run provision-dealer -- --dealer ${JSON.stringify(dealer)} --email ${email} --sku ${sku} --dry-run`;
}
