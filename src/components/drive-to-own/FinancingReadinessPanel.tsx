/**
 * The funding-readiness screen a renter sees: where they stand on the road to financing a
 * car of their own, and what moves the needle next.
 *
 * PRESENTATIONAL ONLY — it renders a FinancingReadiness that a caller already computed. No
 * fetching, no auth, no token handling. That keeps it mountable behind whichever identity
 * model wins (expiring link today, real renter accounts later) without a rewrite.
 *
 * THE RULE IT ENFORCES VISUALLY: readiness is not approval. The top stage says "strong
 * position to apply", never "approved", and the lender's role is stated on the face of the
 * card rather than buried. Copy here is customer-facing and is covered by the banned-phrase
 * gate in the engine's tests.
 */
import type { FinancingReadiness, ReadinessFactor } from "@/lib/drive-to-own/financing-readiness";
import { CheckCircle, AlertTriangle, Circle, HelpCircle } from "lucide-react";

const STAGE_COPY: Record<FinancingReadiness["stage"], { title: string; blurb: string }> = {
  no_report: {
    title: "Let's see where you stand",
    blurb:
      "Pull your own credit report through MyFreeScoreNow and we'll walk through it with you. Nothing here affects your rental.",
  },
  building: {
    title: "You're building",
    blurb: "Here's what's in the way, and what moves first. Every on-time payment counts.",
  },
  close: {
    title: "You're close",
    blurb: "Most of the picture looks good. A couple of things left to tidy up.",
  },
  ready_to_apply: {
    title: "You're in a strong position to apply",
    blurb:
      "This is as prepared as we can help you get. The lender makes the final decision — we can't make it for them.",
  },
};

const STATE_ICON = {
  strength: CheckCircle,
  blocker: AlertTriangle,
  watch: Circle,
  unknown: HelpCircle,
} as const;

const STATE_TONE = {
  strength: "text-green-500",
  blocker: "text-red-500",
  watch: "text-amber-500",
  unknown: "text-zinc-400",
} as const;

function FactorRow({ factor }: { factor: ReadinessFactor }) {
  const Icon = STATE_ICON[factor.state];
  return (
    <li className="flex gap-3 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${STATE_TONE[factor.state]}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">{factor.label}</p>
        <p className="text-sm opacity-80">{factor.detail}</p>
      </div>
    </li>
  );
}

export default function FinancingReadinessPanel({
  readiness,
}: {
  readiness: FinancingReadiness;
}) {
  const stage = STAGE_COPY[readiness.stage];
  // Progress is over factors that are actually settled. Unknowns are excluded rather than
  // counted as failures - the renter has not failed a check nobody has run.
  const settled = readiness.factors.filter(f => f.state !== "unknown");
  const good = settled.filter(f => f.state === "strength").length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-white/10 p-4">
        <p className="text-xs uppercase tracking-wide opacity-70">Your road to owning a car</p>
        <h2 className="mt-1 text-xl font-semibold">{stage.title}</h2>
        <p className="mt-2 text-sm opacity-80">{stage.blurb}</p>

        {readiness.minScore !== null && (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-3xl font-semibold tabular-nums">{readiness.minScore}</span>
            <span className="text-sm opacity-80">
              {readiness.bandLabel} · lowest of {readiness.bureausReporting} bureau
              {readiness.bureausReporting === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {settled.length > 0 && (
          <p className="mt-3 text-xs opacity-70">
            {good} of {settled.length} checks looking good
          </p>
        )}
      </div>

      <div className="rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-semibold">What lenders look at</h3>
        <ul className="mt-1 divide-y divide-white/10">
          {readiness.factors.map(f => (
            <FactorRow key={f.key} factor={f} />
          ))}
        </ul>
      </div>

      {readiness.nextSteps.length > 0 && (
        <div className="rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-semibold">What to do next</h3>
          <ol className="mt-2 space-y-2">
            {readiness.nextSteps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="opacity-60 tabular-nums">{i + 1}.</span>
                <span className="opacity-90">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Stated on the face of the card, never in the small print. */}
      <p className="px-1 text-xs opacity-70">
        This is guidance based on your own credit report, not a lending decision. Approval is
        always up to the lender. We don&apos;t charge for this and it doesn&apos;t change your
        rental.
      </p>
    </section>
  );
}
