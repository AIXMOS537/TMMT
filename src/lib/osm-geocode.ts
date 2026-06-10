import "server-only";
import { geocodeCache, type GeocodeResult } from "./osm-cache";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
// Nominatim usage policy requires a unique, identifying User-Agent.
const USER_AGENT = "TMMT-Rescue-Dispatch/1.0 (operations@tmmtrentals.com)";

// Per Nominatim's "Acceptable Use Policy" we may not exceed 1 request/second.
// Server-side cache + 250ms client debounce keeps us well under that for a demo.
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];

  const cached = geocodeCache.get(q);
  if (cached) return cached;

  const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(q)}&format=json&addressdetails=0&limit=5&countrycodes=us`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
  });
  if (!res.ok) {
    console.error("[osm-geocode] nominatim failed", res.status);
    return [];
  }
  const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  const out: GeocodeResult[] = rows.map(r => ({
    place_name: r.display_name,
    center: [parseFloat(r.lon), parseFloat(r.lat)], // [lng, lat] to match prior shape
  }));
  geocodeCache.set(q, out);
  return out;
}
