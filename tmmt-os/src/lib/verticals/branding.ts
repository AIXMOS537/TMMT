import type { OrgVertical } from "./types";
import { partnerAppBySlug } from "./partner-apps";

export type VerticalBranding = {
  clientBrand: string;
  opsBrand: string;
  tagline: string;
  marketplaceVerticalSlug: string;
  accentClass?: string;
};

const RENTAL_BRAND: VerticalBranding = {
  clientBrand: "TMMT OS",
  opsBrand: "TMMT OS",
  tagline: "Vehicle rental operations & client hub",
  marketplaceVerticalSlug: "tmmt_rentals",
};

const DEALER_BRAND: VerticalBranding = {
  clientBrand: "LotOS",
  opsBrand: "LotOS",
  tagline: "Dealer inventory, leads, and deal desk",
  marketplaceVerticalSlug: "tmmt_rentals",
};

const PROPERTY_BRAND: VerticalBranding = {
  clientBrand: "TMMT Property",
  opsBrand: "TMMT Property OS",
  tagline: "Short-term rental arbitrage — one system, your brand",
  marketplaceVerticalSlug: "tmmt_property",
  accentClass: "from-sky-500/10 to-emerald-500/5",
};

const SERVICE_ARBITRAGE_BRAND: VerticalBranding = {
  clientBrand: "Service Arbitrage Hub",
  opsBrand: "Service Arbitrage OS",
  tagline: "Staffing & skilled trades — deploy the TMMT base layer",
  marketplaceVerticalSlug: "service_arbitrage",
  accentClass: "from-violet-500/10 to-amber-500/5",
};

export function brandingForVertical(vertical: OrgVertical): VerticalBranding {
  switch (vertical) {
    case "dealer":
      return DEALER_BRAND;
    case "property":
      return PROPERTY_BRAND;
    case "service_arbitrage":
      return SERVICE_ARBITRAGE_BRAND;
    default:
      return RENTAL_BRAND;
  }
}

export function brandingForPartnerSlug(slug: string | null | undefined): VerticalBranding | null {
  if (!slug) return null;
  const app = partnerAppBySlug(slug);
  if (!app) return null;
  if (slug === "tmmt_property") return PROPERTY_BRAND;
  if (slug === "service_arbitrage") return SERVICE_ARBITRAGE_BRAND;
  return {
    clientBrand: app.name,
    opsBrand: `${app.name} OS`,
    tagline: app.industry,
    marketplaceVerticalSlug: slug,
  };
}

export function resolveBranding(
  vertical: OrgVertical,
  partnerAppSlug?: string | null
): VerticalBranding {
  return brandingForPartnerSlug(partnerAppSlug) ?? brandingForVertical(vertical);
}
