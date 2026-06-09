/**
 * High-ticket SaaS / done-for-you build catalog ($3,750–$50,000 tiers).
 *
 * Money is collected as a DEPOSIT via a GHL-hosted checkout link (Stripe under
 * the hood), with the balance invoiced after the build kicks off. The top tier
 * is consult-first ("Book a call"). Checkout URLs come from Vercel env; until
 * they're set, the CTA falls back to the consult/book-a-call link so the page
 * never shows a dead button. See docs/HIGH-TICKET-GO-LIVE.md to turn it on.
 */

// Book-a-call / consult link — also the universal fallback for unset checkouts.
export const consultUrl =
  process.env.NEXT_PUBLIC_GHL_CONSULT_CALL ??
  process.env.NEXT_PUBLIC_GHL_OPERATOR_APPLY ??
  "";

export const supportContact = [
  process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "",
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
]
  .filter(Boolean)
  .join(" · ");

export type CtaKind = "reserve" | "call";

export type HighTicketTier = {
  id: string;
  name: string;
  tagline: string;
  audience: string;
  /** Full engagement price, display string. */
  priceLabel: string;
  /** Numeric deposit collected up front (used as the GHL-tag fallback amount). */
  depositAmount: number;
  /** Display string for the deposit / "to start" figure. */
  depositLabel: string;
  /** How the remaining balance is handled. */
  balanceNote: string;
  bullets: string[];
  outcome: string;
  cta: CtaKind;
  /** GHL deposit checkout URL ("" → falls back to consult link). */
  checkoutUrl: string;
  /** GHL revenue tag this tier's deposit fires (kept in sync with ghl-payment-sync). */
  revenueTag: string;
  featured?: boolean;
};

export const highTicketTiers: HighTicketTier[] = [
  {
    id: "base",
    name: "Base Infrastructure",
    tagline: "Your operation, systematized",
    audience: "Solo & small operators",
    priceLabel: "from $3,750",
    depositAmount: 3750,
    depositLabel: "$3,750 to start",
    balanceNote: "Scope-based; remainder invoiced as the build progresses.",
    bullets: [
      "Admin dashboard + core data model",
      "Public intake forms wired to your pipeline",
      "Staff logins & role-based access",
    ],
    outcome: "Stop running the business out of spreadsheets.",
    cta: "reserve",
    checkoutUrl: process.env.NEXT_PUBLIC_GHL_CHECKOUT_3750 ?? "",
    revenueTag: "build-base-deposit",
  },
  {
    id: "enterprise",
    name: "Enterprise Systems",
    tagline: "Full back-office build",
    audience: "Growing teams",
    priceLabel: "$7,500",
    depositAmount: 3750,
    depositLabel: "$3,750 deposit (50%)",
    balanceNote: "Balance of $3,750 invoiced at kickoff.",
    bullets: [
      "Everything in Base, plus automations",
      "Payments, tickets, reporting & CSV export",
      "GHL → Supabase revenue pipeline",
    ],
    outcome: "One system your whole team runs on.",
    cta: "reserve",
    checkoutUrl: process.env.NEXT_PUBLIC_GHL_CHECKOUT_7500 ?? "",
    revenueTag: "build-enterprise-deposit",
  },
  {
    id: "carbox",
    name: "Car Rental in a Box",
    tagline: "Turnkey fleet rental business",
    audience: "Fleet operators",
    priceLabel: "$15,000",
    depositAmount: 7500,
    depositLabel: "$7,500 deposit (50% down)",
    balanceNote: "Balance of $7,500 invoiced at kickoff.",
    bullets: [
      "Complete rental ops platform",
      "Fleet, contracts, maintenance & dispatch",
      "Launch playbook + onboarding",
    ],
    outcome: "A fleet rental business, ready to run.",
    cta: "reserve",
    checkoutUrl: process.env.NEXT_PUBLIC_GHL_CHECKOUT_15000 ?? "",
    revenueTag: "build-carbox-deposit",
    featured: true,
  },
  {
    id: "ecommerce",
    name: "E-Commerce Ecosystem",
    tagline: "Full revenue vertical",
    audience: "Multi-channel sellers",
    priceLabel: "$25,000",
    depositAmount: 12500,
    depositLabel: "$12,500 deposit (50% down)",
    balanceNote: "Balance of $12,500 invoiced at kickoff.",
    bullets: [
      "Storefront + funnel + back office",
      "Payments, affiliates & reporting",
      "Integrations across your stack",
    ],
    outcome: "An end-to-end online business.",
    cta: "reserve",
    checkoutUrl: process.env.NEXT_PUBLIC_GHL_CHECKOUT_25000 ?? "",
    revenueTag: "build-ecom-deposit",
  },
  {
    id: "ecosystem",
    name: "Full Ecosystem",
    tagline: "Enterprise, end to end",
    audience: "Enterprise & portfolios",
    priceLabel: "$50,000",
    depositAmount: 0,
    depositLabel: "Structured terms",
    balanceNote: "Custom scope and payment schedule, set on a call.",
    bullets: [
      "Everything, across multiple ventures",
      "Dedicated build + ongoing partnership",
      "Custom integrations & SLAs",
    ],
    outcome: "Your entire operation, built and run.",
    cta: "call",
    checkoutUrl: "",
    revenueTag: "build-ecosystem-consult",
  },
];

/** Resolve the action URL for a tier's CTA, falling back to the consult link. */
export function tierActionUrl(tier: HighTicketTier): string {
  if (tier.cta === "call") return consultUrl || "#book-a-call";
  return tier.checkoutUrl.trim() || consultUrl || "#reserve-pending";
}
