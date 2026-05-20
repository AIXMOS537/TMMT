"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateTrainingProgressAction } from "@/lib/client-journey/actions";

export function TrainingModuleCard({
  moduleId,
  title,
  summary,
  percent,
  completed,
}: {
  moduleId: string;
  title: string;
  summary: string | null;
  percent: number;
  completed: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <article className="surface-card space-y-3 p-5">
      <div>
        <h3 className="font-medium">{title}</h3>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{percent}% complete</p>
      </div>
      {!completed && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => start(() => updateTrainingProgressAction(moduleId, 100))}
        >
          {pending ? "Saving…" : "Mark complete"}
        </Button>
      )}
      {completed && <p className="text-sm font-medium text-emerald-600">Completed</p>}
    </article>
  );
}
