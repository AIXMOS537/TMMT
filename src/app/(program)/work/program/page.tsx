"use client";

import Link from "next/link";
import {
  learnPath,
  useCube,
  workPath,
  WORKFLOW_STEPS,
} from "@aixmos/core";
import { Card, PageHeader, Button, StatusBadge } from "@/components/ui";
import { STATUS_LABELS } from "@aixmos/core";

export default function ProgramWorkHubPage() {
  const { state } = useCube();
  const app = state.application;

  const staffSteps = WORKFLOW_STEPS.filter((s) =>
    ["questionnaire_complete", "coach_reviewed", "advisor_reviewed", "admin_reviewed", "supervisor_approved", "submitted"].includes(s)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AIXMOS program desk"
        description="Restoration & credit guidance — workforce queue (Work face)"
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{app.clientName}</p>
            <p className="text-sm text-gray-500">
              {app.id} · Readiness {app.overallReadiness}/100
            </p>
          </div>
          <StatusBadge status={STATUS_LABELS[app.status]} />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {staffSteps.map((step) => (
          <Card key={step} className="p-3 text-sm">
            <p className="font-medium">{STATUS_LABELS[step]}</p>
            <p className="text-gray-500 mt-1">
              {app.status === step ? "Current" : WORKFLOW_STEPS.indexOf(app.status) > WORKFLOW_STEPS.indexOf(step) ? "Done" : "Pending"}
            </p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={workPath("/work/review", app.id)}>
          <Button>Review packet</Button>
        </Link>
        <Link href={workPath("/work/admin", app.id)}>
          <Button variant="secondary">Admin review</Button>
        </Link>
        <Link href={workPath("/work/supervisor", app.id)}>
          <Button variant="secondary">Supervisor approval</Button>
        </Link>
        <a href={learnPath("/dashboard", app.id)}>
          <Button variant="secondary">Open Learn face →</Button>
        </a>
      </div>

      <Card className="p-4 text-sm text-gray-600 dark:text-slate-400">
        <p>
          <strong>Cube sync:</strong> Run <code className="text-xs">npm run dev:cube</code> — Learn on
          port 3001, Work on 3000. Changes broadcast across both tabs.
        </p>
      </Card>
    </div>
  );
}
