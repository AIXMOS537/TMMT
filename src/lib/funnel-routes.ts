/**
 * Public funnel routes — exit-intent offers, short-link redirects, and QA inventory.
 * Every path here must stay unlocked in middleware (isPublicPath + isPitchPublicPath).
 */

export type FunnelExitOffer = {
  id: string;
  headline: string;
  subhead: string;
  bullets: string[];
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

/** $97/mo membership — the ecosystem entry point */
export const MEMBER_97_LP = "/lp/moe-legacy/intro-97";
export const LEAD_MAGNET_LP = "/lp/aixmos/lead-magnet";
export const OPERATOR_APPLY = "/forms/affiliates";
export const TRY_DEMO = "/try";

/** Match pathname → exit popup copy (longest prefix wins) */
export function exitOfferForPath(pathname: string): FunnelExitOffer | null {
  const path = pathname.split("?")[0] ?? pathname;

  for (const rule of EXIT_OFFER_RULES) {
    if (rule.test(path)) return rule.offer;
  }
  return null;
}

/** True when exit-intent chrome should mount on this path */
export function isFunnelExitPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return FUNNEL_EXIT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

const DEFAULT_EXIT: FunnelExitOffer = {
  id: "member-97",
  headline: "Before you go — invest $97/mo in yourself",
  subhead:
    "Join the AIXMOS Academy: credit guidance, funding path, and tools to earn inside the ecosystem.",
  bullets: [
    "$97/mo — less than one dinner, compounding every month",
    "Personalized credit + funding guidance (compliant, no guarantees)",
    "Path to operator earnings — 30% recurring on referrals",
  ],
  primaryCta: { label: "Start my $97 membership", href: MEMBER_97_LP },
  secondaryCta: { label: "Get the free playbook", href: LEAD_MAGNET_LP },
};

const EXIT_OFFER_RULES: { test: (path: string) => boolean; offer: FunnelExitOffer }[] = [
  {
    test: (p) => p.startsWith("/lp/") && p.includes("intro-97"),
    offer: {
      id: "intro-97-stay",
      headline: "You're one step from your audit",
      subhead: "Lock in the $97 credit + funding audit — real human eyes on your file.",
      bullets: [
        "30-minute strategy call with an AIXMOS advisor",
        "Written action plan within 24 hours",
        "Gateway into the full $97/mo ecosystem",
      ],
      primaryCta: { label: "Complete my $97 audit", href: MEMBER_97_LP },
      secondaryCta: { label: "Free playbook instead", href: LEAD_MAGNET_LP },
    },
  },
  {
    test: (p) => p.startsWith("/lp/") && p.includes("lead-magnet"),
    offer: {
      id: "lead-magnet-stay",
      headline: "The playbook is free — membership unlocks the engine",
      subhead: "Text yourself the checklist now, or jump straight into $97/mo guidance.",
      bullets: [
        "Free: Credit + Funding Playbook to your phone",
        "$97/mo: Live guidance + earn path inside AIXMOS",
        "Cancel anytime — invest in yourself first",
      ],
      primaryCta: { label: "Start $97/mo membership", href: MEMBER_97_LP },
      secondaryCta: { label: "Stay — get free playbook", href: LEAD_MAGNET_LP },
    },
  },
  {
    test: (p) => p.startsWith("/lp/") && (p.includes("training") || p.includes("rental")),
    offer: {
      id: "training-stay",
      headline: "Run your own fleet — start with the Academy",
      subhead: "$97/mo gets you the playbook, guidance lane, and operator apply path.",
      bullets: [
        "TMMT Academy + AIXMOS agent stack",
        "Credit + funding connected to your business",
        "Earn 30% recurring as you grow",
      ],
      primaryCta: { label: "Join Academy — $97/mo", href: MEMBER_97_LP },
      secondaryCta: { label: "Apply as operator", href: OPERATOR_APPLY },
    },
  },
  {
    test: (p) => p.startsWith("/forms/credit"),
    offer: {
      id: "credit-intake-stay",
      headline: "Get funding-ready faster with guidance",
      subhead: "Finish the intake or start $97/mo membership for hands-on coaching.",
      bullets: [
        "We review your situation — no guaranteed outcomes",
        "$97/mo unlocks ongoing guidance + funding path",
        "Operators earn while they learn",
      ],
      primaryCta: { label: "Start $97/mo guidance", href: MEMBER_97_LP },
      secondaryCta: { label: "Free playbook", href: LEAD_MAGNET_LP },
    },
  },
  {
    test: (p) => p.startsWith("/forms/lead-intake"),
    offer: {
      id: "rental-intake-stay",
      headline: "Need a car today? Stay — we'll call you back",
      subhead: "Or explore running your own rental business with TMMT Academy.",
      bullets: [
        "Rental inquiry — we respond fast",
        "Academy: run your own fleet on our brain",
        "$97/mo — credit + funding lane included",
      ],
      primaryCta: { label: "Explore Academy — $97/mo", href: MEMBER_97_LP },
      secondaryCta: { label: "Stay on rental form", href: "/forms/lead-intake" },
    },
  },
  {
    test: (p) => p === "/kits" || p.startsWith("/kits/"),
    offer: {
      id: "kits-stay",
      headline: "Not ready for a kit? Start with $97/mo",
      subhead: "Test the ecosystem before a bigger kit purchase.",
      bullets: [
        "TMMT Academy — $97 setup + membership",
        "Credit guidance + operator earn path",
        "Upgrade to Ops/Command kits when you're ready",
      ],
      primaryCta: { label: "Start Academy — $97", href: MEMBER_97_LP },
      secondaryCta: { label: "View kits", href: "/kits" },
    },
  },
  {
    test: (p) => p === "/build" || p.startsWith("/build/"),
    offer: {
      id: "build-stay",
      headline: "Big build not ready? Start earning at $97/mo",
      subhead: "Join the ecosystem now — climb to a full build when you're funded.",
      bullets: [
        "$97/mo Academy membership",
        "Guidance + referrals while you save for a build",
        "Book a strategy call anytime",
      ],
      primaryCta: { label: "Join Academy — $97/mo", href: MEMBER_97_LP },
      secondaryCta: { label: "Stay on build page", href: "/build" },
    },
  },
  {
    test: (p) => p === "/try" || p.startsWith("/try/"),
    offer: {
      id: "try-stay",
      headline: "Liked the demo? Make it real for $97/mo",
      subhead: "The sandbox is free — membership unlocks your live coach + earn path.",
      bullets: [
        "Real guidance, not canned responses",
        "Credit + funding lane connected",
        "30% recurring when you refer members",
      ],
      primaryCta: { label: "Unlock live engine — $97/mo", href: MEMBER_97_LP },
      secondaryCta: { label: "Keep trying demo", href: TRY_DEMO },
    },
  },
  {
    test: (p) => p.startsWith("/forms/affiliates"),
    offer: {
      id: "affiliate-stay",
      headline: "Earn 30% recurring — but know the product first",
      subhead: "Join as a $97/mo member, then apply to earn on every referral.",
      bullets: [
        "$29+/mo per active member you refer",
        "We coach — you share the link",
        "Start as a member, graduate to affiliate",
      ],
      primaryCta: { label: "Become a member — $97/mo", href: MEMBER_97_LP },
      secondaryCta: { label: "Continue affiliate apply", href: OPERATOR_APPLY },
    },
  },
  {
    test: (p) => isFunnelExitPath(p),
    offer: DEFAULT_EXIT,
  },
];

const FUNNEL_EXIT_PREFIXES = [
  "/lp",
  "/try",
  "/kits",
  "/build",
  "/forms",
  "/explainer",
  "/credit",
  "/funding",
];

/** Live public surfaces for visual QA — used by scripts/visual-funnel-qa.mjs */
export const FUNNEL_QA_ROUTES: { path: string; label: string; vertical: string }[] = [
  { path: "/lp/aixmos/lead-magnet", label: "Lead magnet LP", vertical: "AIXMOS" },
  { path: "/lp/moe-legacy/intro-97", label: "$97 audit LP", vertical: "AIXMOS Credit" },
  { path: "/lp/aixmos/training", label: "Academy cohort LP", vertical: "TMMT Academy" },
  { path: "/lp/tmmt_property/rental-in-a-box", label: "Rental-in-a-box LP", vertical: "TMMT Rentals" },
  { path: "/try", label: "Genie demo", vertical: "AIXMOS" },
  { path: "/kits", label: "Kits pricing", vertical: "TMMT × AIXMOS" },
  { path: "/build", label: "Done-for-you builds", vertical: "High-ticket" },
  { path: "/forms/lead-intake", label: "Rental intake", vertical: "TMMT Rentals" },
  { path: "/forms/customer-intake", label: "Customer intake", vertical: "TMMT Ops" },
  { path: "/forms/credit-funding-intake", label: "Credit/funding intake", vertical: "AIXMOS Credit" },
  { path: "/forms/affiliates", label: "Affiliate / operator", vertical: "Earn" },
  { path: "/forms/appointment", label: "Appointment form", vertical: "Ops" },
  { path: "/login", label: "Login", vertical: "Auth" },
];

/** Short-link redirects — mirrored in next.config.ts */
export const FUNNEL_SHORT_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/join", destination: "/lp/moe-legacy/intro-97?utm_source=shortlink&utm_medium=direct&utm_campaign=join" },
  { source: "/97", destination: "/lp/moe-legacy/intro-97?utm_source=shortlink&utm_medium=direct&utm_campaign=97" },
  { source: "/member", destination: "/lp/moe-legacy/intro-97?utm_source=shortlink&utm_medium=direct&utm_campaign=member" },
  { source: "/academy", destination: "/lp/aixmos/training?utm_source=shortlink&utm_medium=direct&utm_campaign=academy" },
  { source: "/playbook", destination: "/lp/aixmos/lead-magnet?utm_source=shortlink&utm_medium=direct&utm_campaign=playbook" },
  { source: "/apply", destination: "/forms/affiliates?utm_source=shortlink&utm_medium=direct&utm_campaign=apply" },
  { source: "/operators", destination: "/forms/affiliates?utm_source=shortlink&utm_medium=direct&utm_campaign=operators" },
  { source: "/rental", destination: "/forms/lead-intake?utm_source=shortlink&utm_medium=direct&utm_campaign=rental" },
  { source: "/demo", destination: "/try?utm_source=shortlink&utm_medium=direct&utm_campaign=demo" },
  { source: "/earn", destination: "/forms/affiliates?utm_source=shortlink&utm_medium=direct&utm_campaign=earn" },
];
