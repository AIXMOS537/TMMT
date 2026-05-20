export const MARKETPLACE_LISTING_TYPES = ["deal", "vendor", "opportunity"] as const;
export type MarketplaceListingType = (typeof MARKETPLACE_LISTING_TYPES)[number];

export type MarketplaceListing = {
  id: string;
  vertical_slug: string;
  listing_type: MarketplaceListingType;
  title: string;
  description: string | null;
  financial_summary: string | null;
  external_url: string | null;
  featured: boolean;
  active: boolean;
  created_at: string;
};
