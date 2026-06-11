// In-memory rate limiter, per-lambda. Caveats worth understanding before
// raising the limits or moving to a different backend:
//
// 1. Resets on cold start. Each Vercel lambda instance has its own Map; under
//    autoscale, the effective limit is roughly `maxHits × instance_count`
//    per window. Acceptable for low-traffic admin paths. For routes that
//    actually need distributed limiting, swap in Vercel KV / Upstash before
//    relying on it for abuse mitigation.
// 2. Sweeps stale keys opportunistically (every Nth call) so one-shot
//    abusers do not hold memory between cold starts.
const hits = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_HITS = 5;

const SWEEP_EVERY = 100;
let callsSinceSweep = 0;

export interface RateLimitOpts {
  windowMs?: number;
  maxHits?: number;
}

function sweep(now: number): void {
  // Use the longest known window (the function-default) as the floor for stale.
  // Custom shorter windows still benefit; longer custom windows would over-prune
  // but no caller currently exceeds the 1-hour default.
  for (const [key, ts] of hits) {
    const newest = ts.length === 0 ? 0 : ts[ts.length - 1];
    if (now - newest >= WINDOW_MS) hits.delete(key);
  }
}

export function isRateLimited(key: string, opts: RateLimitOpts = {}): boolean {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const maxHits = opts.maxHits ?? MAX_HITS;
  const now = Date.now();

  callsSinceSweep++;
  if (callsSinceSweep >= SWEEP_EVERY) {
    callsSinceSweep = 0;
    sweep(now);
  }

  const timestamps = hits.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxHits) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}
