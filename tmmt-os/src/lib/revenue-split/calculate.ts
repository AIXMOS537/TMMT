import type { ResolvedPartnerSplit, SplitAmounts } from "./types";

export function splitGrossCents(grossCents: number, split: ResolvedPartnerSplit): SplitAmounts {
  const gross = Math.max(0, Math.round(grossCents));
  const partnerCents = Math.round((gross * split.partnerPct) / 100);
  const agencyCents = gross - partnerCents;
  return {
    grossCents: gross,
    partnerCents,
    agencyCents,
    partnerPct: split.partnerPct,
    agencyPct: split.agencyPct,
  };
}
