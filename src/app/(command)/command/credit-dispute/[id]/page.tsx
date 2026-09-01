"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, PageHeader, Button } from "@/components/ui";
import { type StoredClient } from "@/lib/credit-dispute/data/store";
import { getDisputeClient, addDisputeRoundsForClient } from "../actions";
import { runDisputeProtocol } from "@/lib/credit-dispute/engine/protocol";

export default function CreditDisputeClientPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<StoredClient | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getDisputeClient(id)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setError(res.error);
        else setClient(res.data);
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
    const active = client.negativeItems.filter((i) => i.status !== "removed" && i.status !== "closed");
    const result = runDisputeProtocol(client.profile, active);
    const saved = await addDisputeRoundsForClient(client.profile.id, result.lettersGenerated);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    setClient(saved.data);
  }

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-slate-400">Loading client…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700 dark:text-red-300">{error}</p>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <p>Client not found.</p>
        <Link href="/command/credit-dispute/import" className="text-blue-600">Import report</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={client.profile.fullName} description={`${client.source} · ${client.disputeRounds.length} rounds`} />
      <Link href="/command/credit-dispute" className="text-sm text-blue-600">← Credit command</Link>

      <Button onClick={handleGenerate}>Generate next round</Button>

      <section>
        <h2 className="font-semibold mb-2">Dispute letters</h2>
        {client.disputeRounds.length === 0 ? (
          <p className="text-sm text-gray-500">No rounds yet.</p>
        ) : (
          <div className="space-y-2">
            {client.disputeRounds.map((round) => (
              <Card key={round.id} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left p-3 text-sm"
                  onClick={() => setExpanded(expanded === round.id ? null : round.id)}
                >
                  <strong>Round {round.roundNumber}</strong> — {round.roundType} · {round.furnisherName}
                </button>
                {expanded === round.id && (
                  <div className="px-3 pb-3">
                    <p className="text-xs text-violet-600 mb-2">{round.letterSubject}</p>
                    <pre className="text-xs whitespace-pre-wrap bg-gray-50 dark:bg-slate-900 p-3 rounded max-h-96 overflow-auto">
                      {round.letterBody}
                    </pre>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
