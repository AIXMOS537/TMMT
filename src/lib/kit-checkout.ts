/**
 * GHL checkout URLs for kit sales (USB + online).
 * Set in Vercel env — see docs/GHL-FLAGSHIP-ENV-MAP.md
 */
import { ghlOffer, type GhlOfferId } from "./ghl-offers";

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

const KIT_OFFER: Record<string, GhlOfferId> = {
  ops: "opsKit",
  "ops-usb": "opsKit",
  command: "commandKit",
  "command-usb": "commandKit",
  growth: "member97",
  "dealer-bundle": "dealerBundle",
};

/** When GHL product URL is unset, land on the live GHL site with campaign — never a dead #anchor. */
export function checkoutHref(url: string, kit?: string) {
  const trimmed = url.trim();
  if (trimmed) return trimmed;
  const offerId = kit && KIT_OFFER[kit] ? KIT_OFFER[kit] : "member97";
  return ghlOffer(offerId, { utm_source: "kits-page", utm_content: kit ?? "unknown" });
}
