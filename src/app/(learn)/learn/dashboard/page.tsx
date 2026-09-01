"use client";

import { useCube } from "@aixmos/core";
import { formatCurrency } from "@aixmos/core";


import { ReadinessScoreRing } from "@/components/readiness-score-ring";
import { WorkflowBanner } from "@/components/learn/workflow-banner";
import { Badge, Card, CardDescription, CardTitle } from "@/components/ui";

export default function DashboardPage() {
  const { state } = useCube();
  const app = state.application;
  const p = app.personal;
  const b = app.business;

  return (
    <div>
      <WorkflowBanner />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1 flex flex-col items-center text-center">
          <CardTitle>Funding readiness</CardTitle>
          <CardDescription>Rules-based MVP score — not a lender decision</CardDescription>
          <div className="my-4">
            <ReadinessScoreRing score={app.overallReadiness} />
          </div>
          <p className="text-sm text-slate-600">
            {app.overallReadiness >= 70
              ? "You're building a solid profile. We'll still verify everything before submission."
              : "There's work to do — and that's okay. We'll improve honestly, step by step."}
          </p>
        </Card>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          {app.readiness.map((dim) => (
            <Card className="p-5" key={dim.key}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{dim.label}</p>
                <Badge tone={dim.status}>{dim.score}</Badge>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${
                    dim.status === "strong"
                      ? "bg-emerald-500"
                      : dim.status === "moderate"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${dim.score}%` }}
                />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {p && (
          <Card className="p-5 p-5">
            <CardTitle>Personal snapshot</CardTitle>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>Income: {formatCurrency(p.income)}/yr</li>
              <li>Monthly obligations: {formatCurrency(p.monthlyObligations)}</li>
              <li>Credit range: {p.creditScoreRange}</li>
              <li>Goal: {p.fundingGoal}</li>
              <li>Target: {formatCurrency(p.desiredFundingAmount)}</li>
            </ul>
          </Card>
        )}
        {b && (
          <Card className="p-5 p-5">
            <CardTitle>Business snapshot</CardTitle>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>{b.businessName}</li>
              <li>Revenue: {formatCurrency(b.monthlyRevenue)}/mo</li>
              <li>Avg balance: {formatCurrency(b.averageBankBalance)}</li>
              <li>Purpose: {b.fundingPurpose}</li>
            </ul>
          </Card>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        No approval is guaranteed. Scores reflect readiness factors only and may differ from lender underwriting.
      </p>
    </div>
  );
}
