"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Button, ErrorBanner, Modal, FormField, inputClass, StatusBadge } from "@/components/ui";
import { CalendarDays, Lock, Ban, AlertTriangle, Check, Plus } from "lucide-react";
import {
  loadBoard,
  placeHold,
  listFleetCandidates,
  addVehicleToBoard,
  type BoardVehicle,
  type FleetCandidate,
} from "./actions";

/**
 * THE RENTAL BOARD — the screen TMMT OS shipped 110 routes without.
 *
 * Answers the one question a fleet operator asks all day: "what can I rent,
 * for these dates, and for how much." Every car appears, including the ones you
 * cannot rent, with the reason attached — a board that hides unavailable cars
 * tells you nothing about why the lot looks empty.
 *
 * It places HOLDS only. Nothing here takes money, sends a message, signs an
 * agreement or releases a car; those route through the owner-approval gate.
 */

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function BookingsBoardPage() {
  const today = useMemo(() => new Date(), []);
  const weekOut = useMemo(() => new Date(today.getTime() + 7 * 86_400_000), [today]);

  const [start, setStart] = useState(isoDay(today));
  const [end, setEnd] = useState(isoDay(weekOut));
  const [rows, setRows] = useState<BoardVehicle[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [holdFor, setHoldFor] = useState<BoardVehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<FleetCandidate[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // State is set only inside the promise callback, never synchronously in the
  // effect body. `cancelled` drops a stale response: without it, a slow read for
  // an earlier date range can land after a faster later one and repaint the
  // board with the wrong window.
  useEffect(() => {
    let cancelled = false;
    loadBoard(`${start}T10:00:00.000Z`, `${end}T10:00:00.000Z`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setRows([]);
        } else {
          setError(null);
          setRows(res.vehicles);
          setDays(res.days);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not read the board.");
        setRows([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [start, end, reloadKey]);

  const free = rows.filter((r) => !r.blocked && r.quote);
  const unpriced = rows.filter((r) => !r.blocked && !r.quote);
  const blocked = rows.filter((r) => r.blocked);

  const submitHold = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!holdFor) return;
    setSaving(true);
    setHoldError(null);
    const fd = new FormData(e.currentTarget);
    const res = await placeHold({
      vehicleId: holdFor.vehicleId,
      startsAtISO: `${start}T10:00:00.000Z`,
      endsAtISO: `${end}T10:00:00.000Z`,
      customerName: String(fd.get("customer_name") ?? ""),
      customerEmail: String(fd.get("customer_email") ?? ""),
      customerPhone: String(fd.get("customer_phone") ?? ""),
    });
    setSaving(false);
    if (!res.ok) {
      setHoldError(res.error);
      return;
    }
    setHoldFor(null);
    setPlaced(res.refCode);
    void refresh();
  };

  return (
    <div>
      <PageHeader
        title="Rental Board"
        description={`${free.length} bookable · ${blocked.length} unavailable · ${days} day${days === 1 ? "" : "s"}`}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setAddOpen(true);
              setAddError(null);
              void listFleetCandidates().then((r) =>
                r.ok ? setCandidates(r.candidates) : setAddError(r.error)
              );
            }}
          >
            <Plus size={16} />
            Put a car on the board
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <label htmlFor="b-start" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Pick up
          </label>
          <input id="b-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="b-end" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Return
          </label>
          <input id="b-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </div>
        <Button onClick={() => void refresh()}>
          <CalendarDays size={16} />
          Check the lot
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      {placed && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <Check size={16} />
          Hold placed — reference <strong className="font-mono">{placed}</strong>. Nothing has been charged.
          <button type="button" onClick={() => setPlaced(null)} className="ml-auto underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Available for these dates
            </h2>
            {free.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Nothing is bookable for this window.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {free.map((v) => (
                  <div key={v.vehicleId} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{v.label}</p>
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{v.tier}</p>
                      </div>
                      <StatusBadge status={v.fleetStatus ?? "Unknown"} />
                    </div>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Weekly</dt>
                        <dd className="font-medium tabular-nums text-gray-900 dark:text-white">{money(v.quote!.weeklyCents)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Deposit</dt>
                        <dd className="tabular-nums text-gray-700 dark:text-gray-300">{money(v.quote!.depositCents)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-gray-100 pt-1 dark:border-gray-700">
                        <dt className="text-gray-500 dark:text-gray-400">Due at pickup</dt>
                        <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">{money(v.quote!.dueNowCents)}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      {v.quote!.rateSource === "fleet_posted" ? "Car's own posted rate" : "Tier rate card"}
                      {v.floorWeekly ? ` · floor $${v.floorWeekly}/wk` : " · no floor set"}
                    </p>
                    <Button className="mt-3 w-full" onClick={() => { setHoldFor(v); setHoldError(null); }}>
                      Place hold
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {unpriced.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                <AlertTriangle size={14} /> Free, but cannot be priced
              </h2>
              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                {unpriced.map((v) => (
                  <li key={v.vehicleId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{v.label}</span>
                    <span className="text-xs text-amber-700 dark:text-amber-400">{v.priceProblem}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {blocked.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Lock size={14} /> Not available for these dates
              </h2>
              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                {blocked.map((v) => (
                  <li key={v.vehicleId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{v.label}</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Ban size={12} />
                      {v.blocked?.reason === "conflict"
                        ? `Already booked (${v.blocked.conflictingBookingIds.length})`
                        : v.blocked?.reason === "vehicle_not_bookable"
                          ? v.blocked.fleetStatus ?? "No status set"
                          : "Invalid dates"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Modal
        open={holdFor !== null}
        onClose={() => { setHoldFor(null); setHoldError(null); setSaving(false); }}
        title={holdFor ? `Hold — ${holdFor.label}` : "Hold"}
      >
        <form onSubmit={submitHold} className="space-y-4">
          {holdError && <ErrorBanner message={holdError} />}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {start} → {end} · {money(holdFor?.quote?.dueNowCents ?? 0)} due at pickup.
            This places a hold only. No card is charged and no message is sent.
          </p>
          <FormField label="Renter name" required>
            <input name="customer_name" required className={inputClass} />
          </FormField>
          <FormField label="Renter email" required>
            <input name="customer_email" type="email" required className={inputClass} />
          </FormField>
          <FormField label="Phone">
            <input name="customer_phone" className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setHoldFor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Holding…" : "Place hold"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddError(null); setAdding(false); }}
        title="Put a car on the board"
      >
        <div className="space-y-4">
          {addError && <ErrorBanner message={addError} />}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A car has to be on the board before it can be booked. Pick its tier — that decides which
            rate card row it can match and which coverage it is sold, so it is a pricing call, not a
            data-entry one. The car keeps its own posted weekly price either way.
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Every fleet car is already on the board.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {candidates.map((c) => (
                <li key={c.fleetId} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{c.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.vehicleStatus ?? "No status"} ·{" "}
                      {c.postedWeekly ? `$${c.postedWeekly}/wk` : "no posted price"}
                      {c.floorWeekly ? ` · floor $${c.floorWeekly}` : ""}
                    </p>
                  </div>
                  {c.postedWeekly ? (
                    <div className="flex gap-1">
                      {(["economy", "mid", "luxury"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={adding}
                          onClick={async () => {
                            setAdding(true);
                            setAddError(null);
                            const res = await addVehicleToBoard({ fleetId: c.fleetId, tier: t });
                            setAdding(false);
                            if (!res.ok) { setAddError(res.error); return; }
                            setCandidates((list) => list.filter((x) => x.fleetId !== c.fleetId));
                            refresh();
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs capitalize text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-500">Price it first</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
