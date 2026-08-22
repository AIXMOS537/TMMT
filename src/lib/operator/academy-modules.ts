/** 15-module AIXMOS Operator cert path. Fallback when operator_training_modules is empty. */

export type AcademyModule = {
  id: string;
  track: string;
  slug: string;
  title: string;
  objective: string;
  est_minutes: number;
  sort_order: number;
  drill: string;
  pass_criteria: string;
  content_md: string;
};

export const ACADEMY_MODULES: readonly AcademyModule[] = [
  {
    id: "lec-01",
    track: "learn",
    slug: "welcome",
    title: "Welcome to AIXMOS",
    objective: "Name the product, the empire, and what money never buys.",
    est_minutes: 20,
    sort_order: 1,
    drill: "Write one sentence: AIXMOS is what they buy. HAILMARY is never sold.",
    pass_criteria: "Can state the naming law without using a fourth public brand.",
    content_md:
      "## One product\n\n**AIXMOS** is the public operating system. **PROJECT X HAILMARY** is the owner empire — money never buys it. **Crimson Shadow** is an internal install nickname for AIXMOS on a machine. Clients say AIXMOS.",
  },
  {
    id: "lec-02",
    track: "learn",
    slug: "two-doors",
    title: "The two doors",
    objective: "Route a buyer to Dealer flagship or $97 Operator without mixing SKUs.",
    est_minutes: 25,
    sort_order: 2,
    drill: "Qualify a mock buyer: lot owner vs solo entrepreneur.",
    pass_criteria: "Picks Dealer Bundle/Ops Kit or $97 — never both as one invoice.",
    content_md:
      "## Two doors\n\n- **Dealer** — mom-and-pop lots. Ops Kit $997+$297/mo or Dealer Bundle $3,497+$697/mo. Dedicated instance.\n- **Operator** — $97/mo, 500 tokens, this academy.\n\nCredit guidance is later and legal-gated.",
  },
  {
    id: "lec-03",
    track: "learn",
    slug: "intake",
    title: "Intake that does not die",
    objective: "Get every lead off texts and clipboards into one form.",
    est_minutes: 30,
    sort_order: 3,
    drill: "Submit /forms/lead-intake with a test name and confirm it lands.",
    pass_criteria: "Can show a lead in the admin pipeline within 5 minutes.",
    content_md:
      "## Why lots lose money\n\nLeads die in Facebook DMs and notebooks. Public intake writes to the people spine. Follow-up is the product.",
  },
  {
    id: "lec-04",
    track: "learn",
    slug: "ghl-hub",
    title: "GHL is the hub, not a second pile",
    objective: "Explain checkout, tags, and webhooks without selling a second CRM.",
    est_minutes: 30,
    sort_order: 4,
    drill: "List the four P0 checkout env vars from docs/GHL-FLAGSHIP-ENV-MAP.md.",
    pass_criteria: "Names member-97 and kit-ordered-dealer-bundle correctly.",
    content_md:
      "## Money + CRM\n\nGoHighLevel keeps checkout and nurture. Vercel keeps ops. Tags: `member-97`, `kit-ordered-ops-kit`, `kit-ordered-dealer-bundle`.",
  },
  {
    id: "lec-05",
    track: "earn",
    slug: "ops-desk",
    title: "TMMT Ops floor desk",
    objective: "Run a day on the floor: vehicles, tickets, payments.",
    est_minutes: 40,
    sort_order: 5,
    drill: "Add one vehicle and one ticket on the demo ops desk.",
    pass_criteria: "Can walk a floor manager through login → first ticket.",
    content_md:
      "## Floor desk\n\nAIXMOS Dealer is not a DMS. It stacks beside what they have. Daily: fleet, customers, tickets, payments.",
  },
  {
    id: "lec-06",
    track: "earn",
    slug: "fleet-lot",
    title: "Fleet and lot",
    objective: "Track units so the owner is not blind.",
    est_minutes: 35,
    sort_order: 6,
    drill: "Map 5 units into statuses the owner can read in 10 seconds.",
    pass_criteria: "Owner can answer 'what's on the lot' without a phone call.",
    content_md:
      "## Owner blindness\n\nIf the owner has to text the floor to know what's out, the system is not live. Command Center exists for that.",
  },
  {
    id: "lec-07",
    track: "earn",
    slug: "follow-up",
    title: "Follow-up that closes",
    objective: "Turn a missed call into a booked return or a deal.",
    est_minutes: 35,
    sort_order: 7,
    drill: "Write a 3-touch follow-up for a no-show (hour 1, day 1, day 3).",
    pass_criteria: "No 'just checking in' copy. Every touch has a next step.",
    content_md:
      "## The extra deal\n\nPitch: if this closes one extra deal a month, it pays for itself. Follow-up is the missing piece, not traffic.",
  },
  {
    id: "lec-08",
    track: "earn",
    slug: "command",
    title: "Owner command center",
    objective: "Show the owner numbers without another dashboard SaaS.",
    est_minutes: 25,
    sort_order: 8,
    drill: "Open /command on demo and name three tiles the owner cares about.",
    pass_criteria: "Can demo Command in under 3 minutes.",
    content_md:
      "## Command\n\nDealer Bundle includes Command Center. Ops Kit is floor-only. Do not upsell Command as a fourth brand.",
  },
  {
    id: "lec-09",
    track: "earn",
    slug: "tokens",
    title: "Tokens and the $97 seat",
    objective: "Explain 500 tokens/mo without promising income.",
    est_minutes: 20,
    sort_order: 9,
    drill: "Enroll a test contact with tag member-97 (sandbox only).",
    pass_criteria: "Never says guaranteed income. Sells the system + path.",
    content_md:
      "## Operator door\n\n$97/mo grants 500 tokens when the GHL webhook fires. Until checkout URLs exist, campaign UTMs still land on the GHL site.",
  },
  {
    id: "lec-10",
    track: "learn",
    slug: "credit-posture",
    title: "Credit guidance vs repair",
    objective: "Keep credit language legal.",
    est_minutes: 25,
    sort_order: 10,
    drill: "Rewrite a banned sentence: 'we will raise your score 47 points'.",
    pass_criteria: "Zero 'repair' / score-guarantee language.",
    content_md:
      "## Legal\n\nWe educate. We do not operate as a CRO until L1–L10 are signed. Dealer pitch today is software-only.",
  },
  {
    id: "lec-11",
    track: "learn",
    slug: "compliance",
    title: "Compliance posture",
    objective: "Know L10: customer financials stay off operator eyes.",
    est_minutes: 20,
    sort_order: 11,
    drill: "List three things an operator must never see.",
    pass_criteria: "Names L10 data fence and Moe Legacy bound (credit/GHL only).",
    content_md:
      "## Fences\n\nMoe Legacy = credit/GHL only, zero engine. Muhammad Umar = zero. Operators do not see customer financials.",
  },
  {
    id: "lec-12",
    track: "earn",
    slug: "dealer-close",
    title: "Close a mom-and-pop dealer",
    objective: "Run the 15-minute demo and ask for the Bundle.",
    est_minutes: 40,
    sort_order: 12,
    drill: "Role-play the 30-second pitch from docs/sales/MOM-AND-POP-OFFER.md.",
    pass_criteria: "Qualifies 3 of 5 bouncer checks before quoting.",
    content_md:
      "## Close\n\nDemo `/kits` + lead-intake. Close Dealer Bundle. Tag `dealer-prospect` → `kit-ordered-dealer-bundle`. Script: `~/Sync/rick/SALES-SCRIPTS/MOM-POP-DEALER-CLOSE-SCRIPT.md`.",
  },
  {
    id: "lec-13",
    track: "earn",
    slug: "provision",
    title: "Provision and handoff",
    objective: "Generate OPERATOR-START-HERE without a placeholder logo go-live.",
    est_minutes: 30,
    sort_order: 13,
    drill: "Run `npm run provision-dealer -- --dealer \"Demo Lot\" --email demo@lot.test --dry-run`.",
    pass_criteria: "Knows --apply writes local handoff only; cloud projects stay manual.",
    content_md:
      "## Factory\n\n`scripts/provision-dealer-instance.mjs`. Dry-run first. No generated two-letter monogram on a live dealer.",
  },
  {
    id: "lec-14",
    track: "churn",
    slug: "daily-churn",
    title: "Daily churn",
    objective: "Work the desk every day so the system compounds.",
    est_minutes: 20,
    sort_order: 14,
    drill: "Write a 6-item daily checklist for a floor manager.",
    pass_criteria: "Checklist fits on one phone screen.",
    content_md:
      "## Churn\n\nLearn · Earn · Churn. The $97 seat teaches. The dealer instance runs the lot. Daily use is the product.",
  },
  {
    id: "lec-15",
    track: "churn",
    slug: "certify",
    title: "Certify",
    objective: "Know when someone is ready to operate a city.",
    est_minutes: 25,
    sort_order: 15,
    drill: "Score a mock operator on the 100-pt rubric (70+ certified).",
    pass_criteria: "Does not treat operators as employees — licensed partners.",
    content_md:
      "## Cert\n\n70+ certified · 75+ senior · 85+ master. Revenue share is in the operating model. Ask the lead to certify — this module does not flip the switch.",
  },
];

export function academyModuleById(id: string): AcademyModule | undefined {
  return ACADEMY_MODULES.find((m) => m.id === id);
}
