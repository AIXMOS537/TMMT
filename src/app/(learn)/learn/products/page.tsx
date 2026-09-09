"use client";

import Link from "next/link";
import { useCube } from "@aixmos/core";
import { formatCurrencyWhole } from "@aixmos/core";



import { WorkflowBanner } from "@/components/learn/workflow-banner";
import { Badge, Button, Card, CardDescription, CardTitle } from "@/components/ui";

export default function ProductsPage() {
  const { state } = useCube();
  const matches = state.application.productMatches;

  return (
    <div>
      <WorkflowBanner />
      <Card className="p-5 mb-6">
        <CardTitle>Product & funder matching</CardTitle>
        <CardDescription>
          Matches are based on your truthful profile — fit scores are educational, not approvals.
        </CardDescription>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {matches.length === 0 ? (
          <Card className="p-5 p-5">
            <p className="text-sm text-slate-600">
              Complete questionnaires to see product matches.
            </p>
            <Link href="/learn/questionnaire/personal" className="mt-2 inline-block text-teal-700 text-sm">
              Start questionnaire →
            </Link>
          </Card>
        ) : (
          matches.map((m) => (
            <Card className="p-5" key={m.id}>
              <div className="flex justify-between gap-2">
                <CardTitle className="text-base">{m.name}</CardTitle>
                <Badge tone={m.fitScore >= 70 ? "strong" : m.fitScore >= 50 ? "moderate" : "weak"}>
                  {m.fitScore}% fit
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1 capitalize">
                {m.type} · {m.lenderType}
              </p>
              <p className="mt-3 text-sm text-slate-700">{m.fitReason}</p>
              <p className="mt-2 text-sm text-slate-600">Up to {formatCurrencyWhole(m.maxAmount)}</p>
              <p className="mt-3 text-xs text-amber-900 bg-amber-50 rounded p-2">{m.disclaimer}</p>
            </Card>
          ))
        )}
      </div>

      <div className="mt-6">
        <Link href="/learn/application/review">
          <Button>Review application packet →</Button>
        </Link>
      </div>
    </div>
  );
}
