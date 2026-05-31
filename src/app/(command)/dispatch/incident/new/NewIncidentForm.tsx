"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddressAutocomplete, type Place } from "../../_components/AddressAutocomplete";
import { createIncident } from "../../actions";

const CAPABILITIES = [
  "medical_basic","medical_advanced","terrain_offroad","lane_split",
  "water_rescue","hazmat","high_speed","passenger_transport",
] as const;

const CLASSES = ["sport_bike","sport_car","sport_suv","van","truck","helicopter","foot","other"] as const;

export function NewIncidentForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [place, setPlace] = useState<Place | null>(null);
  const [severity, setSeverity] = useState<1|2|3>(2);
  const [caps, setCaps] = useState<string[]>([]);
  const [reqClass, setReqClass] = useState<string>("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place) { setError("Pick an address first."); return; }
    setError(null);
    start(async () => {
      const res = await createIncident({
        org_id: orgId,
        reporter_name: reporterName || undefined,
        reporter_phone: reporterPhone || undefined,
        location_lat: place.lat,
        location_lng: place.lng,
        location_text: place.label,
        description: description || undefined,
        severity,
        required_capabilities: caps,
        required_class: reqClass || null,
      });
      if (!res.ok) setError(res.error);
      else router.push(`/dispatch/incident/${res.data.incident_id}`);
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Location</span>
        <AddressAutocomplete onPick={setPlace} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Severity</span>
        <select value={severity} onChange={e => setSeverity(Number(e.target.value) as 1|2|3)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700">
          <option value={1}>1 — life-critical</option>
          <option value={2}>2 — urgent</option>
          <option value={3}>3 — non-urgent</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Required capabilities</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CAPABILITIES.map(c => (
            <label key={c} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={caps.includes(c)}
                onChange={(e) => setCaps(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))}
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-medium">Required vehicle class (optional)</span>
        <select value={reqClass} onChange={e => setReqClass(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700">
          <option value="">(any)</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Reporter name (optional)</span>
        <input value={reporterName} onChange={e => setReporterName(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Reporter phone (optional)</span>
        <input value={reporterPhone} onChange={e => setReporterPhone(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded border p-2 dark:bg-zinc-900 dark:border-zinc-700" />
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
        {pending ? "Creating…" : "Create + auto-assign"}
      </button>
    </form>
  );
}
