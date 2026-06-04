"use client";

import { STATUS_LABELS, WORKFLOW_STEPS, useCube } from "@aixmos/core";
import { Card } from "@/components/ui";

export function ProgramWorkflowBanner() {
  const { state } = useCube();
  const status = state.application.status;
  const idx = WORKFLOW_STEPS.indexOf(status as (typeof WORKFLOW_STEPS)[number]);

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Cube workflow</p>
        <span className="text-xs font-medium text-teal-800 bg-teal-100 dark:bg-teal-900/40 dark:text-teal-200 px-2 py-0.5 rounded-full">
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>
      <div className="flex gap-1">
        {WORKFLOW_STEPS.map((step, i) => (
          <div
            key={step}
            className={`h-2 flex-1 min-w-[24px] rounded-full ${idx >= i ? "bg-teal-600" : "bg-gray-200 dark:bg-slate-600"}`}
            title={STATUS_LABELS[step]}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500 font-mono">{state.application.id}</p>
    </Card>
  );
}
