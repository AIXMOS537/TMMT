"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Incident, IncidentAssignment } from "@/lib/dispatch-types";
import { OverridePanel } from "../../_components/OverridePanel";
import { StatusTransitionBar } from "../../_components/StatusTransitionBar";

export function IncidentDetailClient({ initialIncident, initialAssignments }: {
  initialIncident: Incident;
  initialAssignments: IncidentAssignment[];
}) {
  const router = useRouter();
  const [incident] = useState(initialIncident);
  const [assignments] = useState(initialAssignments);

  useEffect(() => {
    const pending = assignments.find(a => a.effective_status === "pending");
    if (!pending) return;
    const id = setInterval(() => router.refresh(), 1000);
    return () => clearInterval(id);
  }, [assignments, router]);

  const active = [...assignments].reverse().find(a => a.status !== "cancelled");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="font-mono text-2xl">{incident.ref_code}</h1>
        <p className="text-sm text-zinc-500">
          {incident.location_text} · S{incident.severity} · {incident.status}
        </p>
      </header>

      {incident.description && <p className="rounded bg-zinc-50 p-3 text-sm dark:bg-zinc-900">{incident.description}</p>}

      {active?.effective_status === "pending" && (
        <OverridePanel
          assignment={active}
          incidentId={incident.id}
          onChanged={() => router.refresh()}
        />
      )}

      {active?.effective_status === "locked" && (
        <div className="rounded border bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm">
            Locked to unit <span className="font-mono">{active.unit_id.slice(0,8)}</span>
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Next step</h2>
        <StatusTransitionBar incidentId={incident.id} current={incident.status} onChanged={() => router.refresh()} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Assignment history</h2>
        <ul className="space-y-1 text-sm">
          {assignments.map(a => (
            <li key={a.id} className="rounded border p-2 dark:border-zinc-700">
              <span className="font-mono">{a.unit_id.slice(0,8)}</span>
              {" · "}{a.assigned_by_kind}
              {" · "}{a.effective_status ?? a.status}
              {" · "}{new Date(a.created_at).toLocaleTimeString()}
              {a.reasoning_json?.override_reason && (
                <div className="mt-1 text-xs italic text-zinc-500">&quot;{a.reasoning_json.override_reason}&quot;</div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
