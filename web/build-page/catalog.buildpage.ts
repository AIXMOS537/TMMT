/**
 * catalog.buildpage.ts
 * -----------------------------------------------------------------------------
 * Canonical catalog for the AIXMOS build page, registered into the parts registry.
 *
 * SINGLE SOURCE OF TRUTH = aixmos.config.json (imported below). Do not duplicate
 * the module list anywhere else — the HTML build page reads the same JSON, and
 * the parts registry is fed from here.
 *
 * Doctrine (aixmos-parts.ts): capabilities are REGISTERED as parts, never coded
 * into core. Legal gates wire to shared/compliance-gates/gates.config.json
 * (flags: credit_repair, funding). Owner-approval enforcement stays in
 * shared/owner-approval-gate + the .claude/hooks PreToolUse hook — never bypass.
 *
 * NOTE: requires "resolveJsonModule": true in tsconfig.
 */

import config from './aixmos.config.json';

export type ApproverRole = 'owner' | 'umar';

export interface BuildPageModule {
  key: string;
  name: string;
  blurb: string;
  categories: string[];
  gated: boolean;
  /** Compliance/feature flags this bay maps to (e.g. credit_repair, funding). */
  flags?: string[];
  approvers?: ApproverRole[];
  /** Where this maps in the real platform (workstream / named subsystem). */
  mapsTo?: string;
}

/** The two real legally-gated flags from shared/compliance-gates/gates.config.json. */
export const LEGAL_FLAGS = ['credit_repair', 'funding'] as const;
export type LegalFlag = typeof LEGAL_FLAGS[number];

export const BUILD_PAGE_MODULES: BuildPageModule[] = (config.modules as any[]).map((m) => ({
  key: m.key,
  name: m.name,
  blurb: m.blurb,
  categories: m.categories ?? [],
  gated: !!m.gated,
  flags: m.flags,
  approvers: m.approvers,
  mapsTo: m.maps_to,
}));

export const BUILD_PAGE_TIERS = config.tiers;
export const BUILD_PAGE_PRICING = config.pricing;

/** True only for the actual legally-gated credit/funding bay. Dispatch is an
 *  operational/licensing gate, NOT one of the legal flags. */
export function isLegallyGated(m: BuildPageModule): boolean {
  return !!m.flags?.some((f) => (LEGAL_FLAGS as readonly string[]).includes(f));
}

/**
 * Adapter — register each module as a part in the real registry.
 * Replace `RegisterFn` with the real signature from aixmos-parts.ts and map the
 * fields onto the real Part shape. Gated bays get a gate; the part is NEVER
 * auto-enabled — unlock requires owner/umar after the legal/licensing steps.
 */
type RegisterFn = (part: {
  key: string;
  name: string;
  legalGate?: { flags: string[]; approvers: ApproverRole[] };
  operationalGate?: { reason: string; approvers: ApproverRole[] };
  meta?: Record<string, unknown>;
}) => void;

export function registerBuildPageParts(register: RegisterFn): void {
  for (const m of BUILD_PAGE_MODULES) {
    const approvers = (m.approvers ?? ['owner']) as ApproverRole[];
    register({
      key: m.key,
      name: m.name,
      legalGate: m.gated && isLegallyGated(m) ? { flags: m.flags!, approvers } : undefined,
      operationalGate:
        m.gated && !isLegallyGated(m)
          ? { reason: m.mapsTo ?? 'licensing/insurance gate', approvers }
          : undefined,
      meta: { categories: m.categories, mapsTo: m.mapsTo, blurb: m.blurb },
    });
  }
}
