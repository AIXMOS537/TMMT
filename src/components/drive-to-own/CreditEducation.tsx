"use client";

/**
 * Gate 10 — the first step, and until today the one no renter could take.
 *
 * Reading material about how credit works and what lenders look at. It disputes nothing and
 * contacts nobody, which is what keeps this outside CROA. The copy must never promise a
 * score change.
 */
import { useState, useTransition } from "react";
import { acknowledgeEducationSection } from "@/app/status/opt-in-actions";
import type { EducationSection } from "@/lib/drive-to-own/education";
import { CheckCircle, Circle } from "lucide-react";

export default function CreditEducation({
  token,
  sections,
  requiredTotal,
  requiredAcknowledged,
}: {
  token: string;
  sections: EducationSection[];
  requiredTotal: number;
  requiredAcknowledged: number;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Set<string>>(
    new Set(sections.filter(s => s.acknowledged).map(s => s.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const acked = sections.filter(s => s.required && done.has(s.id)).length;

  return (
    <section className="rounded-lg border border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide opacity-70">Step 1</p>
      <h2 className="mt-1 text-lg font-semibold">Understanding credit</h2>
      <p className="mt-2 text-sm opacity-80">
        A few short reads on how lenders look at your file. {acked} of {requiredTotal} done.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <ul className="mt-3 divide-y divide-white/10">
        {sections.map(s => {
          const isDone = done.has(s.id);
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="py-3">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.id)}
                className="flex w-full items-start gap-3 text-left"
                aria-expanded={isOpen}
              >
                {isDone ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{s.title}</span>
                  {!s.required && <span className="text-xs opacity-60">optional</span>}
                </span>
              </button>

              {isOpen && (
                <div className="mt-3 pl-7">
                  <p className="whitespace-pre-wrap text-sm opacity-90">{s.body_md}</p>
                  {!isDone && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          setError(null);
                          const r = await acknowledgeEducationSection(token, s.id);
                          if (r.ok) setDone(prev => new Set(prev).add(s.id));
                          else setError(r.error);
                        })
                      }
                      className="mt-3 rounded-md border border-white/20 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {pending ? "Saving…" : "I've read this"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {requiredTotal > 0 && acked === requiredTotal && (
        <p className="mt-3 text-sm text-green-500">Step 1 complete.</p>
      )}
    </section>
  );
}
