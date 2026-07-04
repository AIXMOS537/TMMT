/**
 * Vertical registry — canonical config for each tenant on the shared spine.
 * Moe Legacy is vertical #2; TMMT Rentals is #1. Future verticals copy this shape.
 *
 * Spec: docs/superpowers/specs/2026-06-21-moe-legacy-agency-saas-design.md
 */

export type VerticalSeatStage = "learn" | "earn" | "graduate";

export type VerticalConfig = {
  /** Stable slug — matches organizations.partner_app_slug when set */
  slug: string;
  /** Human org name in Supabase organizations.name */
  orgName: string;
  displayName: string;
  shortName: string;
  tagline: string;
  /** Compliant customer-facing vocabulary */
  complianceLabel: string;
  /** Portal chrome */
  portalTitle: string;
  portalSubtitle: string;
  /** Tailwind accent for portal header badge */
  accentClass: string;
  /** Default login URL for provisioning scripts */
  loginUrl: string;
  /** Agent persona overlay (stored on org row when provisioned) */
  agentPersonaOverlay: {
    tone_adjustment?: string;
    forbidden_phrases?: string[];
    hot_lead_keywords?: string[];
  };
  /** GHL / revenue tags that belong to this vertical */
  revenueTags: string[];
  /** Monthly token allotment for metered seats (genie meter) */
  monthlyTokenAllotment: number;
  /** Owner + founding tenant admins bypass the meter */
  foundingAdminEmails: string[];
  /**
   * Canonical A2P 10DLC SMS class for this vertical, matched against
   * config/identity.config.json → compliance.sms_restricted_verticals by the
   * SMS compliance gate. Credit/funding verticals MUST be a restricted class
   * (e.g. "credit_repair") so promotional SMS is blocked. Defaults to
   * non-restricted ("rentals") when omitted.
   */
  a2pSmsClass?: string;
};

/**
 * Founding admin emails are PII — never hardcode them in source. Provide them
 * at runtime via env (comma-separated), e.g. MOE_LEGACY_FOUNDING_ADMINS.
 */
function foundingAdminsFromEnv(envKey: string): string[] {
  return (process.env[envKey] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const TMMT_RENTALS_HOME_ORG_ID = "8e651b25-e7c8-4356-af64-1716a82053b0";

export const TMMT_RENTALS: VerticalConfig = {
  slug: "tmmt-rentals",
  orgName: "TMMT Rentals",
  displayName: "TMMT Rentals",
  shortName: "Rentals",
  tagline: "Economy vehicle rentals",
  complianceLabel: "Vehicle rental services",
  portalTitle: "Operator",
  portalSubtitle: "Approved instructions from leadership",
  accentClass: "text-violet-600 dark:text-violet-400",
  loginUrl: "https://tmmt-ops.vercel.app/login",
  agentPersonaOverlay: {
    tone_adjustment: "Direct, fleet-focused, rental lifecycle aware.",
    hot_lead_keywords: ["need a car", "rent today", "tesla rental"],
  },
  revenueTags: ["member-97"],
  monthlyTokenAllotment: 500,
  foundingAdminEmails: foundingAdminsFromEnv("TMMT_RENTALS_FOUNDING_ADMINS"),
  a2pSmsClass: "rentals",
};

export const MOE_LEGACY: VerticalConfig = {
  slug: "moe-legacy",
  orgName: "Moe Legacy",
  displayName: "Moe Legacy",
  shortName: "Moe Legacy",
  tagline: "Credit guidance & business funding",
  complianceLabel: "Credit guidance — not credit repair; no guaranteed outcomes",
  portalTitle: "Agency portal",
  portalSubtitle: "Learn · earn · grow your agency — CROA-clean guidance only",
  accentClass: "text-emerald-600 dark:text-emerald-400",
  loginUrl: "https://tmmt-ops.vercel.app/login",
  agentPersonaOverlay: {
    tone_adjustment:
      "Warm, educational, compliance-first. Never promise score increases or guaranteed funding.",
    forbidden_phrases: [
      "guaranteed approval",
      "delete negative items",
      "credit repair",
      "fix your credit fast",
      "raise your score by",
    ],
    hot_lead_keywords: [
      "funding",
      "business line of credit",
      "tradelines",
      "guidance call",
    ],
  },
  revenueTags: ["member-97", "credit-guidance-active", "credit-consult-booked"],
  monthlyTokenAllotment: 500,
  foundingAdminEmails: foundingAdminsFromEnv("MOE_LEGACY_FOUNDING_ADMINS"),
  // Credit/funding vertical — A2P-restricted, so promotional SMS is blocked.
  a2pSmsClass: "credit_repair",
};

/** All registered verticals in launch order */
export const VERTICALS: VerticalConfig[] = [TMMT_RENTALS, MOE_LEGACY];

export function getVerticalBySlug(slug: string): VerticalConfig | undefined {
  const s = slug.trim().toLowerCase();
  return VERTICALS.find((v) => v.slug === s);
}

export function getVerticalByOrgName(orgName: string): VerticalConfig | undefined {
  const n = orgName.trim().toLowerCase();
  return VERTICALS.find((v) => v.orgName.toLowerCase() === n);
}

/** Seat stage → auth + org_roles mapping for provisioning */
export function seatPlanForStage(stage: VerticalSeatStage): {
  appRole: "operator" | "partner";
  orgRole: "tenant_admin" | "dispatcher" | "viewer";
  revenueSharePct: number;
  level: string;
  certified: boolean;
} {
  switch (stage) {
    case "learn":
      return {
        appRole: "operator",
        orgRole: "viewer",
        revenueSharePct: 0,
        level: "student",
        certified: false,
      };
    case "earn":
      return {
        appRole: "operator",
        orgRole: "dispatcher",
        revenueSharePct: 70,
        level: "certified",
        certified: true,
      };
    case "graduate":
      return {
        appRole: "partner",
        orgRole: "tenant_admin",
        revenueSharePct: 85,
        level: "agency_owner",
        certified: true,
      };
  }
}

/** Default vertical when org cannot be resolved (TMMT home) */
export function defaultVerticalBrand(): VerticalConfig {
  return TMMT_RENTALS;
}

/**
 * Resolve the canonical A2P SMS class for an org slug, for the SMS compliance
 * gate. FAILS CLOSED: an unknown/missing slug returns "restricted_unknown"
 * (a member of sms_restricted_verticals), so a misconfigured credit/funding org
 * can never be silently treated as unrestricted and have promo SMS auto-approved.
 */
export function a2pSmsClassForSlug(slug: string | null | undefined): string {
  if (!slug) return "restricted_unknown";
  return getVerticalBySlug(slug)?.a2pSmsClass ?? "restricted_unknown";
}
