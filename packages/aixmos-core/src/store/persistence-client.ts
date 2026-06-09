"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import type { AppState } from "../types";
import { subscribeProgramApplication } from "../db/realtime";

export function isCubePersistenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CUBE_PERSISTENCE === "supabase";
}

export function useCubePersistence(
  applicationId: string | null,
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (!isCubePersistenceEnabled() || !applicationId) return;

    let cancelled = false;
    hydrated.current = false;

    (async () => {
      try {
        const res = await fetch(`/api/cube/application?id=${encodeURIComponent(applicationId)}`);
        if (res.ok) {
          const data = (await res.json()) as AppState;
          if (!cancelled && data?.application) {
            skipNextSave.current = true;
            setState(data);
          }
        }
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId, setState]);

  useEffect(() => {
    if (!isCubePersistenceEnabled() || !applicationId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    return subscribeProgramApplication(supabase, applicationId, (application) => {
      skipNextSave.current = true;
      setState((prev) => ({ ...prev, application }));
    });
  }, [applicationId, setState]);

  useEffect(() => {
    if (!isCubePersistenceEnabled() || !applicationId) return;
    if (!hydrated.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/cube/application", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [applicationId, state]);
}
