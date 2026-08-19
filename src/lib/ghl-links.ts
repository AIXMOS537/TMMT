/** Server-safe GHL URLs for owner hub links (set in Vercel / .env). */
import { ghlOffer, GHL_PUBLIC_SITE, isLiveHttpUrl } from "./ghl-offers";

export const ghlLinks = {
  upsellPipeline: process.env.NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL ?? "https://app.gohighlevel.com/",
  checkout97: ghlOffer("member97"),
  creditGuidance: ghlOffer("credit"),
  operatorApply: ghlOffer("operator"),
  publicSite: GHL_PUBLIC_SITE,
};

export function isLiveGhlUrl(url: string): boolean {
  return isLiveHttpUrl(url);
}
