import Link from "next/link";
import { createSSRClient } from "@/lib/supabase-server";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { TrapRaceBoard } from "@/components/race/trap-race-board";
import { buildOperatorRaceData } from "@/lib/race/build-race-data";
import {
  GraduationCap,
  Trophy,
  CheckCircle2,
  Circle,
  ArrowRight,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ModuleRow {
  id: string;
  track: string | null;
  slug: string | null;
  title: string | null;
  objective: string | null;
  est_minutes: number | null;
  sort_order: number | null;
}
interface ProgressRow {
  module_id: string;
  percent_complete: number | null;
}
interface Op360 {
  operator_name: string | null;
  program_pct_complete: number | null;
  modules_completed: number | null;
  modules_total: number | null;
  unlock_status: string | null;
  is_certified: boolean | null;
}

export default async function OperatorTrainingPage() {
  const supabase = await createSSRClient();

  const [{ data: modules }, { data: progress }, { data: me }] =
    await Promise.all([
      supabase
        .from("operator_training_modules")
        .select("id,track,slug,title,objective,est_minutes,sort_order")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("operator_training_progress")
        .select("module_id,percent_complete"),
      supabase
        .from("v_operator_360")
        .select(
          "operator_name,program_pct_complete,modules_completed,modules_total,unlock_status,is_certified"
        )
        .maybeSingle(),
    ]);

  const mods = (modules ?? []) as ModuleRow[];
  const prog = (progress ?? []) as ProgressRow[];
  const o = (me ?? null) as Op360 | null;

  const done = new Set(
    prog.filter((p) => (p.percent_complete ?? 0) >= 100).map((p) => p.module_id)
  );
  const total = o?.modules_total ?? mods.length;
  const completed = o?.modules_completed ?? done.size;
  const pct =
    o?.program_pct_complete != null
      ? Number(o.program_pct_complete)
      : total > 0
        ? Math.round((100 * completed) / total)
        : 0;
  const status =
    o?.unlock_status ??
    (total > 0 && completed >= total ? "READY TO CERTIFY (100%)" : "IN PROGRAM");
  const certified = o?.is_certified === true;
  const nextModule = mods.find((m) => !done.has(m.id));
  const race = buildOperatorRaceData({
    name: o?.operator_name ?? "Operator",
    pctComplete: pct,
    certified,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operator Academy"
        description="Complete every module to get certified and unlock your full operator toolkit."
      />

      <TrapRaceBoard data={race} compact />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Program progress"
          value={`${pct}%`}
          icon={<GraduationCap size={18} />}
          trend={`${completed} of ${total} modules complete`}
        />
        <StatCard
          label="Status"
          value={certified ? "Certified" : status}
          icon={<Trophy size={18} />}
          trend={
            certified
              ? "Full toolkit unlocked"
              : status.includes("READY")
                ? process.env.NEXT_PUBLIC_V3_AUTO_CERTIFY === "true"
                  ? "Certifying automatically…"
                  : "Ask your lead to certify you"
                : "Keep going"
          }
        />
        <StatCard
          label="Next step"
          value={nextModule ? "1 module" : certified ? "Done" : "All done"}
          icon={<ArrowRight size={18} />}
          trend={nextModule?.title ?? "No modules remaining"}
        />
      </div>

      {/* Progress bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium text-gray-700 dark:text-slate-200">
            {certified
              ? "🎉 Certified operator"
              : `You're ${pct}% of the way there`}
          </span>
          <span className="text-gray-500 dark:text-slate-400">
            {completed}/{total}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {nextModule && (
          <Link
            href={`/operator/training/${nextModule.id}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Continue: {nextModule.title} <ArrowRight size={14} />
          </Link>
        )}
      </Card>

      {/* Module list */}
      {mods.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">
          No training modules are published yet.
        </Card>
      ) : (
        <ul className="space-y-3">
          {mods.map((m, i) => {
            const isDone = done.has(m.id);
            return (
              <li key={m.id}>
                <Link href={`/operator/training/${m.id}`}>
                  <Card className="p-4 flex items-center gap-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                    {isDone ? (
                      <CheckCircle2
                        className="text-emerald-500 flex-shrink-0"
                        size={22}
                      />
                    ) : (
                      <Circle
                        className="text-gray-300 dark:text-slate-600 flex-shrink-0"
                        size={22}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {m.title ?? m.slug ?? "Module"}
                        </span>
                        {m.track && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300">
                            {m.track}
                          </span>
                        )}
                      </div>
                      {m.objective && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
                          {m.objective}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                      {m.est_minutes ? (
                        <span className="hidden sm:flex items-center gap-1">
                          <Clock size={12} />
                          {m.est_minutes}m
                        </span>
                      ) : null}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {isDone ? "Review" : "Start"}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
