import type { AppState } from "../types";
import { CUBE_BROADCAST_CHANNEL, CUBE_STORAGE_KEY } from "./config";

export function loadCubeState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUBE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
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
        onState(JSON.parse(e.newValue) as AppState);
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
        onState(ev.data.state as AppState);
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
