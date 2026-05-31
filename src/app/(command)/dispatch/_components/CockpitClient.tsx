"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { DispatchMap } from "./DispatchMap";
import { IncidentQueue } from "./IncidentQueue";
import type { Incident, Unit } from "@/lib/dispatch-types";
import { lockExpiredAssignments } from "../actions";
import { createBrowserClient } from "@supabase/ssr";

type RowEvent<T> = { eventType: string; new: T; old: { id?: string } };

export function CockpitClient({ orgId, initialIncidents, initialUnits }: {
  orgId: string;
  initialIncidents: Incident[];
  initialUnits: Unit[];
}) {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [units, setUnits] = useState(initialUnits);
  const [focused, setFocused] = useState<string | undefined>();
  const [, start] = useTransition();

  useEffect(() => {
    const tick = () => start(() => void lockExpiredAssignments(orgId));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [orgId]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const ch = supabase.channel(`dispatch:${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `org_id=eq.${orgId}` },
        (payload) => setIncidents(prev => mergeRow(prev, payload as unknown as RowEvent<Incident>)))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "units", filter: `org_id=eq.${orgId}` },
        (payload) => setUnits(prev => mergeRow(prev, payload as unknown as RowEvent<Unit>)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]);

  return (
    <div className="grid h-full grid-cols-[1fr_360px]">
      <div className="relative">
        <DispatchMap units={units} incidents={incidents} focusedIncidentId={focused} onIncidentClick={setFocused} />
      </div>
      <aside className="flex flex-col border-l bg-white dark:bg-zinc-950 dark:border-zinc-800">
        <header className="flex items-center justify-between border-b p-3 dark:border-zinc-800">
          <h2 className="font-semibold">Active queue</h2>
          <Link href="/dispatch/incident/new" className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
            + New incident
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto">
          <IncidentQueue incidents={incidents} focusedId={focused} onFocus={setFocused} />
        </div>
      </aside>
    </div>
  );
}

function mergeRow<T extends { id: string }>(prev: T[], payload: RowEvent<T>): T[] {
  if (payload.eventType === "DELETE") return prev.filter(r => r.id !== payload.old.id);
  const idx = prev.findIndex(r => r.id === payload.new.id);
  if (idx === -1) return [payload.new, ...prev];
  const next = prev.slice();
  next[idx] = payload.new;
  return next;
}
