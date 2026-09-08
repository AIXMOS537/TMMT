/**
 * fetch with a deadline (remediation F-19).
 *
 * Every outbound integration call (GHL, Airtable, ClickUp, Telegram, Slack,
 * iMessage relay) used a bare `fetch` with no timeout. On a serverless
 * function that means a slow third party holds the invocation open until the
 * platform kills it — and a webhook handler that is waiting on GHL cannot
 * acknowledge the webhook that woke it. Eight seconds is well inside Vercel's
 * function budget and generous for any of these APIs.
 *
 * Aborts throw FetchTimeoutError so callers can tell "they were slow" from
 * "they said no". The caller's own `signal`, when given, is respected.
 */

export const DEFAULT_OUTBOUND_TIMEOUT_MS = 8_000;

export class FetchTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number
  ) {
    super(`fetch timed out after ${timeoutMs} ms: ${url}`);
    this.name = "FetchTimeoutError";
  }
}

export type FetchWithTimeoutInit = RequestInit & { timeoutMs?: number };

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: FetchWithTimeoutInit = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_OUTBOUND_TIMEOUT_MS, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Honour a caller-supplied signal as well: abort ours when theirs fires.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !(signal?.aborted)) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      throw new FetchTimeoutError(url.replace(/\?.*$/, ""), timeoutMs);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
