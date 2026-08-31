"use client";

import { useCallback, useEffect, useState } from "react";
import { outboxClear, outboxPending } from "@/lib/offline/store";

export default function OfflineSyncBar() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const items = await outboxPending();
    setPending(items.length);
  }, []);

  useEffect(() => {
    void refresh();
    const on = () => void refresh();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const t = window.setInterval(() => void refresh(), 8000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.clearInterval(t);
    };
  }, [refresh]);

  async function mergeNow() {
    setBusy(true);
    setMsg(null);
    const items = await outboxPending();
    try {
      const res = await fetch("/api/offline/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ table: i.table, record: i.record })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        merged?: number;
        error?: string;
        needsLink?: boolean;
        errors?: string[];
      };
      if (res.ok && data.ok) {
        await outboxClear(items.map((i) => i.id));
        setMsg(`Merged ${data.merged ?? items.length} records into live TMMT.`);
        await refresh();
      } else {
        setMsg(data.error || data.errors?.[0] || "Merge held. Sign in and get seated on an org.");
      }
    } catch {
      setMsg("Still offline. Your desk is saved on this device.");
    }
    setBusy(false);
  }

  if (pending === 0 && online) return null;

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {online
            ? `${pending} local change${pending === 1 ? "" : "s"} waiting to merge into live TMMT Rentals.`
            : "You are offline. This is the same TMMT Rentals desk — keep filling. We merge when you are back."}
        </p>
        <button
          type="button"
          disabled={busy || !online || pending === 0}
          onClick={() => void mergeNow()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Merging…" : "Merge into live"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs">{msg}</p>}
    </div>
  );
}
