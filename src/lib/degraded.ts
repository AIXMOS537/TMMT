/**
 * Loud degraded-mode signal (remediation F-18).
 *
 * Two hot paths fall back to a per-process substitute when their durable
 * backend is missing: GHL webhook idempotency (`consumeGhlEventId`, in-memory
 * FIFO instead of `ghl_webhook_events`) and the public rate limiter
 * (`isRateLimitedDurable`, per-process Map instead of the `rate_limit_hit`
 * RPC). Both fallbacks are deliberate — never fail a webhook or a login over
 * observability — but both used to announce themselves with a single
 * `console.warn` per process, which on Vercel is one line lost in a stream
 * that nobody tails. The `rate_limit_hit` RPC is a STAGED migration, so
 * production has been on the rate-limit fallback since F-11 shipped and
 * nothing said so.
 *
 * This module does not change what the fallbacks do. It makes engaging one
 * visible three ways:
 *
 *   1. ONE structured `console.error` line per component per process
 *      (`[degraded] {"component":...,"reason":...,"since":...,"count":...}`),
 *      repeated no more than every DEGRADED_LOG_INTERVAL_MS while the
 *      fallback stays engaged, carrying the running `count`. A hot path
 *      cannot flood the logs; a long-lived process still gets a periodic
 *      reminder with the tally.
 *   2. A Sentry `warning` message on the same cadence, when a DSN is set.
 *      Sentry is loaded lazily and inside try/catch, so a DSN-less
 *      environment or a test never touches it and never throws.
 *   3. `getDegradedComponents()` for `/api/health`, which reports
 *      `degraded: [...]` next to `ok: true` — the status code is unchanged,
 *      the body now says what is running on a substitute.
 *
 * `clearDegraded()` marks a component healthy again when its durable path
 * answers, so health reflects recovery; the log throttle survives the clear,
 * so a flapping backend still cannot produce more than one line per interval.
 */

export type DegradedComponent = "ghl-event-dedupe" | "marketing-kpi-ghl" | "rate-limit";

export interface DegradedRecord {
  component: DegradedComponent;
  /** Why the fallback engaged (the backend's error message, or "no client"). */
  reason: string;
  /** ISO time the current degraded stretch began in this process. */
  since: string;
  /** How many times the fallback has engaged in this process (all stretches). */
  count: number;
  /** ISO time of the most recent engagement. */
  lastSeen: string;
  meta?: Record<string, unknown>;
}

interface DegradedState extends DegradedRecord {
  active: boolean;
  lastLoggedAt: number;
}

/** Minimum gap between two log lines / Sentry messages for one component. */
export const DEGRADED_LOG_INTERVAL_MS = 15 * 60 * 1000;

const state = new Map<DegradedComponent, DegradedState>();
let pendingForward: Promise<void> = Promise.resolve();

/**
 * Record that `component` just fell back to its in-process substitute.
 * Synchronous and never throws; the Sentry forward runs in the background.
 */
export function reportDegraded(
  component: DegradedComponent,
  reason: string,
  meta?: Record<string, unknown>
): void {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let rec = state.get(component);
  if (!rec) {
    rec = {
      component,
      reason,
      since: nowIso,
      count: 0,
      lastSeen: nowIso,
      active: false,
      lastLoggedAt: Number.NEGATIVE_INFINITY,
    };
    state.set(component, rec);
  }
  if (!rec.active) {
    rec.active = true;
    rec.since = nowIso;
  }
  rec.count += 1;
  rec.reason = reason;
  rec.lastSeen = nowIso;
  if (meta) rec.meta = meta;

  if (now - rec.lastLoggedAt < DEGRADED_LOG_INTERVAL_MS) return;
  rec.lastLoggedAt = now;

  const payload = {
    component,
    reason,
    since: rec.since,
    count: rec.count,
    ...(rec.meta ?? {}),
  };
  try {
    console.error(`[degraded] ${JSON.stringify(payload)}`);
  } catch {
    // A logger that throws must not take the request down with it.
  }
  pendingForward = pendingForward
    .then(() => forwardToSentry(component, reason, payload))
    .catch(() => undefined);
}

/**
 * The durable path answered: the component is healthy again. Cheap no-op
 * when it was never degraded, so callers can invoke it on every success.
 */
export function clearDegraded(component: DegradedComponent): void {
  const rec = state.get(component);
  if (rec) rec.active = false;
}

/** Components currently running on a fallback, for `/api/health`. */
export function getDegradedComponents(): DegradedRecord[] {
  const out: DegradedRecord[] = [];
  for (const rec of state.values()) {
    if (!rec.active) continue;
    const { component, reason, since, count, lastSeen, meta } = rec;
    out.push(meta ? { component, reason, since, count, lastSeen, meta } : { component, reason, since, count, lastSeen });
  }
  return out.sort((a, b) => a.component.localeCompare(b.component));
}

async function forwardToSentry(
  component: DegradedComponent,
  reason: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(`degraded: ${component} — ${reason}`, {
      level: "warning",
      tags: { component },
      extra: payload,
    });
  } catch {
    // Sentry missing, not initialised, or unhappy: the console line above is
    // the signal that must survive; this one is best-effort.
  }
}

/** Test-only: forget every record, including the log throttle. */
export function _resetDegradedForTests(): void {
  state.clear();
  pendingForward = Promise.resolve();
}

/** Test-only: resolve once every background Sentry forward has settled. */
export function _flushDegradedForTests(): Promise<void> {
  return pendingForward;
}
