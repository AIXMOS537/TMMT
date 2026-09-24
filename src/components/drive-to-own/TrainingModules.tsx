"use client";

/**
 * Gates 30 and 40 — the rebuild modules.
 *
 * Optional modules are shown but labelled, because only core ones decide the gate. A renter
 * should be able to see at a glance what actually stands between them and the next step.
 */
import { useState, useTransition } from "react";
import { markTrainingModule } from "@/app/status/opt-in-actions";
import type { TrainingModule } from "@/lib/drive-to-own/training";
import { CheckCircle, Circle } from "lucide-react";

export default function TrainingModules({
  token,
  modules,
  coreTotal,
}: {
  token: string;
  modules: TrainingModule[];
  coreTotal: number;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Set<string>>(
    new Set(modules.filter(m => m.percent_complete >= 100).map(m => m.id)),
  );
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const coreDone = modules.filter(m => m.is_core && done.has(m.id)).length;

  return (
    <section className="rounded-lg border border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide opacity-70">Step 2</p>
      <h2 className="mt-1 text-lg font-semibold">Rebuild training</h2>
      <p className="mt-2 text-sm opacity-80">
        {coreDone} of {coreTotal} core modules done.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <ul className="mt-3 divide-y divide-white/10">
        {modules.map(m => {
          const isDone = done.has(m.id);
          const isOpen = open === m.id;
          return (
            <li key={m.id} className="py-3">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : m.id)}
                className="flex w-full items-start gap-3 text-left"
                aria-expanded={isOpen}
              >
                {isDone ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{m.title}</span>
                  {m.summary && <span className="block text-xs opacity-70">{m.summary}</span>}
                  {!m.is_core && <span className="text-xs opacity-60">optional</span>}
                </span>
              </button>

              {isOpen && (
                <div className="mt-3 pl-7">
                  {m.content_md && (
                    <p className="whitespace-pre-wrap text-sm opacity-90">{m.content_md}</p>
                  )}
                  {!isDone && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          setError(null);
                          const r = await markTrainingModule(token, m.id, 100);
                          if (r.ok) setDone(prev => new Set(prev).add(m.id));
                          else setError(r.error);
                        })
                      }
                      className="mt-3 rounded-md border border-white/20 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {pending ? "Saving…" : "I've finished this"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {coreTotal > 0 && coreDone === coreTotal && (
        <p className="mt-3 text-sm text-green-500">Step 2 complete.</p>
      )}
    </section>
  );
}
