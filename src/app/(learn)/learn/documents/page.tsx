"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Circle, Upload, Loader2, X } from "lucide-react";
import { useCube } from "@aixmos/core";
import { Button } from "@/components/aixmos-ui/button";
import { Card, CardDescription, CardTitle } from "@/components/aixmos-ui/card";
import { Badge } from "@/components/aixmos-ui/badge";
import { WorkflowBanner } from "@/components/learn/workflow-banner";
import {
  listProgramDocuments,
  removeProgramDocument,
  uploadProgramDocument,
  verifyProgramDocument,
  type ProgramDocument,
} from "./actions";

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { state, updateApplication } = useCube();
  const docs = state.application.documents;
  const applicationId = state.application.id;

  const [stored, setStored] = useState<Record<string, ProgramDocument>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  // The deep link carries the token for applicants who are not signed in.
  const token =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("token");

  /** Cube state mirrors what is actually in storage — never the other way round. */
  function syncCube(next: Record<string, ProgramDocument>) {
    updateApplication({
      documents: docs.map((d) => ({
        ...d,
        uploaded: Boolean(next[d.id]),
        verified: next[d.id]?.verified ?? false,
      })),
    });
  }

  useEffect(() => {
    let cancelled = false;
    listProgramDocuments(applicationId, token)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const map = Object.fromEntries(res.data.map((d) => [d.docKey, d]));
        setStored(map);
        syncCube(map);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per application — syncCube depends on cube state we are writing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function onPick(docId: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(docId);

    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("docKey", docId);
    if (token) fd.set("token", token);
    fd.set("file", file);

    const res = await uploadProgramDocument(fd);
    setBusy(null);
    if (inputs.current[docId]) inputs.current[docId]!.value = "";

    if (!res.ok) {
      setError(res.error);
      return;
    }
    const next = { ...stored, [docId]: res.data };
    setStored(next);
    startTransition(() => syncCube(next));
  }

  async function onRemove(docId: string) {
    setError(null);
    setBusy(docId);
    const res = await removeProgramDocument(applicationId, docId, token);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const next = { ...stored };
    delete next[docId];
    setStored(next);
    startTransition(() => syncCube(next));
  }

  async function onVerify(docId: string, verified: boolean) {
    setError(null);
    setBusy(docId);
    const res = await verifyProgramDocument(applicationId, docId, verified);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const next = { ...stored, [docId]: { ...stored[docId], verified } };
    setStored(next);
    startTransition(() => syncCube(next));
  }

  const required = docs.filter((d) => d.required);
  const uploadedRequired = required.filter((d) => stored[d.id]).length;
  const isStaff = ["admin", "supervisor", "coach"].includes(state.currentUser.role);

  return (
    <div>
      <WorkflowBanner />

      <Card className="mb-4">
        <CardTitle>Document checklist</CardTitle>
        <CardDescription>
          JPEG, PNG, WebP or PDF, up to 12 MB each. Your files are stored
          privately and are only visible to you and the TMMT review team.
        </CardDescription>
        <p className="mt-2 text-sm text-slate-700">
          Required: {uploadedRequired}/{required.length} uploaded
        </p>
      </Card>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {docs.map((doc) => {
          const file = stored[doc.id];
          const pending = busy === doc.id;

          return (
            <Card key={doc.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {file ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" />
                )}
                <div>
                  <p className="font-medium text-slate-900">{doc.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {doc.required && <Badge tone="moderate">Required</Badge>}
                    {file?.verified && <Badge tone="strong">Verified</Badge>}
                    {file && (
                      <span className="text-xs text-slate-500">
                        {file.fileName} · {readableSize(file.sizeBytes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={(el) => {
                    inputs.current[doc.id] = el;
                  }}
                  id={`file-${doc.id}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  onChange={(e) => onPick(doc.id, e.target.files?.[0])}
                  disabled={pending || loading}
                />
                <label
                  htmlFor={`file-${doc.id}`}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  aria-disabled={pending || loading}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {file ? "Replace" : "Choose file"}
                </label>

                {file && (
                  <Button
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => onRemove(doc.id)}
                    disabled={pending}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                )}

                {isStaff && file && (
                  <Button
                    variant="secondary"
                    onClick={() => onVerify(doc.id, !file.verified)}
                    disabled={pending}
                  >
                    {file.verified ? "Unverify" : "Verify"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
