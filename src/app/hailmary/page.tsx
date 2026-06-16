"use client";

import { useEffect, useState } from "react";

/**
 * HAILMARY universal web console — open this URL on ANY device with a browser
 * (phone, laptop, Fire Stick, PlayStation, smart TV) over Tailscale. It talks to
 * the shared brain via /api/hailmary, so every device stays in sync. Big,
 * D-pad-friendly controls for TV/console remotes. Token is stored locally on the
 * device (never sent anywhere but the brain).
 */
export default function HailmaryConsole() {
  const [token, setToken] = useState("");
  const [node, setNode] = useState("web");
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("hm_token") || "");
    setNode(localStorage.getItem("hm_node") || "web");
  }, []);

  function persist() {
    localStorage.setItem("hm_token", token);
    localStorage.setItem("hm_node", node || "web");
  }

  async function call(op: "ask" | "recall" | "remember") {
    if (!token) {
      setOut("Set your access token first.");
      return;
    }
    persist();
    setBusy(true);
    setOut("…");
    try {
      const res = await fetch("/api/hailmary", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(
          op === "remember"
            ? { op, text: input, node }
            : { op, query: input, node }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setOut(`Error ${res.status}: ${data?.error ?? "request failed"}`);
      } else if (op === "ask") {
        setOut(`${data.text || "(no model reachable)"}\n\n— via ${data.backend} —`);
      } else if (op === "recall") {
        const facts = (data.facts || []).map((f: { fact: string }) => `• ${f.fact}`).join("\n");
        const events = (data.events || [])
          .map((e: { summary: string }) => `· ${e.summary}`)
          .join("\n");
        setOut([facts, events].filter(Boolean).join("\n\n") || "(nothing found)");
      } else {
        setOut(data.ok ? "Saved to the brain ✓" : "Save failed");
      }
    } catch (e) {
      setOut(`Network error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-xl px-6 py-4 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-400 disabled:opacity-50";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-5">
        <h1 className="text-3xl font-bold text-center">🐺 HAILMARY</h1>
        <p className="text-center text-neutral-400 text-sm">
          Your assistant on every device — synced through one brain.
        </p>

        <details className="rounded-lg bg-neutral-900 p-4">
          <summary className="cursor-pointer text-neutral-300">Device setup</summary>
          <div className="mt-3 space-y-3">
            <input
              className="w-full rounded-lg bg-neutral-800 px-4 py-3"
              placeholder="Access token (MEMORY_API_TOKEN)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <input
              className="w-full rounded-lg bg-neutral-800 px-4 py-3"
              placeholder="Device name (e.g. firestick, ps5, living-room)"
              value={node}
              onChange={(e) => setNode(e.target.value)}
            />
            <button className={`${btn} bg-neutral-700 w-full`} onClick={persist}>
              Save on this device
            </button>
          </div>
        </details>

        <textarea
          className="w-full rounded-xl bg-neutral-800 px-4 py-4 text-lg min-h-28"
          placeholder="Ask HAILMARY, recall, or jot a note…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <button disabled={busy} className={`${btn} bg-emerald-600`} onClick={() => call("ask")}>
            Ask
          </button>
          <button disabled={busy} className={`${btn} bg-sky-700`} onClick={() => call("recall")}>
            Recall
          </button>
          <button disabled={busy} className={`${btn} bg-amber-700`} onClick={() => call("remember")}>
            Remember
          </button>
        </div>

        <pre className="whitespace-pre-wrap rounded-xl bg-neutral-900 p-4 text-base min-h-32">
          {out}
        </pre>
      </div>
    </main>
  );
}
