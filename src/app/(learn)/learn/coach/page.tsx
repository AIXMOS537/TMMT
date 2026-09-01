"use client";

import { Clock, Heart, ShieldAlert } from "lucide-react";
import { useCube, workPath } from "@aixmos/core";



import { WorkflowBanner } from "@/components/learn/workflow-banner";
import { Badge, Button, Card, CardDescription, CardTitle } from "@/components/ui";

const TIMING_LABELS = {
  apply_now: { label: "May apply now", tone: "strong" as const, icon: Heart },
  wait_and_improve: { label: "Wait & improve", tone: "weak" as const, icon: Clock },
  consider_alternatives: { label: "Consider alternatives", tone: "moderate" as const, icon: ShieldAlert },
};

export default function CoachPage() {
  const { state, transitionStatus, updateApplication } = useCube();
  const role = state.currentUser.role;
  const insights = state.application.coachingInsights;

  function markCoachReviewed() {
    transitionStatus("coach_reviewed", "Coach/advisor completed coaching review");
    updateApplication({
      advisorNotes:
        state.application.advisorNotes ||
        "Client coached on weak dimensions. No misrepresentation flagged.",
    });
  }

  return (
    <div>
      <WorkflowBanner />
      <Card className="p-5 mb-6 border-teal-200 bg-teal-50/50">
        <div className="flex items-start gap-3">
          <Heart className="h-6 w-6 text-teal-700 shrink-0" />
          <div>
            <CardTitle>Your AIXMOS coach</CardTitle>
            <CardDescription>
              Think of us as mom and dad in your corner — we&apos;ll tell you the truth, protect you from bad
              moves, and cheer you on when you&apos;re ready.
            </CardDescription>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {insights.map((item, i) => {
          const timing = TIMING_LABELS[item.timingAdvice];
          const Icon = timing.icon;
          return (
            <Card className="p-5" key={i}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{item.dimension}</CardTitle>
                <Badge tone={timing.tone}>
                  <Icon className="mr-1 inline h-3 w-3" />
                  {timing.label}
                </Badge>
              </div>
              <p className="mt-2 text-sm italic text-teal-800">{item.message}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-800">What lenders look for</dt>
                  <dd className="text-slate-600">{item.lenderPerspective}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-800">Why it matters</dt>
                  <dd className="text-slate-600">{item.whyItMatters}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-slate-800">What you can do (truthfully)</dt>
                  <dd className="text-slate-600">{item.truthfulActions}</dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>

      {(role === "coach" || role === "admin" || role === "supervisor") && (
        <div className="mt-6 flex flex-wrap gap-2">
          <a href={workPath("/work/review", state.application.id)}>
            <Button variant="secondary">Open Work face — advisor review</Button>
          </a>
          {role === "coach" && (
            <Button onClick={markCoachReviewed}>Mark coaching complete (demo)</Button>
          )}
        </div>
      )}
    </div>
  );
}
