'use client'

import { useState, useTransition } from 'react'
import { Pause, Play, Loader2 } from 'lucide-react'
import { pauseMyAgents, resumeMyAgents } from './actions'

/**
 * The stop button.
 *
 * Pausing asks for confirmation; resuming does not. The asymmetry is deliberate
 * — stopping the thing that answers your phone is the consequential direction,
 * and turning it back on is the safe one. Confirming both would train people to
 * click through the dialog that matters.
 *
 * No browser confirm() — it blocks the page and reads like an error. This is an
 * inline two-step the customer can back out of.
 */
export function PauseControl({ paused, disabled }: { paused: boolean; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (disabled) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        This account is managed by our team. Message us and we&apos;ll stop it for you.
      </p>
    )
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError("That didn't go through. Nothing changed — try again, or message us.")
      setConfirming(false)
    })

  if (paused) {
    return (
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(resumeMyAgents)}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Start everything again
        </button>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:text-red-400"
        >
          <Pause className="h-4 w-4" />
          Stop everything
        </button>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
      <p className="text-sm text-gray-900 dark:text-white">
        This stops everything above straight away. Calls and texts stop being answered until
        you start it again. Nothing is deleted, and you can turn it back on whenever you want.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(pauseMyAgents)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
          Yes, stop it
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Keep it running
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
