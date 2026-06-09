"use client";

import { STATUS_LABELS, WORKFLOW_STEPS, useCube } from "@aixmos/core";

export function WorkflowBanner() {
  const { state } = useCube();
  const status = state.application.status;
  const idx = WORKFLOW_STEPS.indexOf(status as (typeof WORKFLOW_STEPS)[number]);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Application workflow</p>
        <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {WORKFLOW_STEPS.map((step, i) => (
          <div
            key={step}
            className={`h-2 min-w-[40px] flex-1 rounded-full ${
              idx >= i ? "bg-teal-600" : "bg-slate-200"
            }`}
            title={STATUS_LABELS[step]}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Application ID: <code className="font-mono">{state.application.id}</code>
      </p>
    </div>
  );
}
