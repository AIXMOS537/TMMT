"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, PageHeader, Button } from "@/components/ui";
import type { StoredClient, StoredDisputeRound } from "@/lib/credit-dispute/data/store";
import type { NotDisputed } from "@/lib/credit-dispute/engine/gated-protocol";
import { getDisputeClientVersioned, generateDisputeRound, reviewDisputeRound } from "../actions";
import { CaseConsole, RoundLifecycle } from "./case-console";

/**
 * One client's rounds.
 *
 * C1: this page used to run the legacy ungated protocol in the browser and post the
 * letters it built — that is how "Generate next round" skipped the accuracy policy.
 * It now only calls the server: generateDisputeRound() decides and renders from the
 * stored record, and every new round waits here for a person to approve, return or
 * cancel it.
 */

const STATUS_LABEL: Record<string, string> = {
  draft: "Awaiting review (pre-C1 draft)",
  needs_review: "Awaiting review",
  returned_for_information: "Returned for information",
  approved: "Approved — not sent",
  cancelled: "Cancelled",
  sent: "Sent",
  response_received: "Response received",
  closed: "Closed",
};

const SOURCE_LABEL: Record<string, string> = {
  report_field: "credit report",
  customer_assertion: "customer's words",
  basis_statement: "customer's stated problem",
  evidence: "document on file",
  round_history: "our earlier round",
  recorded_response: "recorded response",
};

