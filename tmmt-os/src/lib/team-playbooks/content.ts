export type PlaybookLink = { label: string; href: string };

export type PlaybookSection = {
  title: string;
  body: string;
  checklist?: string[];
  links?: PlaybookLink[];
};

export type TeamPlaybook = {
  slug: string;
  title: string;
  description: string;
  sections: PlaybookSection[];
};

const OPS_LINKS: PlaybookLink[] = [
  { label: "Ops dashboard", href: "/internal/dashboard" },
  { label: "Cases", href: "/internal/cases" },
  { label: "Client journey", href: "/internal/journey" },
  { label: "Operators", href: "/internal/operators" },
  { label: "CRM sync queue", href: "/internal/sync" },
  { label: "GHL live sync", href: "/internal/ghl-sync" },
  { label: "Ledger", href: "/internal/ledger" },
];

export const TEAM_PLAYBOOKS: Record<string, TeamPlaybook> = {
  sops: {
    slug: "sops",
    title: "Standard operating procedures",
    description: "Daily rental ops — what to do in TMMT OS and when to move GHL.",
    sections: [
      {
        title: "Start of shift",
        body: "Open the ops dashboard on your phone. Triage new intake and CRM sync items before touching individual cases.",
        checklist: [
          "Open /internal/dashboard — review Mobile Ops Triage counts",
          "Approve or reject pending items in /internal/sync",
          "Assign yourself to blocked or overdue cases",
        ],
        links: OPS_LINKS,
      },
      {
        title: "Field visit (pickup / return / inspection)",
        body: "Every visit ties to a case. Document photos and damage on the case detail page so the client sees updates on My vehicle.",
        checklist: [
          "Open the case from /internal/cases",
          "Scroll to Field documentation",
          "Log damage with severity; toggle Show on client hub when the renter should see it",
          "Upload photos (use phone camera — capture is enabled)",
          "Advance case status to match what happened (e.g. vendor_in_progress → active rental)",
        ],
        links: [{ label: "Cases", href: "/internal/cases" }],
      },
      {
        title: "When GHL stage changes",
        body: "GHL webhooks create CRM sync rows. Auto-ops may verify and create cases. If not auto-applied, approve manually in the sync queue.",
        checklist: [
          "Confirm contact email matches the renter profile",
          "Approve sync in /internal/sync",
          "Verify client rental status at /client/rental (or ask them to check My vehicle)",
        ],
        links: [{ label: "CRM sync", href: "/internal/sync" }],
      },
      {
        title: "Money & deposits",
        body: "Post ledger lines from the case or ledger page. Only mark visible to client when the renter should see the charge on billing.",
        checklist: [
          "Use Financial ledger on the case",
          "Set entry type: deposit, deduction, refund, or expense",
          "Check Show on client billing when appropriate",
        ],
        links: [{ label: "Ledger", href: "/internal/ledger" }],
      },
    ],
  },
  support: {
    slug: "support",
    title: "Support workflows",
    description: "Tickets, escalations, and client communication.",
    sections: [
      {
        title: "New client ticket",
        body: "Clients open tickets from /client/support. Each ticket is a case scoped to their email.",
        checklist: [
          "Find the case in /internal/cases (filter by email if needed)",
          "Acknowledge within SLA — add a note via status history",
          "If rental-related, link work to GHL contact when possible",
        ],
        links: OPS_LINKS,
      },
      {
        title: "Escalation",
        body: "Set case status to blocked when waiting on client, vendor, or payment. Move back to internal_review when unblocked.",
        checklist: [
          "blocked → document reason in status note",
          "Notify client via your normal channel (SMS/email in GHL)",
          "Unblock only when the blocker is cleared",
        ],
      },
    ],
  },
  "client-onboarding": {
    slug: "client-onboarding",
    title: "Client onboarding",
    description: "From sale to first login on the client portal.",
    sections: [
      {
        title: "After contract signed",
        body: "Ensure the renter has a Supabase login with the same email as GHL. Assign package in admin.",
        checklist: [
          "Client signs up at /login (magic link)",
          "Admin → /admin/users → portal_role client + package (Growth/Elite)",
          "Sync ops role is not needed for clients",
          "Confirm /client/rental and /client/vehicle load",
          "At active rental: assign credit Path A ($97/mo) or Path B ($250+$250) in /internal/journey",
          "Client completes /client/credit acknowledgments and /client/training core modules",
        ],
        links: [
          { label: "User management", href: "/admin/users" },
          { label: "Client journey", href: "/internal/journey" },
        ],
      },
      {
        title: "Credit → LTO graduation",
        body: "Restoration stays out of the Rentals GHL pipeline. Use TMMT Restoration stages and tags per INTEGRATIONS/GHL_RESTORATION_PIPELINE_BLUEPRINT.md.",
        checklist: [
          "Never assign Path A and Path B together — mutual exclusion in TMMT OS",
          "Path C ($1k mentorship) only after base path satisfied",
          "LTO requires: base path + all education acks + all core training + 90d good standing",
          "Run cron: POST /api/cron/journey-recompute after ledger or stage changes",
        ],
        links: [{ label: "Journey hub", href: "/internal/journey" }],
      },
      {
        title: "Investor / demo walkthrough",
        body: "Show one renter email end-to-end: GHL stage → sync → client hub → ops case with field photos.",
        checklist: [
          "Run supabase/seed_demo_rental.sql for demo email OR use a real active booking",
          "Show /client/vehicle as the renter view",
          "Show /internal/cases/[id] field documentation as ops view",
        ],
      },
    ],
  },
  sales: {
    slug: "sales",
    title: "Sales & marketing",
    description: "Segments, content mix, VIP CTA — adapted from Marketing Rollout Plan.",
    sections: [
      {
        title: "Portal value prop",
        body: "One login for rental status, vehicle photos, damages, billing, and tickets — updated as your team works the deal in GHL.",
        checklist: [
          "Mention real-time rental status from GoHighLevel",
          "My vehicle hub for transparency on damages and deposits",
          "Team works cases in TMMT OS — nothing falls through cracks",
        ],
      },
      {
        title: "Audience segments",
        body: "Pick one segment before writing content or DMs.",
        checklist: [
          "Hustler (25–38): proof Reels, 'that could be me' → $97 Foundation",
          "Operator (30–45): systems, leverage, infrastructure → $3.75k+ tracks",
          "VIP Insider: invitation tone, not hard sell → VIP → operator → B-in-a-Box",
        ],
      },
      {
        title: "Content mix & calendar",
        body: "Organic first. Ads ($5–15/day) only amplify what already works.",
        checklist: [
          "40% proof · 30% education · 20% story · 10% direct offer (max)",
          "4-week rotation: Proof → Education → Story → Behind-the-scenes",
          "Tier 1 daily: Instagram + TikTok; Tier 2: YouTube + Facebook 3–5×/week",
          "Primary CTA: join VIP / $97 subscribe — every channel",
        ],
      },
      {
        title: "30-day launch milestones",
        body: "First campaign cycle targets (Chief of Marketing brief).",
        checklist: [
          "Day 30: ~50 VIP subs, ~$5k MRR, 500+ new followers, 3 ad tests live",
          "Week 1: brand reveal, proof Reel, system explainer, BTS app tour, 50 warm DMs",
          "Weekly report Monday: followers, views, DMs, calls booked, new $97 subs",
        ],
      },
    ],
  },
  mission: {
    slug: "mission",
    title: "Mission & roadmap",
    description: "TMMT × AIXMOS ecosystem — base layer, 30/50 apps, partner teams.",
    sections: [
      {
        title: "What we ship",
        body: "TMMT OS is Wave 1 App #01 (Rentals OS): the Operate module for vehicle rental — cases, fleet, ledger, CRM sync, and three portals. GHL is CRM; the four client modules are Dashboard, Learn, Marketplace, Operate.",
        links: [
          { label: "Home", href: "/" },
          { label: "Team dashboard", href: "/team/dashboard" },
          { label: "Framework doc", href: "/team/mission" },
        ],
      },
      {
        title: "Offer ladder (all verticals)",
        body: "Every app runs the same tiers. Rentals/coaching uses TMMT OS + GHL; partner apps white-label the base.",
        checklist: [
          "$97/mo — subscription (VIP network / app access)",
          "$397–$1k — Foundation",
          "$1,875–$3,750 — Systems track",
          "$7,500 — Infrastructure pack",
          "$15k–$50k — Scale / B-in-a-Box",
        ],
      },
      {
        title: "Partner teams (30-app initiative)",
        body: "Each vertical = 5–10 partner operators (not W-2). Required: Team Lead, Dev/Tech, Content, Sales, VA/Ops.",
        checklist: [
          "Wave 1 active: Rentals OS, Property, Service Arbitrage, Fleet Manager, Vendor Connect",
          "Monthly Operator Council for cross-vertical learning",
          "See docs/framework/OPERATING_MODEL.md in repo for full roadmap",
        ],
      },
    ],
  },
  training: {
    slug: "training",
    title: "Internal training",
    description: "Operator certification checklist.",
    sections: [
      {
        title: "Operator certification",
        body: "Complete these once before working cases solo. Score clients at /internal/operators using the 7-category rubric (100 pts).",
        checklist: [
          "Log in and reach /internal/dashboard",
          "Open /internal/journey for an active renter — assign credit path",
          "Advance a test case status and confirm activity log",
          "Upload a test photo on a case (field documentation)",
          "Approve a CRM sync row (or observe auto-ops)",
          "Open /client/vehicle as a test client user",
        ],
        links: OPS_LINKS,
      },
      {
        title: "VA executive team (6 roles)",
        body: "VAs elevate to Directors reporting to COO — not a task pool. Founder syncs with COO only (9AM briefing).",
        checklist: [
          "COO: daily briefing, ClickUp, pipeline stalled >48hr",
          "Client Experience: churn <5%, Day 7/14/30 check-ins",
          "Pipeline & Sales: 30–50 DMs/day, 5+ strategy calls/week",
          "Content & Scheduling: Sunday queue, 5+ posts/week all platforms",
          "Fleet & Rentals: Airtable + Turo, <2hr guest response",
          "Data & Reporting: weekly KPI by Sunday 8PM",
        ],
        links: OPS_LINKS,
      },
      {
        title: "Operator rubric bands",
        body: "Monthly COO run on active subscribers. TMMT OS syncs GHL tags and journey track.",
        checklist: [
          "90–100: master candidate — book operator conversation now",
          "75–89: strong — discovery call within 2 weeks",
          "70–89: certified / operator_candidate in app",
          "60–69: developing — GHL operator:candidate nurture only",
          "Below 60: deliver value; rescore in 60 days",
        ],
        links: [{ label: "Operators", href: "/internal/operators" }],
      },
      {
        title: "Journey lifecycle smoke (E2E)",
        body: "Full renter → credit → LTO → operator path. Follow docs/SMOKE_JOURNEY_LIFECYCLE.md after migration 0014 is applied.",
        checklist: [
          "GHL rental stage → client rental hub updates",
          "Assign Path A or B — never both",
          "Client completes /client/credit + /client/training core modules",
          "Cron journey-recompute → 90d good standing → LTO eligible",
          "Staff: LTO agreement + vehicle turnover on journey detail",
          "Rubric ≥70 → operator_candidate on /client/upgrade (60–69 = nurture only)",
          "Optional: COMMAND_CENTER_* env shows legacy contracts on journey page",
        ],
        links: [
          { label: "Journey hub", href: "/internal/journey" },
          { label: "Operators", href: "/internal/operators" },
        ],
      },
    ],
  },
  performance: {
    slug: "performance",
    title: "Marketing performance",
    description: "Weekly KPI targets and content mix — use the live dashboard.",
    sections: [
      {
        title: "Live dashboard",
        body: "Log and review weekly marketing KPIs with Month 1 vs Month 3 targets from the rollout plan.",
        links: [{ label: "Performance dashboard", href: "/team/performance" }],
      },
      {
        title: "Content mix",
        body: "40% proof · 30% education · 20% story · 10% direct offer (max).",
        checklist: [
          "Primary CTA: VIP / $97 subscribe on every channel",
          "IG + TikTok daily; YouTube + Facebook 3–5×/week",
          "Ads $5–15/day only after organic proof posts work",
        ],
      },
    ],
  },
};

export function getTeamPlaybook(slug: string): TeamPlaybook | null {
  return TEAM_PLAYBOOKS[slug] ?? null;
}
