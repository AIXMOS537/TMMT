/**
 * The renter's position on the Drive-to-Own ladder, and their current standing.
 *
 * Presentational only. Every "unknown" gate is rendered as "not tracked yet" rather than
 * as a failure — the engine's rule (UNKNOWN IS NOT NO) has to survive into the pixels, or
 * a renter reads an untracked gate as something they got wrong.
 */
import type { LadderPosition } from "@/lib/drive-to-own/ladder";
import type { Standing } from "@/lib/drive-to-own/standing";
import { CheckCircle, Circle, HelpCircle, AlertTriangle } from "lucide-react";

const GATE_ICON = { met: CheckCircle, not_met: Circle, unknown: HelpCircle } as const;
const GATE_TONE = {
  met: "text-green-500",
  not_met: "text-zinc-400",
  unknown: "text-zinc-500",
} as const;

const STANDING_COPY: Record<Standing["standing"], { label: string; tone: string }> = {
  good: { label: "Good standing", tone: "text-green-500" },
  at_risk: { label: "Action needed soon", tone: "text-amber-500" },
  lapsed: { label: "Standing lapsed", tone: "text-amber-500" },
  removed_from_path: { label: "Account restricted", tone: "text-red-500" },
};

export default function JourneyLadder({
  position,
  standing,
}: {
  position: LadderPosition;
  standing: Standing | null;
}) {
  const required = position.gates.filter(g => !g.optional);
  const met = required.filter(g => g.state === "met").length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-white/10 p-4">
        <p className="text-xs uppercase tracking-wide opacity-70">Your road to owning a car</p>
        <h2 className="mt-1 text-xl font-semibold">
          {met} of {required.length} steps done
        </h2>
        {position.nextGate && (
          <p className="mt-2 text-sm opacity-80">
            Next: {required.find(g => g.slug === position.nextGate)?.title}
          </p>
        )}

        {standing && (
          <p className={`mt-3 text-sm font-medium ${STANDING_COPY[standing.standing].tone}`}>
            {STANDING_COPY[standing.standing].label}
          </p>
        )}

        {/* Said plainly, every time. Clearing these steps is not an approval. */}
        <p className="mt-3 text-xs opacity-70">
          Finishing these steps puts you in the best position to apply for financing. The
          lender makes the final decision.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-semibold">Your steps</h3>
        <ul className="mt-1 divide-y divide-white/10">
          {position.gates.map(g => {
            const Icon = GATE_ICON[g.state];
            return (
              <li key={g.slug} className="flex gap-3 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${GATE_TONE[g.state]}`} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {g.title}
                    {g.optional && <span className="ml-2 text-xs opacity-60">optional</span>}
                  </p>
                  <p className="text-sm opacity-80">{g.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {standing && standing.nextSteps.length > 0 && (
        <div className="rounded-lg border border-white/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            Keep your standing
          </h3>
          <ul className="mt-2 space-y-2">
            {standing.nextSteps.map((s, i) => (
              <li key={i} className="text-sm opacity-90">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
