import { CheckCircle2, Circle, Loader2, MessageSquare, Zap } from "lucide-react";
import { Card } from "@/components/ui";
import { phaseSteps, type ChangeRequest, type Engagement, type PhaseStep } from "@/lib/engagement";
import { ENGAGEMENT_PHASE_LABEL, ENGAGEMENT_PHASE_BLURB } from "@/lib/workflow/statuses";

/**
 * The presentational half of the client build tracker.
 *
 * Split out from page.tsx so it can be rendered with fixed data — the page
 * itself is a server component that reaches for the signed-in user, which makes
 * it impossible to look at while the staged migration is unapplied. This holds
 * no auth and no data access: give it an Engagement and it draws it.
 */

/**
 * Format a phase date.
 *
 * Pinned to UTC on purpose. These timestamps are stored as UTC midnight, and
 * formatting them in the viewer's local zone renders the *previous* day
 * anywhere west of Greenwich — a client in the DMV would have been told their
 * build started on the 13th when the record says the 14th. A tracker whose
 * dates are off by one is a tracker nobody trusts.
 */
function when(at: string | null): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Step({ step, last }: { step: PhaseStep; last: boolean }) {
  const icon =
    step.state === "done" ? (
      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
    ) : step.state === "current" ? (
      <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    ) : (
      <Circle className="h-5 w-5 text-gray-300 dark:text-slate-600" />
    );

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        {icon}
        {!last && (
          <div
            className={`w-px flex-1 my-1 ${
              step.state === "done" ? "bg-green-500/40" : "bg-gray-200 dark:bg-slate-700"
            }`}
          />
        )}
      </div>
      <div className={`pb-5 ${step.state === "upcoming" ? "opacity-50" : ""}`}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 dark:text-white">
            {ENGAGEMENT_PHASE_LABEL[step.phase]}
          </span>
          {step.at && step.state !== "upcoming" && (
            <span className="text-xs text-gray-500 dark:text-slate-400">{when(step.at)}</span>
          )}
          {step.state === "current" && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              happening now
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
          {ENGAGEMENT_PHASE_BLURB[step.phase]}
        </p>
      </div>
    </li>
  );
}

function Dossier({ summary }: { summary: Record<string, unknown> }) {
  const rows = Object.entries(summary).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== "",
  );
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Nothing recorded here yet. Anything you told us at intake will show up on this page.
      </p>
    );
  }
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-sm">
          <dt className="w-36 shrink-0 text-gray-500 dark:text-slate-400">
            {k.replace(/_/g, " ")}
          </dt>
          <dd className="text-gray-900 dark:text-white break-words">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Thread({ items }: { items: ChangeRequest[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        No change requests yet. If you want something added or done differently, this is where
        to ask — a person on the team reads it and replies here.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <li
          key={c.id}
          className={`rounded-lg p-3 text-sm ${
            c.author_kind === "operator"
              ? "bg-blue-50 dark:bg-blue-900/20"
              : "bg-gray-50 dark:bg-slate-800"
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="font-medium">
              {c.author_kind === "operator" ? "Our team" : "You"}
            </span>
            <span>{when(c.created_at)}</span>
          </div>
          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function BuildTrackerView({
  engagement,
  requests,
}: {
  engagement: Engagement;
  requests: ChangeRequest[];
}) {
  const steps = phaseSteps(engagement);

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your build</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Where things are up to, and what&apos;s running right now.
        </p>
      </header>

      <Card className="p-4">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Progress</h2>
        <ol>
          {steps.map((s, i) => (
            <Step key={s.phase} step={s} last={i === steps.length - 1} />
          ))}
        </ol>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <Zap className="h-4 w-4 text-amber-500" />
          What&apos;s live
        </h2>
        {engagement.whats_live.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Nothing is switched on yet. As each piece goes live it gets listed here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {engagement.whats_live.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <span className="text-gray-900 dark:text-white">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">What you told us</h2>
        <Dossier summary={engagement.intake_summary} />
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          Change requests
        </h2>
        <Thread items={requests} />
      </Card>
    </div>
  );
}
