import { Card, CardContent, CardHeader, CardTitle } from "@/components/aixmos-ui/card";
import { cn } from "@/lib/utils";
import type { MissionBoardData, Tone } from "@/lib/mission/types";

const STAT_TONE: Record<Tone, string> = {
  neutral: "border-border/80",
  good: "border-emerald-500/40",
  warn: "border-amber-500/50",
  alert: "border-red-500/50",
  info: "border-sky-500/40",
};

const DOT_TONE: Record<Tone, string> = {
  neutral: "bg-slate-400",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-red-500",
  info: "bg-sky-500",
};

export function MissionBoard({ data }: { data: MissionBoardData }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          📡 What&apos;s happening now
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.stats.map((s) => (
            <Card key={s.label} className={cn("border-l-[3px]", STAT_TONE[s.tone])}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold leading-none">{s.value ?? "—"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🎯 What you&apos;re needed for</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.neededFor.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-lg leading-tight">{item.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {item.title}
                    {item.agent && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {item.agent.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-emerald-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🚀 Grow &amp; scale — your next moves</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.growMoves.map((m, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-lg leading-tight">{m.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          🤖 AIXMOS agents — on watch
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.agents.map((a) => (
            <Card key={a.key}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", DOT_TONE[a.tone])} />
                  <span className="text-sm font-semibold">{a.label}</span>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {a.role}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.status}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {data.ventures && data.ventures.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            🏢 AIX Command Center — ventures
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.ventures.map((v) => (
              <Card key={v.name}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{v.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {v.status}
                    </span>
                  </div>
                  {v.note && <div className="mt-1 text-xs text-muted-foreground">{v.note}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
