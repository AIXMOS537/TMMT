/**
 * Vertical registry — canonical config for each tenant on the shared spine.
 * AIXMOS Credit (slug + orgName kept as moe-legacy/"Moe Legacy" — live org rows map to them) is vertical #2; TMMT Rentals is #1. Future verticals copy this shape.
 *
 * Spec: docs/superpowers/specs/2026-06-21-moe-legacy-agency-saas-design.md
 */

import type { AppRoleToken } from "@/lib/auth-roles";
import type { OrgRole } from "@/lib/db-vocab";

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
};

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
    tone_adjustment:
      "Bella concierge voice: warm, confident, playful, decisive. Seductive through competence — never explicit. One ask at a time.",
    hot_lead_keywords: ["need a car", "rent today", "book me", "lock it in", "tesla rental"],
    forbidden_phrases: ["guaranteed approval", "lingerie", "nude"],
  },
  revenueTags: ["member-97"],
  monthlyTokenAllotment: 500,
  foundingAdminEmails: [],
};

export const MOE_LEGACY: VerticalConfig = {
  slug: "moe-legacy",
  orgName: "Moe Legacy",
  displayName: "AIXMOS Credit",
  shortName: "AIXMOS Credit",
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
  foundingAdminEmails: [],
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

/**
 * Seat stage → auth + org_roles mapping for provisioning.
 *
 * `appRole` is written to the JWT (`app_metadata.role`) and `orgRole` to
 * `org_roles.role`, so both are narrowed from their vocabularies: `Extract`
 * keeps the literal types callers see today and fails to compile if a value
 * ever leaves `APP_ROLE_TOKENS` or `ORG_ROLES` (F-15). The same stages live in
 * `config/verticals.json` for `scripts/provision-tenant-seat.mjs`;
 * `role-vocabulary.test.ts` checks the two agree on roles.
 */
export function seatPlanForStage(stage: VerticalSeatStage): {
  appRole: Extract<AppRoleToken, "operator" | "partner">;
  orgRole: Extract<OrgRole, "tenant_admin" | "dispatcher" | "viewer">;
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
