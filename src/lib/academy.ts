// AIXMOS Pocket — Operator Academy (the "learn" half of learn-earn-churn).
//
// Static taste lessons. Copy is compliance-locked: credit GUIDANCE/education,
// never "repair"; earnings are on collected sales only, never guaranteed.
// See docs/aixmos-pocket/COPY.md.

export interface Lesson {
  slug: string;
  title: string;
  minutes: number;
  /** Short paragraphs, rendered in order. */
  body: string[];
}

export const ACADEMY_LESSONS: Lesson[] = [
  {
    slug: "how-the-network-earns",
    title: "How the network earns",
    minutes: 3,
    body: [
      "AIXMOS is a network of small businesses that help each other grow — rentals, " +
        "memberships, credit guidance, builds, and referrals. You start as a member, " +
        "learn the system, earn as you refer, and can climb toward running your own piece of it.",
      "The model is simple: real value, real sales. You're paid a commission on sales " +
        "that are actually collected — never on hype, sign-ups, or promises. No guaranteed " +
        "income; honest money on honest work.",
      "Your job at the start: learn the offers well enough to point the right person to the " +
        "right rung, and share your link. The network handles fulfillment and support.",
    ],
  },
  {
    slug: "credit-guidance-basics",
    title: "Credit guidance, the right way",
    minutes: 4,
    body: [
      "We do credit GUIDANCE and education — helping people understand their report, build a " +
        "plan, and take the next step. We are not a credit repair company, we don't 'fix' or " +
        "'delete' anything for anyone, and we never promise a score or an outcome.",
      "Why the wording matters: it keeps members safe and keeps the business compliant. Always " +
        "say guidance, coach, plan, education. Never say repair, fix, delete, guarantee, or 100%.",
      "When someone needs regulated help (a lawyer, a licensed advisor), we say so and point " +
        "them to a real professional. Protect the person first — that's the whole point.",
    ],
  },
  {
    slug: "where-leads-come-from",
    title: "Where your leads come from",
    minutes: 3,
    body: [
      "Two agencies drive the network. AIXMOS CREDIT runs credit-guidance and business-" +
        "funding — people seeking capital. TMMT RENTALS runs car brokering, rentals, and " +
        "transportation — people who need a vehicle (B2B and B2C). Both run ads.",
      "Those ads feed one shared, attributed lead pool. Leads route by what the person " +
        "wants — a renter to the rentals side, a capital seeker to the funding side — into " +
        "the right agency, then down to operators like you.",
      "As an operator with your own sub-account, you claim leads from the pool, work them, " +
        "and close them with the engine (PROJECT AIXMOS) in your pocket. You're paid a " +
        "single-tier commission on sales that are actually collected — never on hype.",
      "It's a plug-and-play business: the infrastructure, tools, and engine are set up for " +
        "you once you join the mesh. Your job is to serve the person in front of you well.",
    ],
  },
  {
    slug: "your-first-referrals",
    title: "Your first referrals",
    minutes: 3,
    body: [
      "Open the Earn tab and copy your personal link. Share it with people who'd genuinely " +
        "benefit — not spam. When someone you referred buys and the sale is collected, you earn.",
      "Keep it honest: describe what the offer actually does. Over-promising hurts the person, " +
        "hurts you, and hurts the network. Under-promise, over-deliver.",
      "Track your collected earnings in the Earn tab. As you build a steady track record, you " +
        "open the door to becoming an operator with your own scope.",
    ],
  },
  {
    slug: "the-climb",
    title: "The climb: member to operator",
    minutes: 2,
    body: [
      "Members who learn and earn consistently can be invited to become TMMT operators — with " +
        "their own fenced scope and a path toward running their own location or business.",
      "The owner promotes operators directly; it isn't automatic, and it's earned. The Climb tab " +
        "shows the rungs ahead, from your first taste build up to a full done-for-you ecosystem.",
    ],
  },
];

export function getLesson(slug: string): Lesson | undefined {
  return ACADEMY_LESSONS.find((l) => l.slug === slug);
}
