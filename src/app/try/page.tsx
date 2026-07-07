"use client"

/**
 * /try — Public, SANDBOXED demo of the AIXMOS engine ("the genie").
 *
 * SAFETY (lead-cyber gate): this page is 100% client-side and scripted.
 * - NO Supabase, NO API keys, NO real engine, NO real data, NO network writes.
 * - Every response below is canned. Nothing here touches owner assets.
 * The only outbound action is a link into the existing $97 funnel (/lp/moe-legacy/intro-97).
 *
 * Compliance: sells the TOOL/experience, never a credit outcome. See the disclaimer footer.
 */

import { useState } from "react"
import Link from "next/link"
import { Sparkles, ArrowRight, Wand2, Loader2, ShieldCheck } from "lucide-react"

type Demo = { label: string; prompt: string; render: () => React.ReactNode }

const card = "rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"

const PRESETS: Demo[] = [
  {
    label: "Plan my week",
    prompt: "Build me a 7-day plan to launch my side business",
    render: () => (
      <ol className="space-y-2 text-sm">
        {[
          "Day 1 — Pick one offer and one audience. Write it in a sentence.",
          "Day 2 — Set up your free booking link + a simple intake form.",
          "Day 3 — Film 3 short videos showing the work, not talking about it.",
          "Day 4 — Post daily. Reply to every comment within an hour.",
          "Day 5 — DM 10 people who engaged. Offer the first call free.",
          "Day 6 — Deliver one result. Screenshot it (with permission).",
          "Day 7 — Turn that result into your next 3 posts. Repeat.",
        ].map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-semibold text-violet-600 dark:text-violet-400">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    label: "Write my hooks",
    prompt: "Give me 3 TikTok hooks for my business",
    render: () => (
      <ul className="space-y-2 text-sm">
        {[
          '"I typed one sentence and watched it build my whole day."',
          '"Everybody sells courses. Nobody shows the tool. So here’s the tool."',
          '"Me doing this by hand: 3 hours. Me asking once: 12 seconds."',
        ].map((s, i) => (
          <li key={i} className={`${card} p-3`}>{s}</li>
        ))}
      </ul>
    ),
  },
  {
    label: "Get me organized",
    prompt: "What should I do first to get organized?",
    render: () => (
      <ul className="space-y-2 text-sm">
        {[
          "One inbox for everything — texts, DMs, email, all in one place.",
          "One list of people who owe you a reply. Clear it daily.",
          "One number you check every morning: money in, money out.",
          "One hour, same time each day, for the work that actually pays.",
        ].map((s, i) => (
          <li key={i} className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    ),
  },
]

function genericResult(prompt: string): React.ReactNode {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-zinc-600 dark:text-zinc-300">Here&rsquo;s how I&rsquo;d approach that:</p>
      <ol className="space-y-1.5">
        <li>1. Break &ldquo;{prompt.trim().slice(0, 80)}&rdquo; into the single next action.</li>
        <li>2. Do that one thing today — small and done beats big and someday.</li>
        <li>3. Show the result publicly. Let the proof do the selling.</li>
      </ol>
      <p className="pt-1 text-xs text-zinc-500">
        ☝️ This is a scripted preview. The live engine answers anything, in your voice, on your data.
      </p>
    </div>
  )
}

export default function TryGeniePage() {
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<React.ReactNode | null>(null)

  function run(prompt: string, render?: () => React.ReactNode) {
    setInput(prompt)
    setResult(null)
    setThinking(true)
    // purely cosmetic delay — no network call happens
    setTimeout(() => {
      setResult(render ? render() : genericResult(prompt))
      setThinking(false)
    }, 850)
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      {/* Honesty badge */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
        <Sparkles className="h-3.5 w-3.5" /> Live demo · sample data · no sign-up
      </div>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Stop being told. <span className="text-violet-600 dark:text-violet-400">Get shown.</span>
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Give the genie a command. Watch it work — right here, free, no card.
        This is a taste of the real engine.
      </p>

      {/* Input */}
      <div className={`${card} mt-6 p-3`}>
        <label htmlFor="cmd" className="sr-only">Your command</label>
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 shrink-0 text-violet-500" />
          <input
            id="cmd"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) run(input) }}
            placeholder="Type anything… or tap a button below"
            className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          <button
            onClick={() => input.trim() && run(input)}
            disabled={!input.trim() || thinking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => run(p.prompt, p.render)}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Result */}
      {(thinking || result) && (
        <div className={`${card} mt-6 p-5`}>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <Sparkles className="h-4 w-4" /> The genie
          </div>
          {thinking ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> working…
            </div>
          ) : (
            result
          )}
        </div>
      )}

      {/* Conversion CTA → existing $97 funnel */}
      <div className="mt-8 rounded-2xl bg-zinc-900 p-6 text-white dark:bg-white dark:text-zinc-900">
        <h2 className="text-xl font-bold">Want your own genie?</h2>
        <p className="mt-1 text-sm opacity-80">
          Learn the system, earn with it, keep it. Starts at $97/mo. No $5k guru tax.
        </p>
        <Link
          href="/lp/moe-legacy/intro-97"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Get started — $97/mo <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Compliance disclaimer (CROA/FTC-safe) */}
      <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-400">
        Educational tools &amp; software access from AIXMOS Credit. This is a product demo with sample data,
        not credit repair, and not financial or legal advice. Results vary. By AIXMOS Credit.
      </p>
    </main>
  )
}
