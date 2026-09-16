"use client";

/**
 * The read end of the VA task queue.
 *
 * Preview shows what the compliance gate decides for every pending task.
 * Stage writes the allowed ones into automation_outbox as queued drafts.
 * Neither button sends anything — dispatching a queued draft is a separate,
 * deliberate act.
 */

import { useState } from "react";
import { previewVaTaskSms, stageVaTaskSms, type OutboxResult } from "./actions";
import type { StageSummary } from "@/lib/ops/va-task-outbox";

const REASON_NOTE: Record<string, string> = {
  gate_hold: "marketing — needs your approval",
  dnc: "on the do-not-contact list",
  dnc_unverified: "could not verify do-not-contact — refused",
  opted_out: "texted STOP",
  optout_unverified: "could not verify opt-out — refused",
};

export default function OutboxPage() {
  const [summary, setSummary] = useState<StageSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approveMarketing, setApproveMarketing] = useState(false);

  async function run(fn: () => Promise<OutboxResult<StageSummary>>) {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      if (res.ok) setSummary(res.data);
      else setError(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Message outbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Drafts pending VA tasks into the outbox. Nothing here sends — queued drafts are
        dispatched separately.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(previewVaTaskSms)}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Working…" : "Preview (writes nothing)"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => stageVaTaskSms({ ownerApproved: approveMarketing }))}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Stage drafts"}
        </button>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={approveMarketing}
            onChange={(e) => setApproveMarketing(e.target.checked)}
          />
          Also approve marketing (lead re-engagement, waitlist)
        </label>
      </div>

      {approveMarketing && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Marketing texts to old leads are the kind carriers ban numbers for. Only tick this
          when you have decided to run that campaign.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {summary && (
        <section className="mt-6 rounded border p-4 text-sm">
          <h2 className="font-medium">
            {summary.dryRun ? "Preview — nothing was written" : "Staged"}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
            <dt>Considered</dt>
            <dd>{summary.considered}</dd>
            <dt>{summary.dryRun ? "Would queue" : "Queued"}</dt>
            <dd className="font-medium">{summary.staged}</dd>
            <dt>Already had a draft</dt>
            <dd>{summary.skippedAlreadyQueued}</dd>
            <dt>No phone</dt>
            <dd>{summary.skippedNoPhone}</dd>
            <dt>Closed (handled/dismissed)</dt>
            <dd>{summary.skippedClosed}</dd>
            <dt>Refused by the gate</dt>
            <dd>{summary.refusedByGate}</dd>
          </dl>

          {Object.keys(summary.refusedByReason).length > 0 && (
            <ul className="mt-3 space-y-1">
              {Object.entries(summary.refusedByReason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, n]) => (
                  <li key={reason}>
                    <span className="font-mono">{reason}</span> — {n}
                    {REASON_NOTE[reason] ? ` (${REASON_NOTE[reason]})` : ""}
                  </li>
                ))}
            </ul>
          )}

          {summary.drafts.length > 0 && (
            <>
              <h3 className="mt-5 font-medium">First drafts</h3>
              <ul className="mt-2 space-y-3">
                {summary.drafts.slice(0, 5).map((d) => (
                  <li key={d.taskId} className="rounded bg-muted p-3">
                    <div className="font-mono text-xs">
                      {d.category} → {d.to}
                    </div>
                    <div className="mt-1">{d.body}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
