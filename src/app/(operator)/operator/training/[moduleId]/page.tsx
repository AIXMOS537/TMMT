import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createSSRClient } from "@/lib/supabase-server";
import { Card, PageHeader } from "@/components/ui";
import { ArrowLeft, Target, Dumbbell, ClipboardCheck } from "lucide-react";
import { CompleteButton } from "./complete-button";

export const dynamic = "force-dynamic";

interface ModuleRow {
  id: string;
  track: string | null;
  title: string | null;
  objective: string | null;
  drill: string | null;
  pass_criteria: string | null;
  content_md: string | null;
  est_minutes: number | null;
}

// ── Minimal, dependency-free markdown renderer (headings, bold, lists, paras) ──
function inline(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, k) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={k}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={k}>{p}</span>
    )
  );
}
function Markdown({ src }: { src: string }) {
  const lines = (src || "").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={key} className="list-disc pl-6 space-y-1 mb-3">
          {items.map((t, j) => (
            <li key={j} className="text-sm leading-relaxed">
              {inline(t)}
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (!t) return flush(`ul-${i}`);
    if (t.startsWith("### ")) {
      flush(`ul-${i}`);
      blocks.push(
        <h3 key={i} className="text-base font-semibold mt-4 mb-1">
          {inline(t.slice(4))}
        </h3>
      );
    } else if (t.startsWith("## ")) {
      flush(`ul-${i}`);
      blocks.push(
        <h2 key={i} className="text-lg font-bold mt-5 mb-2">
          {inline(t.slice(3))}
        </h2>
      );
    } else if (t.startsWith("# ")) {
      flush(`ul-${i}`);
      blocks.push(
        <h2 key={i} className="text-xl font-bold mt-5 mb-2">
          {inline(t.slice(2))}
        </h2>
      );
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      list.push(t.slice(2));
    } else {
      flush(`ul-${i}`);
      blocks.push(
        <p key={i} className="text-sm leading-relaxed mb-3">
          {inline(t)}
        </p>
      );
    }
  });
  flush("ul-end");
  return <div className="text-gray-800 dark:text-slate-200">{blocks}</div>;
}

export default async function OperatorModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const supabase = await createSSRClient();

  const { data: mod } = await supabase
    .from("operator_training_modules")
    .select("id,track,title,objective,drill,pass_criteria,content_md,est_minutes")
    .eq("id", moduleId)
    .eq("active", true)
    .maybeSingle();

  if (!mod) notFound();
  const m = mod as ModuleRow;

  const { data: prog } = await supabase
    .from("operator_training_progress")
    .select("percent_complete,completed_at")
    .eq("module_id", moduleId)
    .maybeSingle();
  const done = ((prog?.percent_complete as number | null) ?? 0) >= 100;

  return (
    <div className="space-y-6">
      <Link
        href="/operator/training"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} /> Back to Academy
      </Link>

      <PageHeader
        title={m.title ?? "Module"}
        description={m.objective ?? undefined}
      />

      {m.objective && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-gray-700 dark:text-slate-200">
            <Target size={16} className="text-blue-500" /> Objective
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300">
            {m.objective}
          </p>
        </Card>
      )}

      {m.content_md && (
        <Card className="p-6">
          <Markdown src={m.content_md} />
        </Card>
      )}

      {m.drill && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
            <Dumbbell size={16} className="text-amber-500" /> Drill — do this
          </div>
          <Markdown src={m.drill} />
        </Card>
      )}

      {m.pass_criteria && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
            <ClipboardCheck size={16} className="text-emerald-500" /> Pass
            criteria
          </div>
          <Markdown src={m.pass_criteria} />
        </Card>
      )}

      <div className="pt-2">
        <CompleteButton moduleId={m.id} done={done} />
      </div>
    </div>
  );
}
