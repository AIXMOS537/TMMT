import "server-only";
import type { Candidate } from "./dispatch-types";

const HOST = process.env.AIXMOS_AGENT_HOST ?? "http://127.0.0.1:7777";
const TIMEOUT_MS = 1500;

export interface CaptainDispatchInput {
  incident: {
    severity: number | null;
    location: [number, number] | null;
    required_capabilities: string[];
    description: string | null;
  };
  candidates: Candidate[];
}

export interface CaptainDispatchOutput {
  ranked_unit_ids: string[];
  reasoning: string;
}

export async function askCaptainDispatch(
  input: CaptainDispatchInput
): Promise<CaptainDispatchOutput | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = process.env.AIXMOS_AGENT_TOKEN;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${HOST}/agent/captain_dispatch`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.warn("[captain_dispatch] non-2xx", res.status);
      return null;
    }
    const j = (await res.json()) as Partial<CaptainDispatchOutput>;
    if (!Array.isArray(j.ranked_unit_ids) || j.ranked_unit_ids.length === 0) return null;
    const given = new Set(input.candidates.map(c => c.unit_id));
    const allKnown = j.ranked_unit_ids.every(id => given.has(id));
    if (!allKnown) {
      console.warn("[captain_dispatch] returned unknown unit_id; rejecting");
      return null;
    }
    return { ranked_unit_ids: j.ranked_unit_ids, reasoning: j.reasoning ?? "" };
  } catch (err) {
    console.warn("[captain_dispatch] error", (err as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}
