"use client";
import { useEffect, useState, useTransition } from "react";
import type { Candidate, IncidentAssignment } from "@/lib/dispatch-types";
import { overrideAssignment } from "../actions";

export function OverridePanel({
  assignment, incidentId, onChanged,
}: {
  assignment: IncidentAssignment;
  incidentId: string;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState<number>(() => secondsRemaining(assignment.created_at));
  const candidates = assignment.reasoning_json?.candidates ?? [];

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft(secondsRemaining(assignment.created_at)), 250);
    return () => clearInterval(t);
  }, [assignment.created_at]);

  if (secondsLeft <= 0 || assignment.effective_status === "locked") {
    return (
      <div className="rounded border bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        Assignment locked.
      </div>
    );
  }

  const submit = () => {
    if (!chosen || reason.trim().length === 0) {
      setError("Pick a unit and write a brief reason.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await overrideAssignment({
        incident_id: incidentId,
        current_assignment_id: assignment.id,
        chosen_unit_id: chosen,
        reason: reason.trim(),
      });
      if (!res.ok) setError(res.error);
      else onChanged();
    });
  };

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Override window</h3>
        <span className="font-mono text-2xl text-amber-700 dark:text-amber-300">{secondsLeft}s</span>
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        System chose <strong className="font-mono">{assignment.unit_id.slice(0, 8)}</strong>. Pick a different unit within {secondsLeft}s.
      </p>
      <ul className="mt-3 space-y-2">
        {candidates.slice(0, 3).map((c: Candidate) => {
          const isCurrent = c.unit_id === assignment.unit_id;
          return (
            <li key={c.unit_id} className={`flex items-center justify-between rounded border bg-white p-2 dark:bg-zinc-900 ${chosen === c.unit_id ? "border-blue-500" : ""}`}>
              <div>
                <div className="font-mono text-sm font-bold">{c.callsign}</div>
                <div className="text-xs text-zinc-500">
                  {c.distance_km.toFixed(1)}km · match {c.capability_match_score} · ETA ~{Math.round(c.eta_seconds / 60)}min
                </div>
              </div>
              {isCurrent ? (
                <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">current</span>
              ) : (
                <button
                  onClick={() => setChosen(c.unit_id)}
                  className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                >
                  reassign
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {candidates.length > 3 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">+{candidates.length - 3} more</summary>
          <ul className="mt-2 space-y-1">
            {candidates.slice(3).map((c: Candidate) => (
              <li key={c.unit_id}>
                <button onClick={() => setChosen(c.unit_id)} className="text-blue-600 hover:underline">
                  {c.callsign} ({c.distance_km.toFixed(1)}km, match {c.capability_match_score})
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Why are you overriding? (logged for learning)"
        className="mt-3 w-full rounded border p-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
        rows={2}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <button
        disabled={pending || !chosen || reason.trim().length === 0}
        onClick={submit}
        className="mt-2 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Reassigning…" : "Confirm override"}
      </button>
    </div>
  );
}

function secondsRemaining(createdAtIso: string): number {
  const elapsed = (Date.now() - new Date(createdAtIso).getTime()) / 1000;
  return Math.max(0, Math.ceil(30 - elapsed));
}
