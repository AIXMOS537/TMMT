export type FormSite = "aixmos" | "tmmt";

export type FormFamily =
  | "engine"
  | "cars"
  | "home"
  | "school"
  | "money"
  | "lane"
  | "ops";

export type PublicForm = {
  slug: string;
  href: string;
  title: string;
  kid: string;
  family: FormFamily;
  cost: string;
  time: string;
  what: string;
  sites: readonly FormSite[];
};

/** Color tokens match the live-brain city paint. */
export const FORM_FAMILY_COLOR: Record<FormFamily, { bg: string; fg: string; label: string }> = {
  engine: { bg: "#00D4FF", fg: "#071018", label: "ENGINE" },
  cars: { bg: "#F5A623", fg: "#1a1204", label: "CARS" },
  home: { bg: "#22C55E", fg: "#04140a", label: "HOME" },
  school: { bg: "#A78BFA", fg: "#1a1030", label: "SCHOOL" },
  money: { bg: "#FF5CAD", fg: "#2a0416", label: "MONEY · LEGAL" },
  lane: { bg: "#2EE6C8", fg: "#042018", label: "OPERATOR LANE" },
  ops: { bg: "#7CFFCB", fg: "#071018", label: "OPS" },
};

/**
 * Full public form set. AIXMOS landing shows every row.
 * TMMT shows only the short rental/ops set (`sites` includes "tmmt").
 */
