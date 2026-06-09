"use client";
import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

function unitIcon(status: Unit["status"]) {
  const color = unitColor[status];
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function incidentIcon(severity: number | null, focused: boolean) {
  const color = severity ? severityColor[severity] : "#6b7280";
  const ring = focused ? "box-shadow:0 0 0 4px rgba(59,130,246,0.4);" : "";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};${ring}width:24px;height:24px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;font-family:ui-monospace,monospace;">${severity ?? "?"}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

export default function DispatchMap({ units, incidents, focusedIncidentId, onIncidentClick }: {
  units: Unit[];
  incidents: Incident[];
  focusedIncidentId?: string;
  onIncidentClick?: (id: string) => void;
}) {
  const center = useMemo<[number, number]>(() => {
    const u = units.find(u => u.current_lat && u.current_lng);
    return [u?.current_lat ?? 34.0522, u?.current_lng ?? -118.2437];
  }, [units]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {units.filter(u => u.current_lat && u.current_lng).map(u => (
        <Marker
          key={u.id}
          position={[u.current_lat!, u.current_lng!]}
          icon={unitIcon(u.status)}
        >
          <Popup>
            <div style={{ fontFamily: "ui-monospace,monospace" }}>
              <strong>{u.callsign}</strong>
              <br />
              <span style={{ color: unitColor[u.status] }}>{u.status}</span>
            </div>
          </Popup>
        </Marker>
      ))}
      {incidents.filter(i => i.location_lat && i.location_lng).map(i => (
        <Marker
          key={i.id}
          position={[i.location_lat!, i.location_lng!]}
          icon={incidentIcon(i.severity, focusedIncidentId === i.id)}
          eventHandlers={{ click: () => onIncidentClick?.(i.id) }}
        >
          <Popup>
            <div>
              <strong>{i.ref_code ?? "incident"}</strong>
              <br />
              S{i.severity} · {i.status}
              <br />
              {i.location_text}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
