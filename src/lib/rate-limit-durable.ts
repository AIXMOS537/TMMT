/**
 * Durable rate limiting for serverless (remediation F-11).
 *
 * src/lib/rate-limit.ts keeps hits in a per-process Map. On Vercel every
 * cold start and every parallel instance has its own empty map, so a burst
 * that fans out across instances is never limited and the count resets on
 * each deploy. It remains the right tool for the Edge middleware (no database
 * round-trip on every request) and the fallback here.
 *
 * This variant asks Postgres first: `rate_limit_hit(p_key, p_window_ms,
 * p_max_hits)` (staged migration 20260908000100, owner-gated) does one atomic
 * upsert and returns true when the caller is over the limit. Until that
 * function exists, or if the database is unreachable, the in-memory limiter
 * answers instead — today's behaviour, never worse.
 *
 * Every fall-back is reported through `reportDegraded` (F-18): one structured
 * error line per process per interval, a Sentry warning when a DSN is set,
 * and a `degraded` entry on /api/health. The RPC is still STAGED, so until
 * the owner applies it production runs on the fallback — and now says so.
 */
import { isRateLimited, type RateLimitOpts } from "@/lib/rate-limit";
import { clearDegraded, reportDegraded } from "@/lib/degraded";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_HITS = 5;

/** The slice of a Supabase client this needs; kept narrow so tests can hand in a double. */
export type RateLimitBackend = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export async function isRateLimitedDurable(
  key: string,
  opts: RateLimitOpts = {},
  db?: RateLimitBackend | null
): Promise<boolean> {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const maxHits = opts.maxHits ?? MAX_HITS;

  if (db) {
    try {
      const { data, error } = await db.rpc("rate_limit_hit", {
        p_key: key,
        p_window_ms: windowMs,
        p_max_hits: maxHits,
      });
      if (!error && typeof data === "boolean") {
        clearDegraded("rate-limit");
        return data;
      }
      reportDegraded(
        "rate-limit",
        error ? error.message : `rate_limit_hit returned ${typeof data}, expected boolean`,
        error?.code ? { code: error.code } : undefined
      );
    } catch (e) {
      reportDegraded("rate-limit", (e as Error).message);
    }
  } else {
    reportDegraded("rate-limit", "no service-role client; in-memory limiter only");
  }
  return isRateLimited(key, { windowMs, maxHits });
}

/**
 * Test hook: forget that the backend was reported missing. Kept for the
 * existing tests; the state now lives in `@/lib/degraded`.
 */
export function _resetDurableWarning(): void {
  clearDegraded("rate-limit");
}
