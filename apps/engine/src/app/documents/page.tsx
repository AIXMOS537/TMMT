"use client";

import { CheckCircle2, Circle, Upload } from "lucide-react";
import { useCube } from "@aixmos/core";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowBanner } from "@/components/workflow-banner";

export default function DocumentsPage() {
  const { state, updateApplication } = useCube();
  const docs = state.application.documents;
  const required = docs.filter((d) => d.required);
  const uploadedRequired = required.filter((d) => d.uploaded).length;

  function toggleUpload(id: string) {
    updateApplication({
      documents: docs.map((d) =>
        d.id === id ? { ...d, uploaded: !d.uploaded, verified: false } : d
      ),
    });
  }

  function verifyDoc(id: string) {
    const doc = docs.find((d) => d.id === id);
    if (!doc?.uploaded) return;
    updateApplication({
      documents: docs.map((d) => (d.id === id ? { ...d, verified: !d.verified } : d)),
    });
  }

  const isStaff = ["admin", "supervisor", "coach"].includes(state.currentUser.role);

  return (
    <div>
      <WorkflowBanner />
      <Card className="mb-4">
        <CardTitle>Document checklist</CardTitle>
        <CardDescription>
          MVP simulates uploads — in production, files would be scanned and matched to application data.
        </CardDescription>
        <p className="mt-2 text-sm text-slate-700">
          Required: {uploadedRequired}/{required.length} uploaded
        </p>
      </Card>

      <ul className="space-y-3">
        {docs.map((doc) => (
          <Card key={doc.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {doc.uploaded ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300" />
              )}
              <div>
                <p className="font-medium text-slate-900">{doc.label}</p>
                <div className="flex gap-2 mt-1">
                  {doc.required && <Badge tone="moderate">Required</Badge>}
                  {doc.verified && <Badge tone="strong">Verified</Badge>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1 text-xs" onClick={() => toggleUpload(doc.id)}>
                <Upload className="h-4 w-4" />
                {doc.uploaded ? "Remove" : "Mark uploaded"}
              </Button>
              {isStaff && doc.uploaded && (
                <Button variant="secondary" onClick={() => verifyDoc(doc.id)}>
                  {doc.verified ? "Unverify" : "Verify"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </ul>
    </div>
  );
}
