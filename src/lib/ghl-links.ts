/** Server-safe GHL URLs for owner hub links (set in Vercel / .env). */

export const ghlLinks = {
  upsellPipeline: process.env.NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL ?? "https://app.gohighlevel.com/",
  checkout97: process.env.NEXT_PUBLIC_GHL_CHECKOUT_97 ?? "",
  creditGuidance: process.env.NEXT_PUBLIC_GHL_CREDIT_GUIDANCE ?? "",
  operatorApply: process.env.NEXT_PUBLIC_GHL_OPERATOR_APPLY ?? "",
};

export function isLiveGhlUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
