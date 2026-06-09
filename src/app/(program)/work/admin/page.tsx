"use client";

import { useCube } from "@aixmos/core";
import { ProgramWorkflowBanner } from "@/components/program/WorkflowBanner";
import { Button, Card } from "@/components/ui";

export default function WorkAdminPage() {
  const { state, updateApplication, transitionStatus } = useCube();
  const app = state.application;
  const docsOk = app.documents.filter((d) => d.required).every((d) => d.uploaded);
  const canApprove = app.status === "advisor_reviewed" && docsOk;

  return (
    <div>
      <ProgramWorkflowBanner />
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin review</h2>
        <p className="text-sm text-gray-500 mt-1">
          Verify documents and data accuracy before supervisor approval.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-900 p-3">
            <p className="text-gray-500">Client</p>
            <p className="font-medium">{app.clientName}</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-slate-900 p-3">
            <p className="text-gray-500">Readiness</p>
            <p className="font-medium">{app.overallReadiness}/100</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-slate-900 p-3">
            <p className="text-gray-500">Documents</p>
            <p className="font-medium">{docsOk ? "Complete" : "Incomplete"}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {app.documents.map((d) => (
            <li key={d.id} className="flex justify-between border-b border-gray-100 dark:border-slate-700 py-2">
              <span>{d.label}</span>
              <span>
                {d.uploaded ? "uploaded" : "missing"}
                {d.verified ? " · verified" : ""}
              </span>
            </li>
          ))}
        </ul>

        <textarea
          className="mt-4 w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm"
          rows={3}
          placeholder="Admin notes…"
          value={app.adminNotes}
          onChange={(e) => updateApplication({ adminNotes: e.target.value })}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!canApprove} onClick={() => transitionStatus("admin_reviewed", "Admin verified documents", app.adminNotes)}>
            Approve → supervisor
          </Button>
          <Button variant="secondary" onClick={() => transitionStatus("returned_for_corrections", "Admin returned for corrections", app.adminNotes)}>
            Return for corrections
          </Button>
        </div>
      </Card>
    </div>
  );
}
