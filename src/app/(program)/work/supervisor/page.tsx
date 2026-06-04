"use client";

import Link from "next/link";
import { learnPath, useCube } from "@aixmos/core";
import { ProgramWorkflowBanner } from "@/components/program/WorkflowBanner";
import { Button, Card } from "@/components/ui";

export default function WorkSupervisorPage() {
  const { state, updateApplication, transitionStatus } = useCube();
  const app = state.application;
  const canApprove = app.status === "admin_reviewed";

  return (
    <div>
      <ProgramWorkflowBanner />
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Supervisor approval</h2>
        <p className="text-sm text-gray-500 mt-1">Final internal gate before client consent on the Learn face.</p>

        <div className="mt-4 space-y-2 text-sm text-gray-700 dark:text-slate-300">
          <p>
            <strong>Client:</strong> {app.clientName}
          </p>
          <p>
            <strong>Admin notes:</strong> {app.adminNotes || "—"}
          </p>
          <p>
            <strong>Advisor notes:</strong> {app.advisorNotes || "—"}
          </p>
        </div>

        <textarea
          className="mt-4 w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm"
          rows={3}
          placeholder="Supervisor sign-off notes…"
          value={app.supervisorNotes}
          onChange={(e) => updateApplication({ supervisorNotes: e.target.value })}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!canApprove}
            onClick={() =>
              transitionStatus("supervisor_approved", "Supervisor final approval", app.supervisorNotes)
            }
          >
            Final internal approval
          </Button>
          <a href={learnPath("/consent", app.id)}>
            <Button variant="secondary">Preview consent (Learn face)</Button>
          </a>
        </div>

        {app.status === "supervisor_approved" && (
          <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">
            Approved. Client can consent on the Learn face — state syncs via cube.
          </p>
        )}
      </Card>
    </div>
  );
}
