import type { LucideIcon } from "lucide-react";
import { ghlLinks } from "@/lib/ghl-links";
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
    title: "AIXMOS funnel",
    links: [
      {
        href: ghlLinks.upsellPipeline,
        label: "AIXMOS upsell queue",
        description: "GHL contacts tagged ready-for-aixmos → membership → credit",
        icon: TrendingUp,
        badge: "GHL",
        external: true,
      },
      {
        href: "/aixmos/index.html",
        label: "Public AIXMOS site",
        description: "Marketing landing on .com (membership, apply, operator)",
        icon: ExternalLink,
        external: true,
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
        description: "Operational cases and kanban workflow",
        icon: ClipboardCheck,
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
