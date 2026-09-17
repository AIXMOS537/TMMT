/**
 * Every TMMT / AIXMOS money CTA resolves to a real checkout — or, when that
 * checkout is not configured yet, to OUR OWN lead form.
 *
 * If a product-specific checkout URL is set in Vercel, that wins.
 *
 * What changed: the fallback used to be the partner's homepage. Every one of
 * the NEXT_PUBLIC_GHL_CHECKOUT_* variables is currently unset, so in practice
 * all fourteen offers — $97/mo through the $50K ecosystem — were buttons that
 * dropped a buyer on allinonemanagementsolutions.com with a utm tag and no
 * checkout. The buyer was lost and so was the lead. The fallback is now
 * /forms/lead-intake on TMMT, which captures the person into TMMT's own
 * pipeline and lets a human close them.
 *
 * Never leave a dead #anchor. Existing TMMT clients use utm_source=tmmt.
 */
import { tmmtOfferFallbackPath, PARTNER_SITE_ORIGIN } from "./partner-handoff";

/**
 * The partner's public site. Exported only so the owner hub can put a link to
 * it in Rick's own navigation — an owner clicking through on purpose. It is
 * never a fallback for a customer-facing CTA any more; see ghlOffer below.
 */
export const GHL_PUBLIC_SITE = PARTNER_SITE_ORIGIN;

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

/**
 * Adds utm params to an absolute checkout URL. Relative in-app fallbacks are
 * handled by the caller and never reach here, so a URL that will not parse is
 * a misconfigured checkout link, not a partner hand-off: it is dropped in
 * favour of our own lead form rather than silently sending traffic away.
 */
export function withUtm(url: string, utm: GhlUtm): string {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return relativeWithUtm(tmmtOfferFallbackPath("unknown"), utm);
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

/** Appends utm params to an in-app path, keeping any it already carries. */
function relativeWithUtm(path: string, utm: GhlUtm): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const merged: GhlUtm = { utm_source: "aixmos", utm_medium: "web", ...utm };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  return `${base}?${params.toString()}`;
}

/**
 * Resolve an offer to its checkout. A configured http(s) link wins; with none
 * configured the person stays on TMMT at our own lead form.
 *
 * This never returns the partner's site. Referring someone there is opt-in
 * only and lives on /partners/all-in-one (see @/lib/partner-handoff).
 */
export function ghlOffer(id: GhlOfferId, utm: GhlUtm = {}): string {
  const offer = defs()[id];
  const campaign = utm.utm_campaign || offer.campaign;
  if (!isLiveHttpUrl(offer.env ?? "")) {
    return relativeWithUtm(tmmtOfferFallbackPath(id, utm.utm_content), {
      ...utm,
      utm_campaign: campaign,
    });
  }
  return withUtm(offer.env!.trim(), { ...utm, utm_campaign: campaign });
}

/** True when this offer has a real checkout configured. Drives UI copy. */
export function offerHasLiveCheckout(id: GhlOfferId): boolean {
  return isLiveHttpUrl(defs()[id].env ?? "");
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
