"use client";
import { useEffect, useState } from "react";
import { geocodeAddress } from "../actions";

export type Place = { label: string; lat: number; lng: number };

export function AddressAutocomplete({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [picked, setPicked] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (picked && q === picked.label) return;
    if (q.trim().length < 3) { setResults([]); return; }
    const handle = setTimeout(async () => {
      const res = await geocodeAddress(q);
      if (res.ok) setResults(res.data); else setError(res.error);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, picked]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPicked(null); }}
        placeholder="Address or landmark…"
        className="w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700"
        required
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {results.length > 0 && !picked && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border bg-white shadow dark:bg-zinc-900 dark:border-zinc-700">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => { setPicked(r); setQ(r.label); setResults([]); onPick(r); }}
                className="block w-full p-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
