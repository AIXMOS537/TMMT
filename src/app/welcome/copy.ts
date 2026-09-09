/**
 * The public front door for tmmtrentals.com.
 *
 * Copy lives here, not inline in the JSX, so copy-compliance.test.ts can reach
 * every customer-visible string. Copy the test cannot read is copy the test
 * does not guard.
 *
 * Written from what the business actually is (see docs and the qualification
 * rules): TMMT Rentals rents vehicles long-term to Uber/Lyft and gig drivers.
 * Screening is driving record, platform activation, earnings and ability to pay
 * weekly — credit score is a weak predictor here and is not the gate. Nothing
 * on this page may promise an outcome, quantify a score, or count customers.
 *
 * Plain language on purpose: short sentences, common words, no slang, no jokes.
 */

export interface Section {
  heading: string;
  body: string;
  items?: string[];
}

export const HERO = {
  eyebrow: "TMMT Rentals",
  headline: "Rent a car. Go to work.",
  subhead:
    "We rent cars by the week to Uber, Lyft and delivery drivers. You drive, you earn, you pay weekly. When you are ready, we teach you to run a fleet of your own.",
  primaryCta: "See if you qualify",
  primaryHref: "/forms/lead-intake",
  secondaryCta: "Questions? Talk to us",
  secondaryHref: "/forms/customer-intake",
} as const;

export const WHAT_WE_LOOK_AT: Section = {
  heading: "What we look at",
  body: "Four things. That is the whole list.",
  items: [
    "Your driver's license and your driving record.",
    "Whether the apps will let you drive for them.",
    "How many hours you plan to work.",
    "Your deposit and how you will pay each week.",
  ],
};

export const CREDIT: Section = {
  heading: "Your credit score is not the gate",
  body:
    "Most rental places start with your credit. We do not. A credit check cannot tell us the one thing that matters most — whether the apps will activate you. If they will not, you cannot earn, and the car does not help you. So we check that first. This is a rental agreement, not a loan, and it is not credit repair.",
};

export const HOW_IT_WORKS: Section = {
  heading: "How it works",
  body: "Four steps, start to keys.",
  items: [
    "Fill out the short form. It takes about five minutes.",
    "We check your license, your record and your driver account.",
    "We tell you yes, no, or what to fix first.",
    "You put down your deposit and pick up the car.",
  ],
};

export const ACADEMY: Section = {
  heading: "Want your own fleet?",
  body:
    "TMMT Academy teaches drivers how to run a rental business — the same way we run ours. You learn the paperwork, the screening, the upkeep and the day-to-day. Ask us about the next group.",
  items: ["Weekly live sessions", "The checklists our own team uses", "Help after the course ends"],
};

export const ACADEMY_CTA = { label: "Ask about the Academy", href: "/forms/academy-join" } as const;

export const HONEST_NOTE =
  "Not everyone qualifies, and we will tell you plainly if you do not. If a car is not the right fit today, we will point you to what is. Results are different for every driver.";

export const STAFF = {
  label: "TMMT staff and partners",
  linkLabel: "Sign in",
  href: "/login",
} as const;

export const LEGAL_LINKS = [
  { label: "Rental agreement", href: "/legal/rental" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Text messages", href: "/legal/sms" },
] as const;

export const SECTIONS: readonly Section[] = [WHAT_WE_LOOK_AT, CREDIT, HOW_IT_WORKS, ACADEMY];
