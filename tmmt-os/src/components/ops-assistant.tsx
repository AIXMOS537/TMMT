"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OpsAssistantVoice } from "@/components/ops-assistant-voice";
import { cn } from "@/lib/utils";
import type { OpsCommandResponse } from "@/lib/ops-command/types";

type ChatLine = {
  role: "you" | "system";
  text: string;
  response?: OpsCommandResponse;
};

const EXAMPLES = [
  "what is pending",
  "assign maria@tmmtrentals.net to case TMMT-ABC123",
  "approve crm for partner-portal-test@tmmt-rentals.local",
  "post $45 expense to partner-portal-test@tmmt-rentals.local for interior detail show billing",
  "assign vendor Detail Pro to case TMMT-ABC123",
  "move case TMMT-ABC123 to blocked",
];

export function OpsAssistant() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "system",
      text: "Tell me what to assign or update. I'll run it in TMMT OS + ClickUp when configured.",
    },
  ]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;

    setLines((prev) => [...prev, { role: "you", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as OpsCommandResponse & { error?: string };
      if (!res.ok) {
        setLines((prev) => [
          ...prev,
          { role: "system", text: data.error ?? `Error ${res.status}` },
        ]);
        return;
      }

      const summary = data.results
        .map((r) => `${r.ok ? "✓" : "✗"} ${r.message}`)
        .join("\n");
      setLines((prev) => [...prev, { role: "system", text: summary, response: data }]);
    } catch (e) {
      setLines((prev) => [
        ...prev,
        { role: "system", text: e instanceof Error ? e.message : "Request failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const onVoiceTranscript = useCallback(
    (text: string) => {
      void send(text);
    },
    [send]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-[min(50vh,420px)] space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-card/80 p-4 scrollbar-thin">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
              line.role === "you"
                ? "ml-6 bg-primary/10 text-foreground"
                : "mr-6 bg-muted/60 text-muted-foreground"
            )}
          >
            {line.text}
            {line.response?.results.some((r) => r.links?.length) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {line.response.results.flatMap((r) => r.links ?? []).map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium text-primary underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <OpsAssistantVoice onTranscript={onVoiceTranscript} disabled={loading} />

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => void send(ex)}
          >
            {ex}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. assign jane@tmmt.com to case TMMT-ABC123"
          rows={2}
          className="min-h-[3rem] flex-1 resize-none"
        />
        <Button type="submit" className="shrink-0 sm:self-end" disabled={loading}>
          {loading ? "Running…" : "Run"}
        </Button>
      </form>
    </div>
  );
}
