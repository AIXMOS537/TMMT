"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader, Button, ErrorBanner, selectClass } from "@/components/ui";
import { Camera, Check, AlertTriangle, RefreshCw } from "lucide-react";
import {
  listVehiclesForCapture,
  loadCaptureBoard,
  uploadInspectionPhoto,
  type CaptureBoard,
  type VehicleOption,
} from "./actions";

/**
 * THE WALK-AROUND.
 *
 * Eight fixed angles, shot at a named stage, so a return photo has a pickup
 * photo to be compared against. That pairing is the whole point — a pile of
 * free-form pictures is not evidence, a before/after is.
 *
 * Built because the habit had collapsed: 1 handover record and 1 customer photo
 * against 27 vehicles, while the storage bucket, the table and the policies all
 * sat provisioned and unused. Every damage argument lost starts there.
 *
 * On a phone, each tile opens the camera directly (capture="environment").
 */

const STAGES = [
  { value: "pickup", label: "Handover to renter" },
  { value: "return", label: "Return from renter" },
  { value: "onboarding", label: "Vehicle onboarding" },
  { value: "damage", label: "Damage report" },
] as const;

export default function InspectionCapturePage() {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [stage, setStage] = useState<string>("pickup");
  const [board, setBoard] = useState<CaptureBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAngle, setBusyAngle] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    listVehiclesForCapture()
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) { setError(r.error); return; }
        setVehicles(r.vehicles);
        setVehicleId((cur) => cur || (r.vehicles[0]?.id ?? ""));
      })
      .catch(() => { if (!cancelled) setError("Could not load vehicles."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    loadCaptureBoard(vehicleId, stage)
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) { setError(r.error); setBoard(null); return; }
        setError(null);
        setBoard(r.board);
      })
      .catch(() => { if (!cancelled) setError("Could not load the photo set."); });
    return () => { cancelled = true; };
  }, [vehicleId, stage, reloadKey]);

  const onPick = async (angle: string, file: File | undefined) => {
    if (!file || !vehicleId) return;
    setBusyAngle(angle);
    setError(null);
    const fd = new FormData();
    fd.set("vehicle_id", vehicleId);
    fd.set("stage", stage);
    fd.set("angle", angle);
    fd.set("photo", file);
    const res = await uploadInspectionPhoto(fd);
    setBusyAngle(null);
    if (!res.ok) { setError(res.error); return; }
    refresh();
  };

  const progress = board?.progress;

  return (
    <div>
      <PageHeader
        title="Vehicle walk-around"
        description={
          progress
            ? `${progress.captured.length} of 8 angles · ${progress.complete ? "set complete" : `${progress.missing.length} still to shoot`}`
            : "Eight angles, every time, so a return can be compared to its pickup"
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="cap-vehicle" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Vehicle
          </label>
          <select id="cap-vehicle" className={selectClass} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.length === 0 && <option value="">No vehicles on the board</option>}
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.label}{v.plate ? ` · ${v.plate}` : ""}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label htmlFor="cap-stage" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Stage
          </label>
          <select id="cap-stage" className={selectClass} value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <Button variant="secondary" onClick={refresh}><RefreshCw size={16} />Reload</Button>
      </div>

      {error && <ErrorBanner message={error} />}

      {progress && (
        <div className="mb-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-[width] ${progress.complete ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {!progress.complete && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-500">
              <AlertTriangle size={14} />
              An incomplete set is not evidence. Missing: {progress.missing.map((m) => m.replace(/_/g, " ")).join(", ")}.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {board?.angles.map((a) => {
          const busy = busyAngle === a.angle;
          return (
            <div
              key={a.angle}
              className={`overflow-hidden rounded-lg border bg-white dark:bg-gray-800 ${
                a.url ? "border-green-300 dark:border-green-800" : "border-dashed border-gray-300 dark:border-gray-600"
              }`}
            >
              <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-900">
                {a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={`${a.label} — ${stage}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
                    <Camera size={26} />
                    <span className="text-xs">Not shot yet</span>
                  </div>
                )}
                {a.url && (
                  <span className="absolute right-2 top-2 rounded-full bg-green-600 p-1 text-white">
                    <Check size={12} />
                  </span>
                )}
              </div>

              {stage === "return" && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    At pickup
                  </p>
                  <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-900">
                    {a.beforeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.beforeUrl} alt={`${a.label} — at pickup`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-2 text-center text-xs text-amber-600 dark:text-amber-500">
                        No pickup photo — damage here cannot be attributed
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{a.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{a.hint}</p>
                <input
                  ref={(el) => { inputs.current[a.angle] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { void onPick(a.angle, e.target.files?.[0]); e.target.value = ""; }}
                />
                <Button
                  className="mt-2 w-full"
                  variant={a.url ? "secondary" : "primary"}
                  disabled={busy || !vehicleId}
                  onClick={() => inputs.current[a.angle]?.click()}
                >
                  {busy ? "Uploading…" : a.url ? "Retake" : "Take photo"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {board && stage === "return" && board.pairs && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {board.pairs.filter((p) => p.comparable).length} of 8 angles have both a pickup and a return
          photo. Only those can support a damage claim.
        </p>
      )}
    </div>
  );
}
