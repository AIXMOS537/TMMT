"use client";
import Link from "next/link";
import type { Incident } from "@/lib/dispatch-types";

const severityBadge: Record<number, string> = {
  1: "bg-rose-600 text-white",
  2: "bg-amber-500 text-white",
  3: "bg-emerald-500 text-white",
};

export function IncidentQueue({ incidents, focusedId, onFocus }: {
  incidents: Incident[];
  focusedId?: string;
  onFocus?: (id: string) => void;
}) {
  if (incidents.length === 0) {
    return <p className="p-4 text-sm text-zinc-500">No active incidents.</p>;
  }
  return (
    <ul className="divide-y dark:divide-zinc-800">
      {incidents.map(i => (
        <li
          key={i.id}
          className={`cursor-pointer p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${focusedId === i.id ? "bg-blue-50 dark:bg-blue-950" : ""}`}
          onClick={() => onFocus?.(i.id)}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-mono text-sm font-bold">{i.ref_code ?? "—"}</span>
              {i.severity != null && (
                <span className={`ml-2 rounded px-2 py-0.5 text-xs ${severityBadge[i.severity]}`}>
                  S{i.severity}
                </span>
              )}
            </div>
            <span className="text-xs uppercase text-zinc-500">{i.status}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{i.location_text}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {new Date(i.reported_at).toLocaleTimeString()}
            </span>
            <Link
              href={`/dispatch/incident/${i.id}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              open →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
