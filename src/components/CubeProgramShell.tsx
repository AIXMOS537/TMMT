"use client";

import { CubeShell, useCube } from "@aixmos/core";
import { CubeApplicationProvider } from "@/components/CubeApplicationProvider";
import { CUBE_DEMO_CONTROLS } from "@/lib/cube-demo-controls";

function ProgramInner({ children }: { children: React.ReactNode }) {
  const { state, resetDemo, switchRole } = useCube();

  return (
    <CubeShell
      activeFace="work"
      role={state.currentUser.role}
      applicationId={state.application.id}
      status={state.application.status}
      userName={state.currentUser.name}
      onReset={CUBE_DEMO_CONTROLS ? resetDemo : undefined}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Workforce face — reviews sync to the Learn face via shared cube state.
        </p>
        {CUBE_DEMO_CONTROLS && (
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
            value={state.currentUser.role}
            onChange={(e) => switchRole(e.target.value as typeof state.currentUser.role)}
            aria-label="Demo staff role"
          >
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="client">Client (preview)</option>
          </select>
        )}
      </div>
      {children}
    </CubeShell>
  );
}

export function CubeProgramShell({ children }: { children: React.ReactNode }) {
  return (
    <CubeApplicationProvider defaultRole="coach">
      <ProgramInner>{children}</ProgramInner>
    </CubeApplicationProvider>
  );
}
