"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createAuditEntry } from "../audit-log";
import { loadCubeState, saveCubeState, subscribeCubeSync } from "../cube/sync";
import { refreshApplicationScores, createInitialState } from "../mock-data";
import { useCubePersistence, useCubePersistenceEnabled } from "./persistence-client";
import type {
  AppState,
  Application,
  ApplicationStatus,
  UserProfile,
  UserRole,
} from "../types";

type AppContextValue = {
  state: AppState;
  applicationId: string | null;
  setUser: (user: Partial<UserProfile>) => void;
  switchRole: (role: UserRole) => void;
  updateApplication: (patch: Partial<Application>) => void;
  transitionStatus: (
    toStatus: ApplicationStatus,
    action: string,
    notes?: string
  ) => void;
  resetDemo: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function CubeProvider({
  children,
  initial,
  defaultRole = "client",
  applicationId = null,
}: {
  children: React.ReactNode;
  initial?: AppState;
  defaultRole?: UserRole;
  applicationId?: string | null;
}) {
  const seed = initial ?? createInitialState(defaultRole);
  const [state, setState] = useState<AppState>(seed);
  const supabaseMode = useCubePersistenceEnabled();

  useEffect(() => {
    if (supabaseMode && applicationId) return;
    const saved = loadCubeState();
    if (saved) setState(saved);
  }, [supabaseMode, applicationId]);

  useEffect(() => {
    if (supabaseMode && applicationId) return;
    return subscribeCubeSync((next) => setState(next));
  }, [supabaseMode, applicationId]);

  useEffect(() => {
    if (supabaseMode && applicationId) return;
    saveCubeState(state);
  }, [state, supabaseMode, applicationId]);

  useCubePersistence(applicationId, state, setState);

  const setUser = useCallback((user: Partial<UserProfile>) => {
    setState((s) => ({ ...s, currentUser: { ...s.currentUser, ...user } }));
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    const names: Record<UserRole, { name: string; email: string }> = {
      client: { name: "Jordan Rivera", email: "jordan@example.com" },
      coach: { name: "Patricia Chen", email: "coach@aixmos.com" },
      admin: { name: "Marcus Webb", email: "admin@aixmos.com" },
      supervisor: { name: "Elena Vasquez", email: "supervisor@aixmos.com" },
    };
    setState((s) => ({
      ...s,
      currentUser: { ...s.currentUser, role, ...names[role] },
    }));
  }, []);

  const updateApplication = useCallback((patch: Partial<Application>) => {
    setState((s) => {
      const merged = refreshApplicationScores({ ...s.application, ...patch });
      return { ...s, application: merged };
    });
  }, []);

  const transitionStatus = useCallback(
    (toStatus: ApplicationStatus, action: string, notes?: string) => {
      setState((s) => {
        const entry = createAuditEntry(s.currentUser.name, s.currentUser.role, action, {
          fromStatus: s.application.status,
          toStatus,
          notes,
        });
        const merged = refreshApplicationScores({
          ...s.application,
          status: toStatus,
          auditLog: [...s.application.auditLog, entry],
        });
        return { ...s, application: merged };
      });
    },
    []
  );

  const resetDemo = useCallback(() => {
    const fresh = createInitialState(defaultRole);
    setState(fresh);
    if (!supabaseMode) saveCubeState(fresh);
  }, [defaultRole, supabaseMode]);

  const value = useMemo(
    () => ({
      state,
      applicationId,
      setUser,
      switchRole,
      updateApplication,
      transitionStatus,
      resetDemo,
    }),
    [state, applicationId, setUser, switchRole, updateApplication, transitionStatus, resetDemo]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useCube() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useCube must be used within CubeProvider");
  return ctx;
}

export const useApp = useCube;
