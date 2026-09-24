import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

export type CommandHubLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
  /**
   * Restrict this link to specific tenant slugs. Omitted = every operator sees it.
   * Some entries are TMMT's own business, not the product: the TMMT→AIXMOS upgrade
   * ladder, cross-entity handoffs between TMMT/AIXMOS/MOE, and TMMT's ClickUp
   * workspace. A white-labelled operator must never see those — they are not
   * "TMMT branding on a shared feature", they are features that only exist for TMMT.
   */
  tenants?: readonly string[];
};

/** Slugs in tenant-map.generated.ts that belong to Taha's own entities. */
const TMMT_OWN = ["tmmt_property", "aixmos", "aixmos_credit"] as const;

/** Replaced per-request by commandHubSectionsFor() with the tenant's own marketing host. */
const MARKETING_SITE_PLACEHOLDER = "__MARKETING_SITE__";

export const commandHubSections: { title: string; links: CommandHubLink[] }[] = [
  {
    title: "Ops dashboard",
    links: [
      {
        href: "/",
        label: "Dashboard",
        description: "Fleet, leads, tickets, and live KPIs",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Fleet & rentals",
    links: [
      {
        href: "/interfaces/vehicles",
        label: "Fleet",
        description: "Vehicles, availability, maintenance status",
        icon: Car,
      },
      {
        href: "/interfaces/appointments",
        label: "Bookings & appointments",
        description: "Scheduled pickups, returns, and calendar",
        icon: CalendarCheck,
      },
      {
        href: "/maintenance",
        label: "Maintenance",
        description: "Shop work and vehicle downtime",
        icon: Wrench,
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
        badge: "Cube",
      },
      {
        href: "/command/credit-dispute",
        label: "Credit dispute command",
        description: "Dispute Fox + MyFreeScoreNow import → deep audit → letters (legal-gated)",
        icon: Scale,
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
        external: process.env.NEXT_PUBLIC_CUBE_SAME_ORIGIN === "false",
      },
      {
        href: ghlLinks.upsellPipeline,
        label: "GHL upsell queue",
        description: "Contacts tagged ready-for-aixmos → membership",
        icon: TrendingUp,
        badge: "GHL",
        external: true,
      },
      {
        href: MARKETING_SITE_PLACEHOLDER,
        label: "Public site (GHL)",
        description: "All In One Management — every public visitor lands here",
        icon: ExternalLink,
        external: true,
      },
      {
        href: "/upgrade",
        label: "TMMT \u2192 AIXMOS ladder",
        tenants: TMMT_OWN,
        description: "Move existing renters into higher GHL tiers",
        icon: TrendingUp,
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
        description: "Cross-entity client handoffs (TMMT \u00b7 AIXMOS \u00b7 MOE) with consent status",
        tenants: TMMT_OWN,
        icon: Handshake,
        badge: "Federation",
      },
      {
        href: "/operators",
        label: "Operators",
        description: "Provision operator sub-accounts under an agency and fund their tokens",
        icon: Users,
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
        href: "/command/desk",
        label: "Command desk",
        description: "Voice → AI refine → dispatch to executive VAs",
        icon: Radio,
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
        description: "TMMT RENTALS \u2014 fleet, ops, admin lists",
        tenants: TMMT_OWN,
        icon: ExternalLink,
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

/**
 * Brand-aware view of the hub. Resolves the tenant's own marketing site and drops
 * links that belong to TMMT's entities rather than to the product.
 *
 * Why this exists: the hub previously hardcoded "TMMT" and
 * allinonemanagementsolutions.com, so an operator on a white-labelled app opened
 * their command centre and saw someone else's brand and someone else's public site.
 * The pricing doctrine is that every customer gets a setup that looks like THEIR
 * own system, and the tenant config to do it already existed - the hub just ignored it.
 */
export function commandHubSectionsFor(brand: {
  slug: string;
  domains: { readonly marketing?: string };
}): { title: string; links: CommandHubLink[] }[] {
  const site = brand.domains.marketing
    ? `https://${brand.domains.marketing}/`
    : null;
  return commandHubSections
    .map((section) => ({
      title: section.title,
      links: section.links
        .filter((l) => !l.tenants || l.tenants.includes(brand.slug))
        // no marketing host configured -> drop the link rather than ship a dead one
        .filter((l) => l.href !== MARKETING_SITE_PLACEHOLDER || site !== null)
        .map((l) =>
          l.href === MARKETING_SITE_PLACEHOLDER && site ? { ...l, href: site } : l,
        ),
    }))
    .filter((section) => section.links.length > 0);
}
