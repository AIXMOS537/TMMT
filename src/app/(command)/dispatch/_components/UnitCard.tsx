"use client";
import type { Unit } from "@/lib/dispatch-types";

const statusColor: Record<Unit["status"], string> = {
  off_duty: "bg-gray-300 text-gray-800",
  available: "bg-emerald-500 text-white",
  assigned: "bg-amber-500 text-white",
  en_route: "bg-blue-500 text-white",
  on_scene: "bg-violet-500 text-white",
  out_of_service: "bg-rose-500 text-white",
};

export function UnitCard({ unit }: { unit: Unit }) {
  return (
    <div className="rounded-md border bg-white p-2 shadow-sm dark:bg-zinc-900 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold">{unit.callsign}</span>
        <span className={`rounded px-2 py-0.5 text-xs ${statusColor[unit.status]}`}>{unit.status}</span>
      </div>
      {unit.last_ping_at && (
        <p className="mt-1 text-xs text-zinc-500">
          last ping {new Date(unit.last_ping_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