export const PUBLIC_FORMS: readonly PublicForm[] = [
  {
    slug: "apply",
    href: "/forms/apply",
    title: "CHUMMO intake",
    kid: "Tell us who you are. An operator calls. This is the front door.",
    family: "engine",
    cost: "Free to start",
    time: "5 minutes",
    what: "Full AIXMOS client intake → people + lead",
    sites: ["aixmos"],
  },
  {
    slug: "academy-join",
    href: "/forms/academy-join",
    title: "Academy · $97",
    kid: "School door. 500 tokens a month. Learn, earn, don’t quit.",
    family: "school",
    cost: "$97 / month",
    time: "5–15 minutes after checkout",
    what: "Student seat · 500 tokens",
    sites: ["aixmos"],
  },
  {
    slug: "operator-apply",
    href: "/forms/operator-apply",
    title: "Operator seat · $297",
    kid: "One hallway. One city to run. Never the engine keys.",
    family: "lane",
    cost: "$297 / month",
    time: "1 day after hire tap",
    what: "Operator seat · 2,000 tokens",
    sites: ["aixmos"],
  },
  {
    slug: "sovereign",
    href: "/forms/sovereign",
    title: "AIXMOS on your machine",
    kid: "Their computer. Their memory. Desk nickname: Crimson Shadow.",
    family: "engine",
    cost: "$50,000 once + $97 / agent / mo",
    time: "Box talks same day after model download · white-glove week",
    what: "Sovereign install · NVIDIA box",
    sites: ["aixmos"],
  },
  {
    slug: "dealer-apply",
    href: "/forms/dealer-apply",
    title: "Dealer apply",
    kid: "Lot wants the kit. Owner or GM talks first.",
    family: "cars",
    cost: "Quote · kits from ops",
    time: "Same-week review",
    what: "Dealership application",
    sites: ["aixmos"],
  },
  {
    slug: "credit-funding-intake",
    href: "/forms/credit-funding-intake",
    title: "Credit + funding profile",
    kid: "Educational only. No score pull. Lawyer stamp before customers walk in.",
    family: "money",
    cost: "Guidance · not repair",
    time: "10–15 minutes",
    what: "Readiness profile · no SSN · no hard score",
    sites: ["aixmos"],
  },
  {
    slug: "affiliates",
    href: "/forms/affiliates",
    title: "Affiliate",
    kid: "Share the school link. Get paid if they stay.",
    family: "school",
    cost: "30% recurring",
    time: "2 minutes to apply",
    what: "Affiliate application",
    sites: ["aixmos"],
  },
  {
    slug: "lead-intake",
    href: "/forms/lead-intake",
    title: "Rent a car",
    kid: "Need a vehicle? Name, phone, what you want.",
    family: "cars",
    cost: "Quote",
    time: "2 minutes",
    what: "Rental inquiry",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "appointment",
    href: "/forms/appointment",
    title: "Appointment",
    kid: "Pickup, return, or talk. Pick a day.",
    family: "ops",
    cost: "Free",
    time: "2 minutes",
    what: "Schedule a visit",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "waitlist",
    href: "/forms/waitlist",
    title: "Waitlist",
    kid: "No car today. Get in line for the one you want.",
    family: "cars",
    cost: "Free",
    time: "2 minutes",
    what: "Vehicle waitlist",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "ticket",
    href: "/forms/ticket",
    title: "Help / ticket",
    kid: "Something broke. Tell us. We open a ticket.",
    family: "ops",
    cost: "Free",
    time: "2 minutes",
    what: "Support ticket",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "customer-intake",
    href: "/forms/customer-intake",
    title: "Customer request",
    kid: "Any job. Becomes a tracked case.",
    family: "ops",
    cost: "Free",
    time: "3 minutes",
    what: "Unified case intake",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "background-check",
    href: "/forms/background-check",
    title: "Driver check",
    kid: "Before the keys. Insurance yes or no.",
    family: "ops",
    cost: "Required to rent",
    time: "5 minutes",
    what: "Background + insurance check",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "rentals",
    href: "/forms/customer-intake",
    title: "Rentals city",
    kid: "Economy fleet. Teslas and daily drivers.",
    family: "cars",
    cost: "Weekly quote",
    time: "3 minutes",
    what: "TMMT Rentals line",
    sites: ["aixmos", "tmmt"],
  },
  {
    slug: "express",
    href: "/forms/express",
    title: "Express",
    kid: "Fast cars. In and out.",
    family: "cars",
    cost: "Daily quote",
    time: "3 minutes",
    what: "TMMT Express line",
    sites: ["aixmos"],
  },
  {
    slug: "black",
    href: "/forms/black",
    title: "Black",
    kid: "Quiet dark cars. Nighttime energy.",
    family: "cars",
    cost: "Quote",
    time: "3 minutes",
    what: "Black car service",
    sites: ["aixmos"],
  },
  {
    slug: "auto-services",
    href: "/forms/auto-services",
    title: "Auto",
    kid: "Wrenches. It makes a noise.",
    family: "cars",
    cost: "Quote",
    time: "3 minutes",
    what: "Auto services line",
    sites: ["aixmos"],
  },
  {
    slug: "auto-detailing",
    href: "/forms/auto-detailing",
    title: "Detailing",
    kid: "Make it shiny.",
    family: "cars",
    cost: "Quote",
    time: "3 minutes",
    what: "Detailing line",
    sites: ["aixmos"],
  },
  {
    slug: "moving",
    href: "/forms/moving",
    title: "Moving",
    kid: "Boxes on trucks. Don’t drop grandma’s lamp.",
    family: "home",
    cost: "Quote",
    time: "3 minutes",
    what: "Moving line",
    sites: ["aixmos"],
  },
  {
    slug: "cleaning",
    href: "/forms/cleaning",
    title: "Cleaning",
    kid: "Sparkle city.",
    family: "home",
    cost: "Quote",
    time: "3 minutes",
    what: "Cleaning line",
    sites: ["aixmos"],
  },
  {
    slug: "wholesale-cars",
    href: "/forms/wholesale-cars",
    title: "Wholesale",
    kid: "Cars in packs.",
    family: "cars",
    cost: "Quote",
    time: "3 minutes",
    what: "Wholesale cars line",
    sites: ["aixmos"],
  },
  {
    slug: "luxury",
    href: "/forms/luxury",
    title: "Luxury",
    kid: "Soft doors. Quiet engines.",
    family: "cars",
    cost: "Quote",
    time: "3 minutes",
    what: "Luxury line",
    sites: ["aixmos"],
  },
  {
    slug: "restoration",
    href: "/forms/restoration",
    title: "Restoration",
    kid: "Guidance into the ecosystem. Not a score promise.",
    family: "money",
    cost: "Guidance",
    time: "5 minutes",
    what: "Restoration / onboarding line",
    sites: ["aixmos"],
  },
  {
    slug: "nxt-global",
    href: "/forms/operator-apply?lane=nxt-global",
    title: "NXT GLOBAL",
    kid: "One operator hallway. Taha still owns every brick.",
    family: "lane",
    cost: "Operator seat",
    time: "1 day",
    what: "NXT GLOBAL lane application",
    sites: ["aixmos"],
  },
] as const;

export function formsForSite(site: FormSite): PublicForm[] {
  return PUBLIC_FORMS.filter((f) => f.sites.includes(site));
}

export function isAixmosOnlyPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  const aixmosOnly = new Set(
    PUBLIC_FORMS.filter((f) => !f.sites.includes("tmmt")).map((f) => f.href.split("?")[0]),
  );
  if (path === "/forms/credit-funding-intake") return true;
  if (path === "/credit" || path === "/funding") return true;
  return aixmosOnly.has(path);
}
