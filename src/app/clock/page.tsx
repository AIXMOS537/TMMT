"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClockStatus, clockIn, clockOut, type ClockStatus } from "./actions";

function fmtMins(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ClockPage() {
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => getClockStatus().then(setStatus).catch(() => setError("Couldn't load your status."));
  useEffect(() => { load(); }, []);

  const isIn = !!status?.open;

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = isIn ? await clockOut() : await clockIn();
    if (!res.success) setError(res.error ?? "Something went wrong.");
    await load();
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f4f7ff] dark:bg-slate-900">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Time Clock</p>

          {status === null ? (
            <div className="py-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : (
            <>
              <div className="mt-4 mb-6">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${isIn ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-100 dark:bg-slate-700"}`}>
                  {isIn ? "🟢" : "⚪️"}
                </div>
                <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                  {isIn ? "You're clocked in" : "You're clocked out"}
                </h1>
                {isIn && status.open && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">since {fmtTime(status.open.clock_in)}</p>
                )}
                <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                  Today: <span className="font-semibold">{fmtMins(status.todayMinutes)}</span>
                </p>
              </div>

              <button
                onClick={toggle}
                disabled={busy}
                className={`w-full py-4 rounded-xl text-lg font-bold text-white transition-colors disabled:opacity-50 ${
                  isIn ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {busy ? "…" : isIn ? "Check Out" : "Check In"}
              </button>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

              {status.today.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">Today</p>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-slate-300">
                    {status.today.map((e) => (
                      <li key={e.id} className="flex justify-between">
                        <span>{fmtTime(e.clock_in)} – {e.clock_out ? fmtTime(e.clock_out) : "now"}</span>
                        <span className="text-gray-400">{e.clock_out ? "" : "open"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-gray-400 dark:text-slate-500">
          <Link href="/login" className="hover:underline">Sign in as someone else</Link>
        </p>
      </div>
    </div>
  );
}
