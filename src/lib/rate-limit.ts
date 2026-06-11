// In-memory rate limiter — resets on deploy, sufficient for low-traffic admin tool
const hits = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_HITS = 5;

export interface RateLimitOpts {
  windowMs?: number;
  maxHits?: number;
}

export function isRateLimited(key: string, opts: RateLimitOpts = {}): boolean {
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const maxHits = opts.maxHits ?? MAX_HITS;
  const now = Date.now();
  const timestamps = hits.get(key) ?? [];

  // Prune entries outside the window
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxHits) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}
