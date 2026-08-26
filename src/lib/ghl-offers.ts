/**
 * Every public AIXMOS / TMMT money CTA resolves to GoHighLevel.
 *
 * If a product-specific checkout URL is set in Vercel, that wins.
 * Otherwise we send the person to the live All In One Management GHL site
 * with a campaign tag so the contact lands in the right pipeline.
 *
 * Never leave a dead #anchor. Existing TMMT clients use utm_source=tmmt.
 */
export const GHL_PUBLIC_SITE = "https://allinonemanagementsolutions.com";

export function isLiveHttpUrl(url: string): boolean {
  const t = (url ?? "").trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

export type GhlUtm = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export function withUtm(url: string, utm: GhlUtm): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    parsed = new URL(GHL_PUBLIC_SITE);
  }
  const defaults: GhlUtm = {
    utm_source: "aixmos",
    utm_medium: "web",
  };
  const merged = { ...defaults, ...utm };
  for (const [k, v] of Object.entries(merged)) {
    if (v) parsed.searchParams.set(k, v);
  }
  return parsed.toString();
}

export type GhlOfferId =
  | "member97"
  | "credit"
  | "llc"
  | "base"
  | "enterprise"
  | "carbox"
  | "ecommerce"
  | "ecosystem"
  | "operator"
  | "consult"
  | "aixmode"
  | "opsKit"
  | "commandKit"
  | "dealerBundle";

type OfferDef = {
  campaign: string;
  env?: string;
};

function defs(): Record<GhlOfferId, OfferDef> {
  return {
    member97: { campaign: "member-97", env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_97 },
    credit: {
      campaign: "credit-guidance",
      env:
        process.env.NEXT_PUBLIC_GHL_CREDIT_GUIDANCE ||
        process.env.NEXT_PUBLIC_GHL_CHECKOUT_97,
    },
    llc: { campaign: "llc-397", env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_LLC },
    base: { campaign: "build-3750", env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_3750 },
    enterprise: { campaign: "build-7500", env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_7500 },
    carbox: { campaign: "build-15000", env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_15000 },
    ecommerce: { campaign: "build-25000", env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_25000 },
    ecosystem: {
      campaign: "build-50000",
      env: process.env.NEXT_PUBLIC_GHL_CONSULT_CALL,
    },
    operator: {
      campaign: "operator-apply",
      env: process.env.NEXT_PUBLIC_GHL_OPERATOR_APPLY,
    },
    consult: {
      campaign: "strategy-call",
      env:
        process.env.NEXT_PUBLIC_GHL_CONSULT_CALL ||
        process.env.NEXT_PUBLIC_GHL_OPERATOR_APPLY,
    },
    aixmode: {
      campaign: "aixmode",
      env: process.env.NEXT_PUBLIC_GHL_CONSULT_CALL,
    },
    opsKit: {
      campaign: "ops-kit",
      env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT,
    },
    commandKit: {
      campaign: "command-kit",
      env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT,
    },
    dealerBundle: {
      campaign: "dealer-bundle",
      env: process.env.NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE,
    },
  };
}

/** Resolve an offer to a live GHL URL. Always http(s). */
export function ghlOffer(id: GhlOfferId, utm: GhlUtm = {}): string {
  const offer = defs()[id];
  const campaign = utm.utm_campaign || offer.campaign;
  const base = isLiveHttpUrl(offer.env ?? "") ? offer.env!.trim() : GHL_PUBLIC_SITE;
  return withUtm(base, { ...utm, utm_campaign: campaign });
}

/** Existing TMMT renter → higher AIXMOS rung. */
export function tmmtClientUpgradeUrl(id: GhlOfferId, content = "existing-client"): string {
  return ghlOffer(id, {
    utm_source: "tmmt",
    utm_medium: "client-upgrade",
    utm_content: content,
  });
}

export const TMMT_UPGRADE_RUNGS: Array<{
  id: GhlOfferId;
  label: string;
  price: string;
  note: string;
}> = [
  {
    id: "member97",
    label: "AIXMOS Membership",
    price: "$97/mo",
    note: "Community, operator hours, playbook — the first paid rung after a rental.",
  },
  {
    id: "credit",
    label: "Credit + Funding Audit",
    price: "$97",
    note: "Education and funding-readiness review. Not credit repair.",
  },
  {
    id: "base",
    label: "Base Infrastructure",
    price: "$3,750",
    note: "GHL, site, automations — stop running the business from a phone.",
  },
  {
    id: "carbox",
    label: "Car Rental in a Box",
    price: "$15,000",
    note: "The TMMT playbook as their own fleet system.",
  },
  {
    id: "ecosystem",
    label: "Full Ecosystem",
    price: "$50,000",
    note: "White-glove. Book a call — terms on paper before anything starts.",
  },
];
