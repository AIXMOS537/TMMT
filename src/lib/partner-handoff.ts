/**
 * OUTBOUND PARTNER REFERRAL — OPT-IN ONLY.
 *
 * All In One Management Solutions is a PARTNER site, not part of TMMT OS.
 * Sending one of our visitors there is a referral we give away, so it happens
 * on one condition only: the person said yes on a TMMT form first.
 *
 * Nothing in this app may bounce a visitor to the partner site on its own.
 * Before this module existed, four separate rules did exactly that —
 * next.config redirects on /credit and /funding, a 301 in middleware on the
 * /lp/* landing pages, /join, and the checkout fallback behind every money
 * button — so TMMT OS handed its own traffic to the partner homepage
 * unasked. Those are gone. This is the only door out, and it is locked.
 */

/** The partner's public site. Referenced here, linked only from the opt-in page. */
export const PARTNER_SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_PARTNER_SITE_URL ??
  process.env.NEXT_PUBLIC_AIXMOS_SITE_URL ??
  "https://allinonemanagementsolutions.com"
).replace(/\/$/, "");

export const PARTNER_NAME = "All In One Management Solutions";

/** The one page in the app that is allowed to link out. Requires a form. */
export const PARTNER_OPT_IN_PATH = "/partners/all-in-one";

/**
 * Where a TMMT money CTA goes when its checkout link is not configured yet.
 * Our own lead form — the lead stays ours instead of being dropped on the
 * partner's homepage, which is what the old fallback did for all 14 offers.
 */
export function tmmtOfferFallbackPath(offer: string, content?: string): string {
  const q = new URLSearchParams({ offer });
  if (content) q.set("utm_content", content);
  return `/forms/lead-intake?${q.toString()}`;
}

export type PartnerConsent = {
  /** The person ticked the referral box on a TMMT form. */
  optedIn: boolean;
  /** The TMMT form that captured the consent (audit trail). */
  formId?: string;
  /** What they asked the partner for. */
  interest?: string;
};

/**
 * Builds the partner URL — and only when consent is real. Returns null
 * otherwise, and every caller must treat null as "stay on TMMT".
 */
export function partnerHandoffUrl(consent: PartnerConsent): string | null {
  // Strict `=== true`, not a truthiness check. A truthy non-boolean — the
  // string "yes" straight off a form, a 1 from a database column — used to
  // sail through and produce a live hand-off URL. Consent has to be the
  // boolean this function's own type promises, or nobody goes anywhere.
  if (consent?.optedIn !== true) return null;
  const url = new URL(PARTNER_SITE_ORIGIN);
  url.searchParams.set("utm_source", "tmmt-os");
  url.searchParams.set("utm_medium", "opt-in-referral");
  url.searchParams.set("utm_campaign", consent.interest || "partner-referral");
  if (consent.formId) url.searchParams.set("utm_content", consent.formId);
  return url.toString();
}
