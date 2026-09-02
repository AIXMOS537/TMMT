import type { LucideIcon } from "lucide-react";
import type { AccessTier } from "@/lib/auth-roles";
import { ghlLinks } from "@/lib/ghl-links";
import { CLICKUP_WORKSPACE_URL } from "@/lib/clickup/config";
import {
  LayoutDashboard,
  Car,
  UserPlus,
  CalendarCheck,
  ClipboardCheck,
  Store,
  Radio,
  Briefcase,
  Wrench,
  Users,
  TrendingUp,
  ExternalLink,
  Handshake,
  Scale,
  Siren,
} from "lucide-react";

/**
 * Purchased org modules — mirrors `organization_licenses.modules` in Supabase
 * (a `full_os` license implies every module).
 */
export const ORG_MODULES = [
  "rentals_app",
  "credit_repair",
  "lease_to_own",
  "operator_program",
  "dispatch_core",
  "agent_sales",
  "partner_deploy",
  "revenue_engine",
] as const;

export type OrgModule = (typeof ORG_MODULES)[number];

/** Third-party connections that must be wired up before we surface their link. */
export type IntegrationId = "clickup" | "ghl";

/** What an account must have bought (or connected) before a link is shown. */
export type CommandHubRequirement = {
  /** Org module from the client's license. */
  module?: OrgModule;
  /** Entitlement slug from the client's package (`package_entitlements`). */
  entitlement?: string;
  /** Access tiers allowed to see the link. Defaults to owner + staff. */
  tiers?: AccessTier[];
  /** Hide unless this connection is configured for the deployment. */
  integration?: IntegrationId;
};

export type CommandHubLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
  requires?: CommandHubRequirement;
};

export const commandHubSections: { title: string; links: CommandHubLink[] }[] = [
  {
    title: "Ops dashboard",
    links: [
      {
        href: "/",
        label: "TMMT dashboard",
        description: "Fleet, leads, tickets, and live KPIs",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Fleet & rentals",
    links: [
      {
        href: "/fleet",
        label: "Fleet",
        description: "Vehicles, availability, maintenance status",
        icon: Car,
        requires: { module: "rentals_app" },
      },
      {
        href: "/appointments",
        label: "Bookings & appointments",
        description: "Scheduled pickups, returns, and calendar",
        icon: CalendarCheck,
        requires: { module: "rentals_app" },
      },
      {
        href: "/maintenance",
        label: "Maintenance",
        description: "Shop work and vehicle downtime",
        icon: Wrench,
        requires: { module: "rentals_app" },
      },
    ],
  },
  {
    title: "AIXMOS cube",
    links: [
      {
        href: "/work/program",
        label: "Program desk (Work face)",
        description: "Credit & funding readiness — staff review queue",
        icon: TrendingUp,
        requires: { module: "credit_repair" },
        badge: "Cube",
      },
      {
        href: "/command/credit-dispute",
        label: "Credit dispute command",
        description: "Dispute Fox + MyFreeScoreNow → deep audit → FCRA letters → funding",
        icon: Scale,
        requires: { module: "credit_repair" },
        badge: "AIXMOS",
      },
      {
        href:
          process.env.NEXT_PUBLIC_CUBE_SAME_ORIGIN === "false"
            ? (process.env.NEXT_PUBLIC_CUBE_LEARN_URL ?? "http://localhost:3001/dashboard")
            : "/learn/dashboard",
        label: "Learn face (client)",
        description: "Education, coach, questionnaires",
        icon: ExternalLink,
        requires: { module: "credit_repair", entitlement: "credit_education_hub" },
        external: process.env.NEXT_PUBLIC_CUBE_SAME_ORIGIN === "false",
      },
      {
        href: ghlLinks.upsellPipeline,
        label: "GHL upsell queue",
        description: "Contacts tagged ready-for-aixmos → membership",
        icon: TrendingUp,
        requires: { integration: "ghl" },
        badge: "GHL",
        external: true,
      },
      {
        href: "https://aixmos-landing.vercel.app/",
        label: "Public AIXMOS site",
        description: "Marketing landing — CTAs go to GHL",
        icon: ExternalLink,
        external: true,
      },
      {
        href: "/upgrade",
        label: "TMMT → AIXMOS ladder",
        description: "Move existing renters into higher GHL tiers",
        icon: TrendingUp,
        requires: { module: "operator_program", entitlement: "upgrade_center" },
        badge: "GHL",
      },
    ],
  },
  {
    title: "Federation",
    links: [
      {
        href: "/command/handoffs",
        label: "Entity handoffs",
        description: "Cross-entity client handoffs (TMMT · AIXMOS · MOE) with consent status",
        icon: Handshake,
        requires: { module: "partner_deploy" },
        badge: "Federation",
      },
      {
        href: "/operators",
        label: "Operators",
        description: "Provision operator sub-accounts under an agency and fund their tokens",
        icon: Users,
        requires: { module: "operator_program" },
        badge: "Network",
      },
    ],
  },
  {
    title: "Pipeline & customers",
    links: [
      {
        href: "/leads",
        label: "Leads",
        description: "Incoming inquiries and qualification",
        icon: UserPlus,
      },
      {
        href: "/customers",
        label: "Customers",
        description: "Active renters and account history",
        icon: Users,
      },
    ],
  },
  {
    title: "Workflow & command",
    links: [
      {
        href: "/dispatch",
        label: "Dispatch cockpit",
        description: "Live incident queue, units on the map, and assignment locks",
        icon: Siren,
        requires: { module: "dispatch_core" },
      },
      {
        href: "/command/desk",
        label: "Command desk",
        description: "Voice → AI refine → dispatch to executive VAs",
        icon: Radio,
        requires: { tiers: ["owner"] },
        badge: "Owner",
      },
      {
        href: "/cases",
        label: "Cases",
        description: "Cases sync to ClickUp on intake and vendor assign",
        icon: ClipboardCheck,
      },
      {
        href: CLICKUP_WORKSPACE_URL,
        label: "ClickUp workspace",
        description: "TMMT RENTALS — fleet, ops, admin lists",
        icon: ExternalLink,
        requires: { integration: "clickup" },
        badge: "ClickUp",
        external: true,
      },
      {
        href: "/workflow-vendors",
        label: "Outside vendors",
        description: "Third-party shops and vendor pipeline",
        icon: Store,
      },
    ],
  },
  {
    title: "Role portals",
    links: [
      {
        href: "/executive",
        label: "Executive VA",
        description: "Published commands and relay to operators",
        icon: Briefcase,
      },
      {
        href: "/operator",
        label: "Operator",
        description: "Field execution and daily ops feed",
        icon: Wrench,
      },
    ],
  },
];
