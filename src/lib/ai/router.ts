import "server-only";

/**
 * Local-first AI router — never blocked by tokens.
 *
 * Generation and embeddings try a LOCAL model (Ollama on the Brainiac GPU,
 * reachable over Tailscale) FIRST — free and unlimited — and only fall back to a
 * cloud provider when local is unavailable. One stable interface, swappable
 * backends; callers never change. See docs/SOVEREIGN-STACK.md.
 *
 * Env:
 *   OLLAMA_URL          default http://localhost:11434 (set to your Brainiac MagicDNS)
 *   OLLAMA_MODEL        default qwen2.5:14b
 *   OLLAMA_EMBED_MODEL  default nomic-embed-text
 *   ANTHROPIC_API_KEY   fallback for generation (optional)
 *   ANTHROPIC_OPS_MODEL default claude-sonnet-4-6
 *   OPENAI_API_KEY      fallback for embeddings (optional)
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

export type GenBackend = "ollama" | "anthropic" | "none";
export type EmbedBackend = "ollama" | "openai" | "none";

export interface GenerateInput {
  prompt: string;
  system?: string;
  maxTokens?: number;
}
export interface GenerateResult {
  text: string;
  backend: GenBackend;
}

async function ollamaGenerate(input: GenerateInput): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          ...(input.system ? [{ role: "system", content: input.system }] : []),
          { role: "user", content: input.prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { message?: { content?: string } };
    return j?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function anthropicGenerate(input: GenerateInput): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_OPS_MODEL || "claude-sonnet-4-6";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        messages: [{ role: "user", content: input.prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = (j.content ?? []).map((b) => b.text ?? "").join("");
    return text || null;
  } catch {
    return null;
  }
}

/** Generate text: local Ollama first, cloud fallback, graceful "none". */
export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const local = await ollamaGenerate(input);
  if (local != null) return { text: local, backend: "ollama" };
  const cloud = await anthropicGenerate(input);
  if (cloud != null) return { text: cloud, backend: "anthropic" };
  return { text: "", backend: "none" };
}

export interface EmbedResult {
  vector: number[] | null;
  backend: EmbedBackend;
}

async function ollamaEmbed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { embedding?: number[] };
    return Array.isArray(j.embedding) ? j.embedding : null;
  } catch {
    return null;
  }
}

async function openaiEmbed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    return j.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Embed text: local Ollama first, cloud fallback, graceful null. */
export async function embed(text: string): Promise<EmbedResult> {
  const local = await ollamaEmbed(text);
  if (local) return { vector: local, backend: "ollama" };
  const cloud = await openaiEmbed(text);
  if (cloud) return { vector: cloud, backend: "openai" };
  return { vector: null, backend: "none" };
}

/** Is a local model reachable right now? (for health checks / routing hints) */
export async function localAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}