export default function CreditDisputeClientPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<StoredClient | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notDisputed, setNotDisputed] = useState<NotDisputed[]>([]);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<{ roundId: string; body: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** C3-020: the version this page is showing. Sent with every change; a stale page is refused. */
  const [version, setVersion] = useState<string | undefined>(undefined);

  /** Reload the case AND its version together, so the page never holds a version whose contents it has not shown. */
  async function reload() {
    const res = await getDisputeClientVersioned(id);
    if (!res.ok) return setError(res.error);
    setClient(res.data?.client ?? null);
    setVersion(res.data?.version ?? undefined);
  }
  const changed = () => {
    setError("");
    void reload();
  };

  useEffect(() => {
    let cancelled = false;
    getDisputeClientVersioned(id)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setError(res.error);
        else {
          setClient(res.data?.client ?? null);
          setVersion(res.data?.version ?? undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleGenerate() {
    if (!client) return;
    setError("");
    setMessage("");
    const res = await generateDisputeRound(client.profile.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const out = res.data;
    setNotDisputed(out.plan.notDisputed);
    if (out.kind === "stored") {
      await reload();
      setMessage(`${out.roundIds.length} draft letter(s) stored for review. Nothing has been sent.`);
    } else if (out.kind === "gated") {
      setMessage(`${out.plan.summary}. Letter generation is closed by the attorney gate: ${out.gate}`);
    } else if (out.kind === "template_unapproved") {
      setMessage(`Nothing written: the exact wording of a letter template has no active counsel approval (${out.detail}).`);
    } else if (out.kind === "facts_missing") {
      setMessage(`Nothing written: ${out.detail}`);
    } else {
      setMessage(`${out.plan.summary} — nothing is ready for a letter yet.`);
    }
  }

  async function review(round: StoredDisputeRound, kind: "approve" | "return_for_information" | "cancel") {
    if (!client) return;
    let note: string | undefined;
    if (kind === "return_for_information") {
      note = window.prompt("What information is needed?") ?? undefined;
      if (!note?.trim()) return;
    }
    const res = await reviewDisputeRound(
      client.profile.id,
      round.id,
      kind === "return_for_information" ? { kind, note: note ?? "" } : { kind, note },
      version
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    changed();
  }

  async function saveEdit() {
    if (!client || !editing) return;
    const res = await reviewDisputeRound(client.profile.id, editing.roundId, { kind: "edit", body: editing.body }, version);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(null);
    changed();
  }

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-slate-400">Loading client…</p>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : <p>Client not found.</p>}
        <Link href="/command/credit-dispute/import" className="text-blue-600">Import report</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={client.profile.fullName} description={`${client.source} · ${client.disputeRounds.length} rounds`} />
      <Link href="/command/credit-dispute" className="text-sm text-blue-600">← Credit command</Link>

      <div className="flex items-center gap-3">
        <Button onClick={handleGenerate}>Generate next round</Button>
        <span className="text-xs text-gray-500">Runs the accuracy policy on the server. Drafts only — nothing is sent.</span>
      </div>

      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {message && <p className="text-sm text-green-800 dark:text-green-300">{message}</p>}

      {notDisputed.length > 0 && (
        <Card className="p-4 text-sm">
          <h3 className="font-semibold">Not written ({notDisputed.length})</h3>
          <ul className="mt-2 space-y-2">
            {notDisputed.map((n) => (
              <li key={n.negativeItemId}>
                <span className="font-medium">{n.furnisherName}</span>{" "}
                <span className="text-xs uppercase text-gray-500">{n.action.replace("_", " ")}</span>
                <p className="text-gray-700 dark:text-slate-300">{n.reason}</p>
                {n.missing && n.missing.length > 0 && (
                  <ul className="ml-4 list-disc text-xs text-amber-800 dark:text-amber-300">
                    {n.missing.map((m) => (
                      <li key={m.code}>{m.message}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="font-semibold mb-2">Dispute rounds</h2>
        {client.disputeRounds.length === 0 ? (
          <p className="text-sm text-gray-500">No rounds yet.</p>
        ) : (
          <div className="space-y-2">
            {client.disputeRounds.map((round) => {
              const awaiting = round.status === "needs_review" || round.status === "draft";
              return (
                <Card key={round.id} className="overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left p-3 text-sm"
                    onClick={() => setExpanded(expanded === round.id ? null : round.id)}
                  >
                    <strong>Round {round.roundNumber}</strong> — {round.roundType} · {round.furnisherName}{" "}
                    <span className="ml-2 text-xs text-gray-500">{STATUS_LABEL[round.status] ?? round.status}</span>
                  </button>
                  {expanded === round.id && (
                    <div className="px-3 pb-3 space-y-3">
                      {round.trace && round.trace.length > 0 ? (
                        <div className="text-xs">
                          <p className="font-medium">Facts this letter states, and where each came from</p>
                          <ul className="mt-1 space-y-1">
                            {round.trace.map((t, i) => (
                              <li key={i}>
                                <span className="text-violet-700 dark:text-violet-300">[{SOURCE_LABEL[t.source] ?? t.source}]</span> {t.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">No fact trace recorded (pre-C1 round). Check every statement before approving.</p>
                      )}
                      <p className="text-xs text-violet-600">{round.letterSubject}</p>
                      {editing?.roundId === round.id ? (
                        <div className="space-y-2">
                          <textarea
                            aria-label="Edit letter"
                            className="w-full text-xs font-mono border rounded p-2 h-72 bg-white dark:bg-slate-900"
                            value={editing.body}
                            onChange={(e) => setEditing({ roundId: round.id, body: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button onClick={saveEdit}>Save edit</Button>
                            <Button variant="secondary" onClick={() => setEditing(null)}>Discard</Button>
                          </div>
                        </div>
                      ) : (
                        <pre className="text-xs whitespace-pre-wrap bg-gray-50 dark:bg-slate-900 p-3 rounded max-h-96 overflow-auto">
                          {round.letterBody}
                        </pre>
                      )}
                      {round.review && (
                        <p className="text-xs text-gray-500">
                          {round.review.decision.replace(/_/g, " ")} by {round.review.reviewedBy} on {round.review.reviewedAt.slice(0, 10)}
                          {round.review.note ? ` — ${round.review.note}` : ""}
                        </p>
                      )}
                      {round.reviewHistory && round.reviewHistory.length > 0 && (
                        <p className="text-xs text-gray-500">
                          Earlier decisions: {round.reviewHistory.map((h) => `${h.decision.replace(/_/g, " ")} by ${h.reviewedBy}`).join("; ")}
                        </p>
                      )}
                      {round.recipientId && (
                        <p className="text-xs text-gray-500">Addressed to registry recipient {round.recipientId} (version {round.recipientVersion})</p>
                      )}
                      <RoundLifecycle round={round} client={client} seenVersion={version} onChange={changed} onError={setError} />
                      {awaiting && editing?.roundId !== round.id && (
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => review(round, "approve")}>Approve</Button>
                          <Button variant="secondary" onClick={() => setEditing({ roundId: round.id, body: round.letterBody })}>Edit</Button>
                          <Button variant="secondary" onClick={() => review(round, "return_for_information")}>Return for information</Button>
                          <Button variant="secondary" onClick={() => review(round, "cancel")}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <CaseConsole client={client} seenVersion={version} onChange={changed} onError={setError} />
    </div>
  );
}
