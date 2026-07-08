/**
 * GHL / Stripe checkout URLs for kit sales (USB + online).
 * Set in Vercel env — see docs/SALES-CHANNELS.md
 */
export const kitCheckout = {
  ops: process.env.NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT ?? "",
  opsUsb: process.env.NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT_USB ?? "",
  opsMonthly: process.env.NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY ?? "",
  command: process.env.NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT ?? "",
  commandUsb: process.env.NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT_USB ?? "",
  commandMonthly: process.env.NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_MONTHLY ?? "",
  growth: process.env.NEXT_PUBLIC_GHL_CHECKOUT_97 ?? "",
  operatorApply: process.env.NEXT_PUBLIC_GHL_OPERATOR_APPLY ?? "",
  dealerBundle: process.env.NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE ?? "",
  dealerMonthly: process.env.NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY ?? "",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
} as const;

const LEAD_INTAKE = "/forms/lead-intake";

/** When GHL checkout env is unset, route to lead intake — never a dead #anchor. */
export function checkoutHref(url: string, kit?: string) {
  const trimmed = url.trim();
  if (trimmed) return trimmed;
  const params = new URLSearchParams({ utm_source: "kits-page" });
  if (kit) params.set("utm_campaign", `kit-${kit}`);
  return `${LEAD_INTAKE}?${params.toString()}`;
}
