"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { useCube } from "@aixmos/core";
import type { FundingTrack } from "@aixmos/core";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { WorkflowBanner } from "@/components/workflow-banner";

export default function OnboardingPage() {
  const router = useRouter();
  const { state, setUser, updateApplication, transitionStatus } = useCube();
  const [track, setTrack] = useState<FundingTrack>(state.currentUser.track);
  const [agreed, setAgreed] = useState(false);

  function complete() {
    setUser({ onboardingComplete: true, track });
    updateApplication({ track, clientName: state.currentUser.name });
    transitionStatus("questionnaire_in_progress", "Client completed onboarding");
    router.push(track === "business" ? "/questionnaire/business" : "/questionnaire/personal");
  }

  return (
    <div>
      <WorkflowBanner />
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <HeartHandshake className="h-8 w-8 text-teal-700" />
          <div>
            <CardTitle>Welcome to AIXMOS</CardTitle>
            <CardDescription>
              We&apos;re like family in your corner — warm, honest, and firm about doing this the right way.
            </CardDescription>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            AIXMOS helps you understand what lenders look for, complete a truthful baseline profile, get
            personalized coaching, and prepare an accurate application packet — with internal review before
            anything is submitted.
          </p>

          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <strong>Our promise:</strong> We will never help you lie, inflate income, fake documents, hide
            debt, or misrepresent business revenue. Better readiness, better timing, better fit — that&apos;s
            the goal.
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">What are you funding?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["personal", "business", "both"] as FundingTrack[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrack(t)}
                  className={`rounded-lg border px-4 py-3 text-sm capitalize transition ${
                    track === t
                      ? "border-teal-600 bg-teal-50 text-teal-900"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            I understand AIXMOS does not guarantee approvals and I commit to providing truthful information.
          </label>

          <Button disabled={!agreed} onClick={complete}>
            Start baseline questionnaire
          </Button>
        </div>
      </Card>
    </div>
  );
}
