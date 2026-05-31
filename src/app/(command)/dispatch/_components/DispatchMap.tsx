"use client";
import { useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Incident, Unit } from "@/lib/dispatch-types";

const unitColor: Record<Unit["status"], string> = {
  off_duty: "#9ca3af",
  available: "#10b981",
  assigned: "#f59e0b",
  en_route: "#3b82f6",
  on_scene: "#8b5cf6",
  out_of_service: "#ef4444",
};
const severityColor: Record<number, string> = {
  1: "#dc2626",
  2: "#f59e0b",
  3: "#10b981",
};

export function DispatchMap({ units, incidents, focusedIncidentId, onIncidentClick }: {
  units: Unit[];
  incidents: Incident[];
  focusedIncidentId?: string;
  onIncidentClick?: (id: string) => void;
}) {
  const initialView = useMemo(() => {
    const u = units.find(u => u.current_lat && u.current_lng);
    return {
      longitude: u?.current_lng ?? -118.2437,
      latitude: u?.current_lat ?? 34.0522,
      zoom: 11,
    };
  }, [units]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-600">NEXT_PUBLIC_MAPBOX_TOKEN not set</div>;
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={initialView}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
    >
      <NavigationControl position="top-right" />
      {units.filter(u => u.current_lat && u.current_lng).map(u => (
        <Marker key={u.id} longitude={u.current_lng!} latitude={u.current_lat!} anchor="center">
          <div
            title={`${u.callsign} (${u.status})`}
            className="h-3 w-3 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: unitColor[u.status] }}
          />
        </Marker>
      ))}
      {incidents.filter(i => i.location_lat && i.location_lng).map(i => (
        <Marker key={i.id} longitude={i.location_lng!} latitude={i.location_lat!} anchor="bottom">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIncidentClick?.(i.id); }}
            title={i.ref_code ?? "incident"}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${focusedIncidentId === i.id ? "ring-4 ring-blue-300" : ""}`}
            style={{ backgroundColor: i.severity ? severityColor[i.severity] : "#6b7280", borderColor: "white" }}
          >
            <span className="text-xs font-bold text-white">{i.severity ?? "?"}</span>
          </button>
        </Marker>
      ))}
    </Map>
  );
}
