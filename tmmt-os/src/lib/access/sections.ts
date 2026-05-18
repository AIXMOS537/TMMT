export type PortalSection = {
  slug: string;
  title: string;
  description: string;
  href: string;
  entitlement: string;
};

export const CLIENT_SECTIONS: PortalSection[] = [
  {
    slug: "apps",
    title: "Your apps & tools",
    description: "Apps included in your package.",
    href: "/client/apps",
    entitlement: "app_a",
  },
  {
    slug: "documents",
    title: "Documents",
    description: "Contracts, guides, and shared files.",
    href: "/client/documents",
    entitlement: "docs_library",
  },
  {
    slug: "training",
    title: "Training modules",
    description: "Courses and progress for your plan.",
    href: "/client/training",
    entitlement: "training_fundamentals",
  },
  {
    slug: "onboarding",
    title: "Onboarding",
    description: "Steps to get fully set up.",
    href: "/client/onboarding",
    entitlement: "onboarding_steps",
  },
  {
    slug: "support",
    title: "Support tickets",
    description: "Open and track support requests.",
    href: "/client/support",
    entitlement: "support_tickets",
  },
  {
    slug: "billing",
    title: "Billing & package",
    description: "Plan details and invoices.",
    href: "/client/billing",
    entitlement: "billing_portal",
  },
  {
    slug: "announcements",
    title: "Announcements",
    description: "Updates from TMMT / AIXMOS.",
    href: "/client/announcements",
    entitlement: "announcements",
  },
  {
    slug: "upgrade",
    title: "Upgrade options",
    description: "Move to Growth or Elite.",
    href: "/client/upgrade",
    entitlement: "upgrade_center",
  },
];

export const TEAM_SECTIONS: PortalSection[] = [
  {
    slug: "mission",
    title: "Mission & roadmap",
    description: "Where we're going as a company.",
    href: "/team/mission",
    entitlement: "team_mission",
  },
  {
    slug: "training",
    title: "Internal training",
    description: "Team courses and certifications.",
    href: "/team/training",
    entitlement: "team_training",
  },
  {
    slug: "sops",
    title: "SOPs",
    description: "Standard operating procedures.",
    href: "/team/sops",
    entitlement: "team_sops",
  },
  {
    slug: "sales",
    title: "Sales scripts",
    description: "Talk tracks and objection handling.",
    href: "/team/sales",
    entitlement: "team_sales_scripts",
  },
  {
    slug: "client-onboarding",
    title: "Client onboarding",
    description: "How we onboard paying clients.",
    href: "/team/client-onboarding",
    entitlement: "team_onboarding_process",
  },
  {
    slug: "support",
    title: "Support workflows",
    description: "Ticket and escalation playbooks.",
    href: "/team/support",
    entitlement: "team_support_workflows",
  },
  {
    slug: "tasks",
    title: "Task assignments",
    description: "Your queue and team tasks.",
    href: "/team/tasks",
    entitlement: "team_tasks",
  },
  {
    slug: "announcements",
    title: "Team announcements",
    description: "Internal news and priorities.",
    href: "/team/announcements",
    entitlement: "team_announcements",
  },
  {
    slug: "performance",
    title: "Performance",
    description: "Dashboards and KPIs.",
    href: "/team/performance",
    entitlement: "team_performance",
  },
];

export const ADMIN_SECTIONS: PortalSection[] = [
  {
    slug: "users",
    title: "User management",
    description: "Clients, team, roles, packages.",
    href: "/admin/users",
    entitlement: "admin_users",
  },
  {
    slug: "packages",
    title: "Packages",
    description: "Starter, Growth, Elite, custom.",
    href: "/admin/packages",
    entitlement: "admin_packages",
  },
  {
    slug: "entitlements",
    title: "Module access",
    description: "Apps, training, and feature flags.",
    href: "/admin/entitlements",
    entitlement: "admin_entitlements",
  },
  {
    slug: "revenue",
    title: "Revenue & subscriptions",
    description: "Billing overview.",
    href: "/admin/revenue",
    entitlement: "admin_revenue",
  },
  {
    slug: "clients",
    title: "Client activity",
    description: "Usage and engagement.",
    href: "/admin/clients",
    entitlement: "admin_client_activity",
  },
  {
    slug: "team-activity",
    title: "Team activity",
    description: "Internal ops signals.",
    href: "/admin/team-activity",
    entitlement: "admin_team_activity",
  },
  {
    slug: "documents",
    title: "Documents",
    description: "Uploaded files across portals.",
    href: "/admin/documents",
    entitlement: "admin_documents",
  },
  {
    slug: "training",
    title: "Training completion",
    description: "Progress across clients & team.",
    href: "/admin/training",
    entitlement: "admin_training_completion",
  },
  {
    slug: "support",
    title: "Support overview",
    description: "Open tickets and SLAs.",
    href: "/admin/support",
    entitlement: "admin_support_overview",
  },
  {
    slug: "overrides",
    title: "Access overrides",
    description: "Manual entitlement grants.",
    href: "/admin/overrides",
    entitlement: "admin_access_overrides",
  },
];
