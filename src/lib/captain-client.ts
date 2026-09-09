import "server-only";
import type { Candidate } from "./dispatch-types";
import { clearDegraded, reportDegraded } from "@/lib/degraded";

const ENV_HOST = process.env.AIXMOS_AGENT_HOST;
const HOST = ENV_HOST ?? "http://127.0.0.1:7777";
const TIMEOUT_MS = 1500;

/**
 * Every failure here is invisible by design: the caller falls back to the first
 * candidate and dispatch keeps working. That is the right behaviour — and it is
 * exactly why this went unnoticed. Measured 2026-09-09: the agent host had served
 * ZERO requests in three days of uptime, because production has no
 * AIXMOS_AGENT_HOST and so every call went to 127.0.0.1 inside a serverless
 * function. Nothing anywhere said so.
 *
 * So each miss now reports through `src/lib/degraded.ts`: `[degraded]` on the
 * server log and a `degraded` entry on /api/health. The fallback is unchanged —
 * only its silence is.
 */
function missed(reason: string, meta?: Record<string, unknown>): null {
  reportDegraded("captain-dispatch", reason, {
    host: HOST,
    host_configured: ENV_HOST !== undefined,
    ...meta,
  });
  return null;
}

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
      return missed(`agent host returned ${res.status}`, { status: res.status });
    }
    const j = (await res.json()) as Partial<CaptainDispatchOutput>;
    if (!Array.isArray(j.ranked_unit_ids) || j.ranked_unit_ids.length === 0) {
      return missed("agent host returned no ranking");
    }
    const given = new Set(input.candidates.map(c => c.unit_id));
    const allKnown = j.ranked_unit_ids.every(id => given.has(id));
    if (!allKnown) {
      console.warn("[captain_dispatch] returned unknown unit_id; rejecting");
      return missed("agent host returned an unknown unit_id");
    }
    clearDegraded("captain-dispatch");
    return { ranked_unit_ids: j.ranked_unit_ids, reasoning: j.reasoning ?? "" };
  } catch (err) {
    const e = err as Error;
    console.warn("[captain_dispatch] error", e.message);
    return missed(
      e.name === "AbortError" ? `no answer within ${TIMEOUT_MS}ms` : `unreachable: ${e.message}`
    );
  } finally {
    clearTimeout(t);
  }
}
