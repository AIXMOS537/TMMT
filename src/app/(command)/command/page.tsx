"use client";

import { useEffect, useState } from "react";
import VoiceCapture from "@/components/VoiceCapture";
import {
  Card,
  Button,
  FormField,
  ErrorBanner,
  inputClass,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import {
  ownerRefineTranscript,
  runOpsAiReview,
  submitOpsMessage,
  publishOpsMessage,
  applyAiSuggestion,
} from "@/app/ops-actions";
import { getOpsMessages } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";
import { ShieldCheck, Send } from "lucide-react";

type Review = {
  aligned: boolean;
  score: number;
  issues: string[];
  suggestedBody: string;
  summary: string;
};

export default function CommandCenterPage() {
  const [transcript, setTranscript] = useState("");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [assistantNotes, setAssistantNotes] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [inbox, setInbox] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadInbox = () => {
    getOpsMessages({ audience: "executives" }).then(setInbox).catch(() => setError("Failed to load commands."));
  };

  useEffect(loadInbox, []);

  const handleRefine = async () => {
    setLoading(true);
    setError(null);
    const result = await ownerRefineTranscript(transcript || body);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.draft) setBody(result.draft);
    setAssistantNotes(result.notes ?? null);
  };

  const handleReview = async () => {
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("body", body);
    fd.set("audience", "executives");
    fd.set("message_kind", "command");
    const result = await runOpsAiReview(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.review) setReview(result.review);
  };

  const handleDispatch = async (skipReview: boolean) => {
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("body", body);
    fd.set("title", title || body.slice(0, 60));
    fd.set("raw_transcript", transcript);
    fd.set("audience", "executives");
    fd.set("message_kind", "command");
    fd.set("publish", "true");
    if (skipReview) fd.set("skip_review", "true");
    const result = await submitOpsMessage(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.review) setReview(result.review);
    setTranscript("");
    setBody("");
    setTitle("");
    loadInbox();
  };

  const useSuggestion = async (messageId: string) => {
    setLoading(true);
    const result = await applyAiSuggestion(messageId);
    setLoading(false);
    if (result.success && result.review) setReview(result.review);
    loadInbox();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command desk"
        description="Speak to your AI assistant first, then fact-check before your 3 executive VAs execute"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-600" />
            1. Speak or type
          </h2>
          <VoiceCapture
            onTranscript={(text) => {
              setTranscript(text);
              if (!body || body === transcript) setBody(text);
            }}
            disabled={loading}
          />
          <FormField label="Voice transcript (raw)">
            <textarea
              className={inputClass}
              rows={2}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your spoken words appear here…"
            />
          </FormField>
          <Button type="button" variant="secondary" onClick={handleRefine} disabled={loading}>
            2. AI assistant — refine command
          </Button>
          {assistantNotes && (
            <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg">
              Assistant: {assistantNotes}
            </p>
          )}
          <FormField label="Command title (optional)">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday operator sync"
            />
          </FormField>
          <FormField label="Command to executive VAs" required>
            <textarea
              className={inputClass}
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Refined command for your 3 executive VAs…"
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleReview} disabled={loading}>
              3. AI fact-check
            </Button>
            <Button type="button" onClick={() => handleDispatch(false)} disabled={loading}>
              <Send size={16} />
              Send (after review)
            </Button>
          </div>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">AI review</h2>
          {!review ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Run fact-check to verify alignment with company policy before dispatch.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={review.aligned && review.score >= 0.75 ? "Aligned" : "Needs edit"}
                />
                <span className="text-gray-500">Score {(review.score * 100).toFixed(0)}%</span>
              </div>
              <p className="text-gray-700 dark:text-slate-300">{review.summary}</p>
              {review.issues.length > 0 && (
                <ul className="list-disc pl-5 text-amber-800 dark:text-amber-200">
                  {review.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <FormField label="Suggested revision">
                <textarea className={inputClass} rows={5} readOnly value={review.suggestedBody} />
              </FormField>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBody(review.suggestedBody)}
              >
                Use suggestion in editor
              </Button>
              {review.aligned && review.score >= 0.75 && (
                <Button type="button" onClick={() => handleDispatch(true)} disabled={loading}>
                  Dispatch to executive VAs now
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Sent to executive VAs
        </h2>
        <ul className="space-y-2">
          {inbox
            .filter((m) => m.audience === "executives")
            .slice(0, 20)
            .map((m) => (
              <li key={String(m.id)}>
                <Card className="p-4">
                  <div className="flex justify-between gap-2 mb-2">
                    <StatusBadge status={String(m.status)} />
                    <span className="text-xs text-gray-400">{formatDateTime(m.created_at as string)}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">
                    {m.body as string}
                  </p>
                  {m.status === "needs_edit" && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => useSuggestion(String(m.id))}
                    >
                      Apply AI fix
                    </Button>
                  )}
                  {m.status === "approved" && (
                    <Button
                      type="button"
                      className="mt-2"
                      onClick={async () => {
                        await publishOpsMessage(String(m.id));
                        loadInbox();
                      }}
                    >
                      Publish to executives
                    </Button>
                  )}
                </Card>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
