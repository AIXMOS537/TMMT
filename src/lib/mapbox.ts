import "server-only";
import { geocodeCache, type MapboxGeocodeResult } from "./mapbox-cache";

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function searchAddress(query: string): Promise<MapboxGeocodeResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];

  const cached = geocodeCache.get(q);
  if (cached) return cached;

  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new Error("MAPBOX_TOKEN not configured");

  const url = `${MAPBOX_BASE}/${encodeURIComponent(q)}.json?access_token=${token}&autocomplete=true&limit=5&country=US`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    console.error("[mapbox] geocode failed", res.status);
    return [];
  }
  const j = (await res.json()) as { features?: Array<{ place_name: string; center: [number, number] }> };
  const out: MapboxGeocodeResult[] = (j.features ?? []).map(f => ({
    place_name: f.place_name,
    center: f.center,
  }));
  geocodeCache.set(q, out);
  return out;
}
