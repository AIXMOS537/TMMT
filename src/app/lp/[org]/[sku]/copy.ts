/**
 * Landing page copy for every (org, sku) pair.
 *
 * Authored by hand and reviewed by a human, NOT passed through lib/compliance's
 * enforceCompliance() — that guard is built for AI chat output and rewrites
 * "credit repair" to "credit guidance", which would silently invert a disclosure
 * like "not credit repair". copy-compliance.test.ts guards this file instead:
 * no unsubstantiated score or volume claims may appear in customer-facing copy.
 */

export interface SkuCopy {
  headline: string
  subhead: string
  bullets: string[]
  cta: string
  proof?: string
}

export const COPY: Record<string, SkuCopy> = {
  'lead-magnet': {
    headline: 'Get the free Credit + Funding Playbook',
    subhead: 'The same checklist we walk our paid clients through. Text it to your phone in 30 seconds.',
    bullets: [
      'What lenders actually look at (and what they ignore)',
      'How to fix the 3 most common credit-report mistakes',
      'Where to find funding most people never hear about',
    ],
    cta: 'Text me the playbook',
    proof: 'Free. No card required.',
  },
  'intro-97': {
    headline: 'Credit + Funding Audit — $97',
    subhead: 'Real human eyes on your report + a 30-minute call with an AIXMOS Credit advisor.',
    bullets: [
      'Personalized review of your full credit file',
      '30-minute strategy call (recorded for you)',
      'Written action plan emailed within 24 hours',
    ],
    cta: 'Start my $97 audit',
    proof: 'Education and funding-readiness review only — not credit repair. No score change is promised or guaranteed.',
  },
  'training': {
    headline: 'TMMT Academy — Operator Cohort',
    subhead: 'Run your own fleet on our brain. Become a TMMT-certified operator.',
    bullets: [
      'Live 6-week cohort with weekly office hours',
      'The AIXMOS agent playbook a real rental company runs on — scripts, templates, OPERATIONS_BRAIN',
      'Lifetime alumni Slack + ongoing playbook updates',
    ],
    cta: 'Apply for the next cohort',
  },
  'rental-in-a-box': {
    headline: 'Rental-in-a-Box',
    subhead: 'Pre-built car-rental business operating system, ready in 7 days.',
    bullets: [
      'Full fleet management SOPs + automation',
      'Renter intake, screening, and turnover workflow',
      'Credit + funding lane connected via AIXMOS Credit',
    ],
    cta: 'See if I qualify',
  },
  'flagship': {
    headline: 'Full Empire Build',
    subhead: 'White-glove buildout of your entire AI-run business — agents, funnels, and operators.',
    bullets: [
      'Dedicated buildout team for 60 days',
      'Custom branding, white-label license',
      'Lifetime access to the AIXMOS agent stack',
    ],
    cta: 'Schedule a discovery call',
  },
}

export const ORG_BRAND: Record<string, { name: string; tagline: string }> = {
  aixmos:        { name: 'AIXMOS',          tagline: 'The AI engine — agents that answer, follow up, and close 24/7' },
  moe_legacy:    { name: 'AIXMOS Credit',   tagline: 'The go-to for getting funding-ready and funded' },
  tmmt_property: { name: 'TMMT',            tagline: 'The car rental agency that teaches you to run your own fleet' },
}
