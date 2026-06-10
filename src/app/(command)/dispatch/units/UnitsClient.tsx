"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Unit } from "@/lib/dispatch-types";
import { setUnitStatus, setUnitLocation } from "../actions";

export function UnitsClient({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locTarget, setLocTarget] = useState<string | null>(null);
  const [locLat, setLat] = useState("");
  const [locLng, setLng] = useState("");

  return (
    <div className="mt-6 space-y-2">
      {units.map(u => (
        <div key={u.id} className="flex items-center justify-between rounded border p-3 dark:border-zinc-700">
          <div>
            <span className="font-mono font-bold">{u.callsign}</span>
            <span className="ml-2 rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">{u.status}</span>
            {u.current_lat && u.current_lng && (
              <span className="ml-2 text-xs text-zinc-500">
                {u.current_lat.toFixed(4)}, {u.current_lng.toFixed(4)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={u.status}
              disabled={pending || ["assigned","en_route","on_scene"].includes(u.status)}
              onChange={e => start(async () => {
                const r = await setUnitStatus({ unit_id: u.id, status: e.target.value as "off_duty"|"available"|"out_of_service" });
                if (r.ok) router.refresh();
              })}
              className="rounded border px-2 py-1 text-sm dark:bg-zinc-900 dark:border-zinc-700"
            >
              <option value="off_duty">off_duty</option>
              <option value="available">available</option>
              <option value="out_of_service">out_of_service</option>
              {["assigned","en_route","on_scene"].includes(u.status) && <option value={u.status}>{u.status}</option>}
            </select>
            <button onClick={() => setLocTarget(u.id)} className="rounded bg-zinc-200 px-2 py-1 text-sm dark:bg-zinc-700">
              set loc
            </button>
          </div>
        </div>
      ))}
      {locTarget && (
        <div className="rounded border bg-zinc-50 p-3 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="mb-2 text-sm font-medium">Set location for {units.find(u => u.id === locTarget)?.callsign}</p>
          <div className="flex gap-2">
            <input placeholder="lat" value={locLat} onChange={e => setLat(e.target.value)} className="w-32 rounded border p-1" />
            <input placeholder="lng" value={locLng} onChange={e => setLng(e.target.value)} className="w-32 rounded border p-1" />
            <button
              disabled={pending}
              onClick={() => start(async () => {
                const r = await setUnitLocation({ unit_id: locTarget, lat: Number(locLat), lng: Number(locLng) });
                if (r.ok) { setLocTarget(null); setLat(""); setLng(""); router.refresh(); }
              })}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              save
            </button>
            <button onClick={() => setLocTarget(null)} className="px-3 py-1 text-sm">cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
