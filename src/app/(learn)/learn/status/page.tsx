"use client";

import { useState } from "react";
import { useCube } from "@aixmos/core";
import { prepareManualSubmission, submitApplicationStub } from "@aixmos/core";
import { formatDate } from "@aixmos/core";
import { Button } from "@/components/aixmos-ui/button";
import { Card, CardDescription, CardTitle } from "@/components/aixmos-ui/card";
import { Badge } from "@/components/aixmos-ui/badge";
import { WorkflowBanner } from "@/components/learn/workflow-banner";
import { CUBE_DEMO_CONTROLS } from "@/lib/cube-demo-controls";

export default function StatusPage() {
  const { state, updateApplication, transitionStatus } = useCube();
  const app = state.application;
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submitStub() {
    if (!app.clientConsentGiven) return;
    setSubmitting(true);
    const payload = {
      applicationId: app.id,
      clientName: app.clientName,
      track: app.track,
      productId: app.productMatches[0]?.id ?? "unknown",
      verifiedAt: new Date().toISOString(),
    };
    const res = await submitApplicationStub(payload);
    updateApplication({
      submissionMethod: res.method,
      submissionReference: res.referenceId,
    });
    transitionStatus("submitted", "Application submitted via MVP stub adapter", res.message);
    setResult(res.message);
    setSubmitting(false);
  }

  async function prepareManual() {
    setSubmitting(true);
    const res = await prepareManualSubmission({
      applicationId: app.id,
      clientName: app.clientName,
      track: app.track,
      productId: app.productMatches[0]?.id ?? "unknown",
      verifiedAt: new Date().toISOString(),
    });
    updateApplication({
      submissionMethod: res.method,
      submissionReference: res.referenceId,
    });
    transitionStatus("prepared_for_manual", "Packet prepared for manual submission", res.message);
    setResult(res.message);
    setSubmitting(false);
  }

  return (
    <div>
      <WorkflowBanner />
      <Card>
        <CardTitle>Submission status tracker</CardTitle>
        <CardDescription>
          {CUBE_DEMO_CONTROLS
            ? "Demo build — the submit button below uses a stub adapter and calls no lender."
            : "Your funding packet is submitted by the TMMT team, not automatically. You will be told once it goes out."}
        </CardDescription>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Status</p>
            <Badge tone="info" className="mt-1">
              {app.status}
            </Badge>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Reference</p>
            <p className="font-mono text-sm">{app.submissionReference ?? "—"}</p>
          </div>
        </div>

        {/* The stub calls no lender. It invents an AIX-STUB- reference, writes
            "submitted" into the audit log, and returns in 800ms — so on a
            production deploy a client could believe their application had gone
            to a lender when nothing had left the building. The real path is the
            staff "Prepare manual submission packet" below, which is a person
            doing it. Demo builds keep the button; production does not get it. */}
        {CUBE_DEMO_CONTROLS &&
          app.clientConsentGiven &&
          state.currentUser.role === "client" &&
          app.status === "client_consent_given" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={submitting} onClick={submitStub}>
                Submit (API stub)
              </Button>
            </div>
          )}

        {!CUBE_DEMO_CONTROLS &&
          app.clientConsentGiven &&
          state.currentUser.role === "client" &&
          app.status === "client_consent_given" && (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Your consent is recorded and your packet is with the TMMT team.
              They review it and submit on your behalf — there is nothing more
              for you to do here.
            </p>
          )}

        {["supervisor", "admin", "coach"].includes(state.currentUser.role) && (
          <div className="mt-4">
            <Button variant="secondary" disabled={submitting} onClick={prepareManual}>
              Prepare manual submission packet
            </Button>
          </div>
        )}

        {result && <p className="mt-4 text-sm text-teal-800">{result}</p>}
      </Card>

      <Card className="mt-6">
        <CardTitle>Audit log</CardTitle>
        <ul className="mt-3 max-h-80 overflow-y-auto space-y-2">
          {[...app.auditLog].reverse().map((entry) => (
            <li key={entry.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{entry.action}</span>
                <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
              </div>
              <p className="text-slate-600">
                {entry.actor} ({entry.role})
                {entry.fromStatus && entry.toStatus && (
                  <> · {entry.fromStatus} → {entry.toStatus}</>
                )}
              </p>
              {entry.notes && <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
