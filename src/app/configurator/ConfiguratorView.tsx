"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MODULE_LAYERS,
  MODULE_LAYER_LABEL,
  MODULE_LAYER_BLURB,
  modulesInLayer,
  describeSelection,
  type ModuleEntry,
} from "@/lib/modules/catalog";

/**
 * The picker. Everything honest about this page lives in one decision: a
 * module that is not running yet is shown as not running yet, in the same
 * type size as everything else, and it stays that way after you select it.
 *
 * The competitor's version of this page does not exist — theirs 404s. Ours is
 * only worth more than theirs while every REAL on it survives being checked.
 */

const CONSULT_HREF = "/forms/lead-intake?offer=consult";

function StatusTag({ entry }: { entry: ModuleEntry }) {
  if (entry.status === "real") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        Running today
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
      Not yet
    </span>
  );
}

function ModuleCard({
  entry,
  picked,
  onToggle,
}: {
  entry: ModuleEntry;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
        picked ? "border-[#1440C4] bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <input
        type="checkbox"
        checked={picked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0 accent-[#1440C4]"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#0A1628]">{entry.name}</span>
          <StatusTag entry={entry} />
        </span>
        <span className="mt-1 block text-sm text-slate-600">{entry.summary}</span>
        <span className="mt-2 block text-xs leading-relaxed text-slate-500">{entry.evidence}</span>
      </span>
    </label>
  );
}

export default function ConfiguratorView() {
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const summary = useMemo(() => describeSelection(picked), [picked]);

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0A1628]">
      <header className="bg-[#0A1628] px-6 py-14 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
          Build your system
        </p>
        <h1 className="mx-auto mt-2 max-w-3xl text-3xl font-bold sm:text-4xl">
          Pick the parts you want. We will tell you which ones are running today.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
          Some of what we build is live and working for people right now. Some of
          it is built but not switched on yet. You should know which is which
          before you pay us, so every item below says so.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {MODULE_LAYERS.map((layer) => (
          <section key={layer} className="mb-12">
            <h2 className="text-xl font-semibold text-[#1440C4]">{MODULE_LAYER_LABEL[layer]}</h2>
            <p className="mt-1 text-sm text-slate-600">{MODULE_LAYER_BLURB[layer]}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {modulesInLayer(layer).map((m) => (
                <ModuleCard
                  key={m.id}
                  entry={m}
                  picked={picked.includes(m.id)}
                  onToggle={() => toggle(m.id)}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="sticky bottom-4 rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold">Your list</h2>

          {summary.total === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              Nothing picked yet. Tick anything above and it shows up here.
            </p>
          ) : (
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Running today — {summary.real.length}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {summary.real.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                  {summary.real.length === 0 && (
                    <li className="text-slate-500">None of your picks are live yet.</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  Not yet — {summary.coming.length}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {summary.coming.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                  {summary.coming.length === 0 && (
                    <li className="text-slate-500">Everything you picked is live.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {summary.coming.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              We will not bill you for anything in the &ldquo;not yet&rdquo; column as if it
              were finished. On the call we will tell you what it would take and
              when, or talk you out of it.
            </p>
          )}

          <div className="mt-6">
            <Link
              href={CONSULT_HREF}
              className="inline-block rounded-lg bg-[#1440C4] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Talk it through with us
            </Link>
            <p className="mt-2 text-xs text-slate-500">
              No price on this page on purpose — what you picked changes it, and
              we would rather quote you than guess at you.
            </p>
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-slate-500">
          Every &ldquo;running today&rdquo; on this page is something we can show you working.
          Ask us to.
        </p>
      </main>
    </div>
  );
}
