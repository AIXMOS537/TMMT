import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export const PLAN_PRICES: Record<string, { priceIdEnv: string; label: string }> = {
  starter: { priceIdEnv: "STRIPE_PRICE_STARTER", label: "LotOS Starter" },
  growth: { priceIdEnv: "STRIPE_PRICE_GROWTH", label: "LotOS Growth" },
  pro: { priceIdEnv: "STRIPE_PRICE_PRO", label: "LotOS Pro" },
};
