"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncidentStatus } from "@/lib/dispatch-types";
import { transitionStatus } from "../actions";

const NEXT: Partial<Record<IncidentStatus, IncidentStatus[]>> = {
  assigned: ["en_route","cancelled"],
  en_route: ["on_scene","cancelled"],
  on_scene: ["cleared","cancelled"],
  cleared: ["closed"],
};

/**
 * onChanged is optional, and it has to be.
 *
 * /dispatch/me is an async server component, and it was passing
 * `onChanged={() => {}}` straight into this client component. A function cannot
 * cross the server/client boundary — React throws on the attempt. The page has
 * an early return for "no active assignment", so the empty state rendered fine
 * and the crash only arrived the moment a responder was actually dispatched:
 * the one time the screen matters.
 *
 * Refreshing after a transition is what every caller wants anyway, so it is the
 * default. IncidentDetailClient still passes its own handler; the server page
 * now passes nothing.
 */
export function StatusTransitionBar({ incidentId, current, onChanged }: {
  incidentId: string;
  current: IncidentStatus;
  onChanged?: () => void;
}) {
  const router = useRouter();
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
            if (r.ok) {
              if (onChanged) onChanged();
              else router.refresh();
            }
          })}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          → {(s as string).replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
