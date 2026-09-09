"use client";

import { formatCurrencyWhole, useCube } from "@aixmos/core";
import { ProgramWorkflowBanner } from "@/components/program/WorkflowBanner";
import { Button, Card } from "@/components/ui";

export default function WorkReviewPage() {
  const { state, updateApplication, transitionStatus } = useCube();
  const app = state.application;

  function advisorApprove() {
    updateApplication({
      advisorNotes:
        app.advisorNotes || "Packet reviewed for accuracy. Client data matches questionnaire.",
    });
    transitionStatus("advisor_reviewed", "Advisor approved application packet");
  }

  return (
    <div>
      <ProgramWorkflowBanner />
      <Card className="p-4 mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Staff packet review — confirm client data matches documents. No misrepresentation.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {app.personal && (
          <Card className="p-4">
            <h3 className="font-semibold">Personal</h3>
            <ul className="mt-2 text-sm space-y-1 text-gray-600 dark:text-slate-400">
              <li>{app.personal.legalName}</li>
              <li>Income: {formatCurrencyWhole(app.personal.income)}</li>
              <li>Requested: {formatCurrencyWhole(app.personal.desiredFundingAmount)}</li>
            </ul>
          </Card>
        )}
        {app.business && (
          <Card className="p-4">
            <h3 className="font-semibold">Business</h3>
            <ul className="mt-2 text-sm space-y-1 text-gray-600 dark:text-slate-400">
              <li>{app.business.businessName}</li>
              <li>Revenue: {formatCurrencyWhole(app.business.monthlyRevenue)}/mo</li>
            </ul>
          </Card>
        )}
      </div>

      <Card className="p-4 mt-4">
        <h3 className="font-semibold">Advisor notes</h3>
        <textarea
          className="mt-2 w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm"
          rows={3}
          value={app.advisorNotes}
          onChange={(e) => updateApplication({ advisorNotes: e.target.value })}
        />
        <Button className="mt-3" onClick={advisorApprove}>
          Advisor sign-off
        </Button>
      </Card>
    </div>
  );
}
