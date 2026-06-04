"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCube } from "@aixmos/core";
import { Button } from "@/components/aixmos-ui/button";
import { Card, CardDescription, CardTitle } from "@/components/aixmos-ui/card";
import { WorkflowBanner } from "@/components/learn/workflow-banner";

export default function ConsentPage() {
  const router = useRouter();
  const { state, updateApplication, transitionStatus } = useCube();
  const app = state.application;
  const [confirmed, setConfirmed] = useState(false);
  const [accurate, setAccurate] = useState(false);
  const [noGuarantee, setNoGuarantee] = useState(false);

  const canConsent =
    confirmed &&
    accurate &&
    noGuarantee &&
    app.status === "supervisor_approved" &&
    state.currentUser.role === "client";

  const blocked = app.status !== "supervisor_approved";

  function giveConsent() {
    updateApplication({
      clientConsentGiven: true,
      consentTimestamp: new Date().toISOString(),
    });
    transitionStatus("client_consent_given", "Client provided final consent per application");
    router.push("/status");
  }

  return (
    <div>
      <WorkflowBanner />
      <Card>
        <CardTitle>Final client consent</CardTitle>
        <CardDescription>
          Required after admin and supervisor approval — per lender/application before submission.
        </CardDescription>

        {blocked && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Consent unlocks after supervisor approval. Current status: <strong>{app.status}</strong>.
            {state.currentUser.role !== "client" && (
              <span> Switch to Client role to simulate consent.</span>
            )}
          </div>
        )}

        <div className="mt-6 space-y-3 text-sm text-slate-700">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I have reviewed my application packet and all attached information is complete.
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={accurate} onChange={(e) => setAccurate(e.target.checked)} />
            I confirm all income, debt, and business figures are truthful and match my documents.
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={noGuarantee} onChange={(e) => setNoGuarantee(e.target.checked)} />
            I understand AIXMOS and lenders do not guarantee approval, rates, or funding amounts.
          </label>
        </div>

        <Button className="mt-6" disabled={!canConsent} onClick={giveConsent}>
          I consent — proceed to submission
        </Button>

        {app.clientConsentGiven && app.consentTimestamp && (
          <p className="mt-4 text-sm text-emerald-700">
            Consent recorded. You may proceed to submission status.
          </p>
        )}
      </Card>
    </div>
  );
}
