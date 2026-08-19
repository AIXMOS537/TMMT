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
} from "lucide-react";

export type CommandHubLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
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
      },
      {
        href: "/appointments",
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
        description: "TMMT RENTALS — fleet, ops, admin lists",
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
