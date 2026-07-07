"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { TrapRaceData, RacePhase } from "@/lib/race/types";

const PHASE_X: Record<RacePhase, number> = {
  learn: 12,
  earn: 38,
  churn: 64,
  graduate: 88,
};

function formatUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function RacerDot({
  name,
  phase,
  progress,
  tone,
  delay,
}: {
  name: string;
  phase: RacePhase;
  progress: number;
  tone: string;
  delay: number;
}) {
  const x = PHASE_X[phase] + (progress / 100) * 8;
  const toneRing =
    tone === "good"
      ? "shadow-[0_0_20px_rgba(52,211,153,0.8)] ring-emerald-400"
      : tone === "warn"
        ? "shadow-[0_0_20px_rgba(251,191,36,0.8)] ring-amber-400"
        : "shadow-[0_0_16px_rgba(56,189,248,0.6)] ring-sky-400";

  return (
    <div
      className="absolute bottom-[28%] z-20 transition-all duration-1000 ease-out"
      style={{ left: `${x}%`, animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          "h-4 w-4 rounded-full bg-white ring-2 animate-bounce",
          toneRing
        )}
        title={name}
      />
      <div className="mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white/90 drop-shadow">
        {name.split(" ")[0]}
      </div>
    </div>
  );
}

export function TrapRaceBoard({
  data,
  compact = false,
}: {
  data: TrapRaceData;
  compact?: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const goalPct = useMemo(
    () => Math.min(100, (data.goal.currentUsd / data.goal.targetUsd) * 100),
    [data.goal]
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-500/30",
        "bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900",
        compact ? "p-4" : "p-6"
      )}
    >
      {/* 5D depth layers */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(139,92,246,0.35), transparent),
            linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.08) 50%, transparent 100%)
          `,
          transform: `translateZ(0) scale(${1 + (tick % 2) * 0.002})`,
        }}
      />

      <div className="relative z-10 mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
            TRAP Race · 3D Command
          </p>
          <h2 className="text-xl font-black text-white sm:text-2xl">
            {data.goal.label}
          </h2>
          <p className="text-sm text-slate-400">
            {formatUsd(data.goal.currentUsd)} / {formatUsd(data.goal.targetUsd)} ·{" "}
            {data.goal.fleetCurrent}/{data.goal.fleetTarget} fleet ·{" "}
            {data.goal.operatorActive}/{data.goal.operatorCap} operators
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tabular-nums text-emerald-400">
            {goalPct.toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            to finish line
          </div>
        </div>
      </div>

      {/* 3D track */}
      <div
        className="relative mx-auto h-44 w-full max-w-4xl"
        style={{ perspective: "900px" }}
      >
        <div
          className="absolute inset-x-0 bottom-8 h-24 origin-bottom"
          style={{
            transform: "rotateX(52deg)",
            transformStyle: "preserve-3d",
          }}
        >
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-900/80 via-fuchsia-800/60 to-amber-700/50 border border-white/10" />
          {/* lane stripes */}
          {data.phases.map((p, i) => (
            <div
              key={p.id}
              className="absolute top-0 bottom-0 border-l border-dashed border-white/20"
              style={{ left: `${12 + i * 26}%` }}
            >
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-lg">
                {p.emoji}
              </span>
              <span className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider text-white/70">
                {p.label}
              </span>
            </div>
          ))}
          {/* finish arch */}
          <div className="absolute -right-2 top-0 bottom-0 w-8 rounded-r-full bg-gradient-to-r from-amber-400/80 to-yellow-300 shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
        </div>

        {data.racers.map((r, i) => (
          <RacerDot
            key={r.id}
            name={r.name}
            phase={r.phase}
            progress={r.progress}
            tone={r.tone}
            delay={i * 200}
          />
        ))}
      </div>

      {/* progress bar */}
      <div className="relative z-10 mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-all duration-700"
          style={{ width: `${goalPct}%` }}
        />
      </div>

      <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.milestones.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              m.done
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                : "border-slate-700 bg-slate-900/60 text-slate-400"
            )}
          >
            <div className="font-semibold">{m.done ? "✓" : "○"} {m.label}</div>
            <div className="text-[10px] opacity-80">{m.reward}</div>
          </div>
        ))}
      </div>

      {data.blockers.length > 0 && (
        <div className="relative z-10 mt-4 rounded-lg border border-red-500/40 bg-red-950/30 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-red-300">
            Obstacles on track — owner crumbs only
          </p>
          <ul className="mt-2 space-y-1">
            {data.blockers.map((b) => (
              <li key={b.id} className="text-sm text-red-100">
                [{b.tier}] {b.label} — run <code className="text-amber-300">x --money</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
