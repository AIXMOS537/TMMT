import "server-only";
import { loadCompanyPolicyText } from "@/lib/ops-policy";

export type OpsAiReview = {
  aligned: boolean;
  score: number;
  issues: string[];
  suggestedBody: string;
  summary: string;
};

const REVIEW_SCHEMA = `Respond with ONLY valid JSON (no markdown):
{
  "aligned": boolean,
  "score": number between 0 and 1,
  "issues": string[],
  "suggestedBody": string,
  "summary": string
}`;

export async function reviewOpsMessage(
  body: string,
  context: { audience: string; messageKind: string; authorRole: string }
): Promise<OpsAiReview> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackReview(body);
  }

  const policy = await loadCompanyPolicyText();

  const userPrompt = `Fact-check this internal ops message before it is sent to "${context.audience}".

Author role: ${context.authorRole}
Message kind: ${context.messageKind}

--- COMPANY POLICY ---
${policy.slice(0, 12000)}
--- END POLICY ---

--- MESSAGE TO REVIEW ---
${body}
--- END MESSAGE ---

Check: factual accuracy, policy alignment, tone/voice, clarity (who/what/when), and whether operators could misexecute it.
If not aligned, provide a corrected suggestedBody that fixes issues while keeping intent.

${REVIEW_SCHEMA}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_OPS_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    console.error("[ops-ai] anthropic error", res.status, await res.text());
    return fallbackReview(body);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text.trim()) as OpsAiReview;
    return {
      aligned: Boolean(parsed.aligned),
      score: Number(parsed.score) || 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestedBody: String(parsed.suggestedBody || body),
      summary: String(parsed.summary || ""),
    };
  } catch {
    console.error("[ops-ai] invalid JSON", text.slice(0, 200));
    return fallbackReview(body);
  }
}

export async function refineOwnerDraft(
  rawTranscript: string
): Promise<{ draft: string; notes: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      draft: rawTranscript.trim(),
      notes: "AI assistant unavailable — add ANTHROPIC_API_KEY to refine drafts.",
    };
  }

  const policy = await loadCompanyPolicyText();

  const userPrompt = `You are the owner's private executive assistant (not customer-facing).

Turn this voice transcript into a clear internal COMMAND for 3 executive VAs.
- Keep the owner's intent
- Structure: objective, key actions, deadlines if mentioned, who executes
- Do not add pricing or promises not in the transcript
- Align with company policy below

--- POLICY (summary) ---
${policy.slice(0, 6000)}

--- TRANSCRIPT ---
${rawTranscript}
--- END ---

Respond JSON only:
{"draft": "...", "notes": "brief note to owner about assumptions or questions"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_OPS_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    return { draft: rawTranscript.trim(), notes: "Could not reach AI — using raw transcript." };
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text.trim()) as { draft: string; notes: string };
    return {
      draft: String(parsed.draft || rawTranscript).trim(),
      notes: String(parsed.notes || ""),
    };
  } catch {
    return { draft: rawTranscript.trim(), notes: "" };
  }
}

function fallbackReview(body: string): OpsAiReview {
  return {
    aligned: true,
    score: 0.5,
    issues: ["AI review skipped — set ANTHROPIC_API_KEY for automated fact-checking."],
    suggestedBody: body,
    summary: "Manual review required.",
  };
}
