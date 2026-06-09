"use client";

import { CubeShell, useCube } from "@aixmos/core";

export function EngineChrome({ children }: { children: React.ReactNode }) {
  const { state, resetDemo, switchRole } = useCube();
  const app = state.application;

  return (
    <CubeShell
      activeFace="learn"
      role={state.currentUser.role}
      applicationId={app.id}
      status={app.status}
      userName={state.currentUser.name}
      onReset={resetDemo}
    >
      <div className="mb-4 flex justify-end">
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          value={state.currentUser.role}
          onChange={(e) => switchRole(e.target.value as typeof state.currentUser.role)}
          aria-label="Demo role (learn face)"
        >
          <option value="client">Client</option>
          <option value="coach">Coach</option>
          <option value="admin">Admin</option>
          <option value="supervisor">Supervisor</option>
        </select>
      </div>
      {children}
    </CubeShell>
  );
}
