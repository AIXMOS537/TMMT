"use client";
import { useTransition } from "react";
import type { IncidentStatus } from "@/lib/dispatch-types";
import { transitionStatus } from "../actions";

const NEXT: Partial<Record<IncidentStatus, IncidentStatus[]>> = {
  assigned: ["en_route","cancelled"],
  en_route: ["on_scene","cancelled"],
  on_scene: ["cleared","cancelled"],
  cleared: ["closed"],
};

export function StatusTransitionBar({ incidentId, current, onChanged }: {
  incidentId: string;
  current: IncidentStatus;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const options = NEXT[current] ?? [];
  if (options.length === 0) {
    return <p className="text-sm text-zinc-500">No further transitions.</p>;
  }
  return (
    <div className="flex gap-2">
      {options.map(s => (
        <button
          key={s}
          disabled={pending}
          onClick={() => start(async () => {
            const r = await transitionStatus({ incident_id: incidentId, to_status: s });
            if (r.ok) onChanged();
          })}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          → {(s as string).replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
