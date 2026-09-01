"use client";

import { useCube } from "@aixmos/core";
import { formatCurrency, formatDate } from "@aixmos/core";



import { WorkflowBanner } from "@/components/learn/workflow-banner";
import { Button, Card, CardDescription, CardTitle, Textarea } from "@/components/ui";

export default function ApplicationReviewPage() {
  const { state, updateApplication, transitionStatus } = useCube();
  const app = state.application;
  const role = state.currentUser.role;

  function advisorApprove() {
    updateApplication({
      advisorNotes: app.advisorNotes || "Packet reviewed for accuracy. Client data matches questionnaire.",
    });
    transitionStatus("advisor_reviewed", "Advisor approved application packet");
  }

  return (
    <div>
      <WorkflowBanner />
      <Card className="p-5 mb-4 border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-900">
          <strong>Required:</strong> You must review all data below before the application packet is finalized.
          Confirm every number matches your real documents.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {app.personal && (
          <Card className="p-5 p-5">
            <CardTitle>Personal data</CardTitle>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>Name: {app.personal.legalName}</li>
              <li>DOB: {app.personal.dob}</li>
              <li>Address: {app.personal.address}</li>
              <li>Income: {formatCurrency(app.personal.income)}</li>
              <li>Obligations: {formatCurrency(app.personal.monthlyObligations)}/mo</li>
              <li>Credit: {app.personal.creditScoreRange}</li>
              <li>Utilization: {app.personal.creditUtilization}%</li>
              <li>Requested: {formatCurrency(app.personal.desiredFundingAmount)}</li>
            </ul>
          </Card>
        )}
        {app.business && (
          <Card className="p-5 p-5">
            <CardTitle>Business data</CardTitle>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>{app.business.businessName}</li>
              <li>Entity: {app.business.entityType}</li>
              <li>Revenue: {formatCurrency(app.business.monthlyRevenue)}/mo</li>
              <li>Balance: {formatCurrency(app.business.averageBankBalance)}</li>
              <li>Debt: {formatCurrency(app.business.existingBusinessDebt)}</li>
              <li>Purpose: {app.business.fundingPurpose}</li>
            </ul>
          </Card>
        )}
      </div>

      <Card className="p-5 mt-4">
        <CardTitle>Documents</CardTitle>
        <ul className="mt-2 text-sm text-slate-700">
          {app.documents.map((d) => (
            <li key={d.id}>
              {d.label}: {d.uploaded ? (d.verified ? "verified" : "uploaded") : "missing"}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 mt-4">
        <CardTitle>Readiness summary</CardTitle>
        <CardDescription>Overall score: {app.overallReadiness}/100</CardDescription>
        <p className="mt-2 text-sm text-slate-600">
          Top product: {app.productMatches[0]?.name ?? "Complete questionnaire first"}
        </p>
      </Card>

      {(role === "coach" || role === "admin") && (
        <Card className="p-5 mt-4">
          <CardTitle>Advisor notes</CardTitle>
          <Textarea
            className="mt-2"
            rows={3}
            value={app.advisorNotes}
            onChange={(e) => updateApplication({ advisorNotes: e.target.value })}
            placeholder="Internal notes on accuracy and readiness…"
          />
          {role === "coach" && (
            <Button className="mt-3" onClick={advisorApprove}>
              Advisor sign-off on packet
            </Button>
          )}
        </Card>
      )}

      <p className="mt-4 text-xs text-slate-500">Last updated {formatDate(app.updatedAt)}</p>
    </div>
  );
}
