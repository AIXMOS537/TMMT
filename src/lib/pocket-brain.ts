import "server-only";

// AIXMOS Pocket — the brain client.
//
// DELIBERATELY NOT Anthropic. The whole point of the local-first stack
// (docs/LOCAL-FIRST-AI-STACK.md) is that inference runs on the OWNER'S brain —
// the LiteLLM router / Ollama hub — so there is no per-token cost paid to a third
// party. Members pay in TMMT TOKENS (src/lib/token-ledger.ts), not in someone
// else's API coins.
//
// This client speaks the OpenAI-compatible Chat Completions API, which both
// LiteLLM (the router) and Ollama (`/v1/chat/completions`) expose. Point it at
// your endpoint with env:
//   POCKET_BRAIN_URL   e.g. http://<hub-tailnet-ip>:4000/v1/chat/completions
//                      (the LiteLLM router) — must be reachable from where the
//                      app runs. For a Vercel deploy that means a reachable host
//                      (rented GPU box / gateway), not a home-only tailnet IP.
//   POCKET_BRAIN_MODEL e.g. "code" (a LiteLLM model_name) or "qwen2.5:14b"
//   POCKET_BRAIN_KEY   optional bearer token for the router (never the client).

export interface BrainResult {
  ok: boolean;
  text: string;
  /** Why it failed, for logging — never shown raw to members. */
  error?: "not_configured" | "unreachable" | "empty" | "bad_response";
}

const DEFAULT_MODEL = "qwen2.5:14b";
const TIMEOUT_MS = 30_000;

// The compliance-locked persona (see docs/aixmos-pocket/COPY.md). Guidance only.
export const POCKET_SYSTEM_PROMPT = [
  "You are the AIXMOS Pocket guidance coach.",
  "You help members with credit GUIDANCE and education, and with learning the",
  "AIXMOS network. You are a companion and education tool — NOT a credit repair",
  "organization, not an attorney, not a financial or investment advisor.",
  "You never promise score changes, outcomes, or income.",
  "You speak only of credit guidance, coaching, plans, and education — never",
  "'repair', 'fix', 'delete', 'guarantee', or '100%'.",
  "For anything that needs a licensed professional, say so and point the member",
  "to one. Protect the member first; on a heavy day, gently point to real human",
  "support. Be warm, brief, and practical.",
].join(" ");

/**
 * Ask the owner's self-hosted brain. Returns ok:false (never throws) so the
 * route can refund the token spend and show a friendly message.
 */
export async function askPocketBrain(args: {
  userMessage: string;
  system?: string;
  model?: string;
}): Promise<BrainResult> {
  const url = process.env.POCKET_BRAIN_URL;
  if (!url) return { ok: false, text: "", error: "not_configured" };

  const model = args.model || process.env.POCKET_BRAIN_MODEL || DEFAULT_MODEL;
  const key = process.env.POCKET_BRAIN_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: args.system ?? POCKET_SYSTEM_PROMPT },
          { role: "user", content: args.userMessage },
        ],
      }),
    });
    if (!resp.ok) return { ok: false, text: "", error: "bad_response" };

    const data: unknown = await resp.json();
    const text = extractText(data);
    if (!text) return { ok: false, text: "", error: "empty" };
    return { ok: true, text };
  } catch {
    return { ok: false, text: "", error: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

// Handle both OpenAI-style (choices[0].message.content) and Ollama native
// (message.content) shapes, so the same client works against either backend.
function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;

  const choices = d.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const msg = (choices[0] as Record<string, unknown>).message;
    if (msg && typeof msg === "object") {
      const c = (msg as Record<string, unknown>).content;
      if (typeof c === "string") return c.trim();
    }
  }

  const message = d.message;
  if (message && typeof message === "object") {
    const c = (message as Record<string, unknown>).content;
    if (typeof c === "string") return c.trim();
  }
  return "";
}
