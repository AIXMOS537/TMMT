"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, Coins } from "lucide-react";

interface Msg {
  role: "you" | "coach";
  text: string;
}

export default function PocketAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsActivation, setNeedsActivation] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    // Send the last few turns so the coach has continuity (bounded server-side).
    const history = messages.slice(-6).map((m) => ({
      role: m.role === "you" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
    setMessages((m) => [...m, { role: "you", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/pocket/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((m) => [...m, { role: "coach", text: data.reply }]);
        if (typeof data.balance === "number") setBalance(data.balance);
        setUnlimited(Boolean(data.unlimited));
      } else if (res.status === 402) {
        setNeedsActivation(true);
        if (typeof data.balance === "number") setBalance(data.balance);
        setError(data.error || "Activate your membership to keep coaching.");
      } else {
        setError(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[80vh]">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Guidance Coach</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Coins className="h-3.5 w-3.5" />
            {unlimited ? "Unlimited" : balance === null ? "TMMT tokens" : `${balance} TMMT`}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Credit guidance &amp; education. Not credit repair, not a guarantee. Each
          reply uses one TMMT token.
        </p>
      </header>

      <div className="flex-1 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-slate-500">
            Ask anything — build a plan, learn the next step.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              m.role === "you"
                ? "ml-auto bg-blue-600 text-white"
                : "mr-auto bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="mr-auto rounded-2xl px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400">
            coaching…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {needsActivation ? (
        <Link
          href="/pocket"
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Top up / activate membership
        </Link>
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Type your question…"
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 p-2.5 text-white"
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
