import type { AppState, Application } from "../types";
import { createInitialState } from "../mock-data";
import { CUBE_BROADCAST_CHANNEL, CUBE_STORAGE_KEY } from "./config";

/**
 * Backfill any loaded/partial cube state onto a fresh full state, so the
 * application object and its array fields can NEVER be undefined — even if an
 * older or partial payload was persisted before the schema changed. This is
 * what keeps the Learn/Work faces from crashing on stale localStorage data.
 */
export function normalizeCubeState(raw: unknown): AppState {
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AppState>;
  const app = (r.application ?? {}) as Partial<Application>;
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  return {
    ...base,
    ...r,
    currentUser: { ...base.currentUser, ...(r.currentUser ?? {}) },
    application: {
      ...base.application,
      ...app,
      readiness: arr(app.readiness, base.application.readiness),
      auditLog: arr(app.auditLog, base.application.auditLog),
      documents: arr(app.documents, base.application.documents),
      coachingInsights: arr(app.coachingInsights, base.application.coachingInsights),
      productMatches: arr(app.productMatches, base.application.productMatches),
    },
  };
}

export function loadCubeState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUBE_STORAGE_KEY);
    return raw ? normalizeCubeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveCubeState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUBE_STORAGE_KEY, JSON.stringify(state));
  try {
    const channel = new BroadcastChannel(CUBE_BROADCAST_CHANNEL);
    channel.postMessage({ type: "state", state });
    channel.close();
  } catch {
    /* BroadcastChannel unavailable */
  }
}

export function subscribeCubeSync(onState: (state: AppState) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === CUBE_STORAGE_KEY && e.newValue) {
      try {
        onState(normalizeCubeState(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    }
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CUBE_BROADCAST_CHANNEL);
    channel.onmessage = (ev) => {
      if (ev.data?.type === "state" && ev.data.state) {
        onState(normalizeCubeState(ev.data.state));
      }
    };
  } catch {
    /* ignore */
  }

  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}
