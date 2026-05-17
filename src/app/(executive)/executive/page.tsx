"use client";

import { useEffect, useState } from "react";
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
  runOpsAiReview,
  submitOpsMessage,
  publishOpsMessage,
  applyAiSuggestion,
} from "@/app/ops-actions";
import { getOpsMessages } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";
import { Users } from "lucide-react";

type Review = {
  aligned: boolean;
  score: number;
  issues: string[];
  suggestedBody: string;
  summary: string;
};

export default function ExecutiveVaPage() {
  const [commands, setCommands] = useState<Record<string, unknown>[]>([]);
  const [relayBody, setRelayBody] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    getOpsMessages({ audience: "executives", status: "published" })
      .then(setCommands)
      .catch(() => setError("Failed to load owner commands."));
  };

  useEffect(load, []);

  const handleReview = async () => {
    if (!relayBody.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("body", relayBody);
    fd.set("audience", "operators");
    fd.set("message_kind", "relay");
    const result = await runOpsAiReview(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.review) setReview(result.review);
  };

  const handleSubmit = async (publish: boolean) => {
    if (!relayBody.trim() || !threadId) {
      setError("Select an owner command thread first.");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("thread_id", threadId);
    fd.set("body", relayBody);
    fd.set("audience", "operators");
    fd.set("message_kind", "relay");
    fd.set("publish", publish ? "true" : "false");
    const result = await submitOpsMessage(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.review) setReview(result.review);
    if (publish) {
      setRelayBody("");
      setReview(null);
    }
    load();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Executive VA workspace"
        description="Execute owner commands and share AI-reviewed instructions with operators"
      />

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Owner commands
        </h2>
        {commands.length === 0 ? (
          <Card className="p-6 text-sm text-gray-500">No published commands yet.</Card>
        ) : (
          <ul className="space-y-3">
            {commands.map((c) => (
              <li key={String(c.id)}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setThreadId(String(c.thread_id))}
                >
                  <Card
                    className={`p-4 transition-colors ${
                      threadId === c.thread_id
                        ? "border-blue-500 ring-1 ring-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between mb-2">
                      <StatusBadge status="From owner" />
                      <span className="text-xs text-gray-400">
                        {formatDateTime(c.created_at as string)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body as string}</p>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={18} />
          Relay to operators
        </h2>
        <p className="text-xs text-gray-500">
          Every operator message is fact-checked against company policy before it goes live.
        </p>
        <FormField label="Instructions for operators" required>
          <textarea
            className={inputClass}
            rows={5}
            value={relayBody}
            onChange={(e) => setRelayBody(e.target.value)}
            placeholder="What should operators do? Be specific: who, what, when."
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleReview} disabled={loading}>
            AI fact-check
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading || !threadId}
          >
            Save draft
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading || !threadId}
          >
            Publish to operators (AI-gated)
          </Button>
        </div>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {review && (
          <div className="border-t pt-4 text-sm space-y-2">
            <StatusBadge
              status={review.aligned && review.score >= 0.75 ? "Aligned" : "Needs edit"}
            />
            <p>{review.summary}</p>
            {review.issues.map((i) => (
              <p key={i} className="text-amber-700 dark:text-amber-300">
                • {i}
              </p>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRelayBody(review.suggestedBody)}
            >
              Use AI suggestion
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
