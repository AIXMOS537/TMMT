"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader, Button } from "@/components/ui";
import {
  readLegacyClients,
  clearLegacyClients,
  type StoredClient,
} from "@/lib/credit-dispute/data/store";
import {
  listDisputeClients,
  addDisputeRoundsForClient,
  importClientsFromBrowser,
} from "./actions";
import {
  runDisputeProtocol,
  deepAuditAll,
  assessFundingReadiness,
  estimateScoreImpact,
  type DeepAuditResult,
} from "@/lib/credit-dispute/engine/protocol";
import { tierLabel, tierColor } from "@/lib/credit-dispute/engine/funding-readiness";
import { CREDIT_GHL_TAGS } from "@/lib/credit-dispute/ghl-tags";
import { pathLabel } from "@/lib/client-journey/credit-paths";

export default function CreditDisputeCommandPage() {
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stranded, setStranded] = useState(0);
  const [rescuing, setRescuing] = useState(false);

  async function refresh() {
    const res = await listDisputeClients();
    if (!res.ok) {
      setError(res.error);
      return [];
    }
    setError("");
    setClients(res.data);
    setSelectedId((current) =>
      current && res.data.some((c) => c.profile.id === current)
        ? current
        : res.data[0]?.profile.id ?? null
    );
    return res.data;
  }

  useEffect(() => {
    // Clients live in the database now. Anything still under the old browser
    // key belongs to whoever imported it on this machine and would otherwise
    // be invisible, so surface the count and offer to bring it across.
    setStranded(readLegacyClients().length);
    refresh().finally(() => setLoading(false));
    // Runs once — refresh reads no state it does not set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRescue() {
    setRescuing(true);
    setError("");
    const res = await importClientsFromBrowser(readLegacyClients());
    setRescuing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Only clear the browser copy once the server has confirmed it holds them.
    clearLegacyClients();
    setStranded(0);
    await refresh();
    setMessage(
      `Moved ${res.data.imported} client(s) into the database` +
        (res.data.skipped ? `, ${res.data.skipped} already there` : "") +
        ". This browser's copy has been cleared."
    );
  }

  const selected = clients.find((c) => c.profile.id === selectedId);
  const funding = selected ? assessFundingReadiness(selected.profile, selected.negativeItems) : null;
  const audits = selected ? deepAuditAll(selected.negativeItems) : [];
  const impact = selected ? estimateScoreImpact(selected.negativeItems) : null;

  async function handleGenerate() {
    if (!selected) return;
    setError("");
    const active = selected.negativeItems.filter((i) => i.status !== "removed" && i.status !== "closed");
    const result = runDisputeProtocol(selected.profile, active);
    const saved = await addDisputeRoundsForClient(selected.profile.id, result.lettersGenerated);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    await refresh();
    setMessage(`Generated ${result.lettersGenerated.length} letter(s) — log in Dispute Fox + GHL tag ${CREDIT_GHL_TAGS.disputefoxActive}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit dispute command"
        description="AIXMOS in-house — Dispute Fox + MyFreeScoreNow → client_journey → funding handoff"
      />

      <Card className="p-4 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 text-sm">
        <p className="text-gray-700 dark:text-slate-300">
          <strong>Same spine as TMMT:</strong> GHL tags ({CREDIT_GHL_TAGS.guidanceActive} → {CREDIT_GHL_TAGS.fundingPrep}),
          credit_billing_plans, client_journey, shared Supabase. Not a separate product — ops layer on what you already built.
        </p>
      </Card>

      {stranded > 0 && (
        <Card className="p-4 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {stranded} client record{stranded === 1 ? "" : "s"} are still only in this browser
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            They were saved before this desk used the database, so they exist on
            this machine and nowhere else — clearing your browser data would
            lose them. Bring them across and they are backed up like everything
            else.
          </p>
          <Button className="mt-3" onClick={handleRescue} disabled={rescuing}>
            {rescuing ? "Moving…" : `Move ${stranded} into the database`}
          </Button>
        </Card>
      )}

      {error && (
        <Card className="p-3 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
          {error}
        </Card>
      )}

      {loading && (
        <Card className="p-3 text-sm text-gray-600 dark:text-slate-400">Loading clients…</Card>
      )}

      {message && (
        <Card className="p-3 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-200">
          {message}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/command/credit-dispute/import">
          <Button>Import report</Button>
        </Link>
        <Link href="/work/program">
          <Button variant="secondary">Program desk →</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Clients</p>
          {clients.length === 0 ? (
            <p className="text-sm text-gray-500">
              No imports yet.{" "}
              <Link href="/command/credit-dispute/import" className="text-blue-600">Import MFSN / Dispute Fox</Link>
            </p>
          ) : (
            clients.map((c) => {
              const fr = assessFundingReadiness(c.profile, c.negativeItems);
              return (
                <button
                  key={c.profile.id}
                  type="button"
                  onClick={() => setSelectedId(c.profile.id)}
                  className={`w-full text-left p-3 mb-2 rounded-lg border text-sm ${
                    selectedId === c.profile.id
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                      : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <div className="font-semibold">{c.profile.fullName}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {c.negativeItems.length} neg · {tierLabel(fr.tier)}
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <section>
          {selected && funding ? (
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div>
                  <h2 className="text-xl font-semibold">{selected.profile.fullName}</h2>
                  <p className="text-sm text-gray-500">
                    {selected.source} · {selected.profile.email ?? "no email"} · imported{" "}
                    {new Date(selected.importedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/command/credit-dispute/${selected.profile.id}`}>
                    <Button variant="secondary">Letters</Button>
                  </Link>
                  <Button onClick={handleGenerate}>Generate round</Button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: "Experian", value: selected.profile.scoreExperian },
                  { label: "Equifax", value: selected.profile.scoreEquifax },
                  { label: "TransUnion", value: selected.profile.scoreTransunion },
                ].map((s) => (
                  <Card key={s.label} className="p-4 text-center">
                    <p className="text-xs uppercase text-gray-500">{s.label}</p>
                    <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{s.value ?? "—"}</p>
                  </Card>
                ))}
              </div>

              <Card className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-xs uppercase text-gray-500">Funding readiness</p>
                    <p className="text-lg font-semibold" style={{ color: tierColor(funding.tier) }}>
                      {tierLabel(funding.tier)}
                    </p>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: tierColor(funding.tier) }}>
                    {funding.score}
                  </p>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${funding.score}%`, background: tierColor(funding.tier) }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  GHL tag: <code className="text-violet-600">{funding.ghlTag}</code>
                  {impact && (
                    <span className="ml-3">
                      Est. gain if cleared: +{impact.estimatedGain.min}–{impact.estimatedGain.max} pts
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Billing paths: monthly_97 · payment_plan_500 · mentorship_dfy_1000 ({pathLabel("mentorship_dfy_1000")})
                </p>
              </Card>

              <div>
                <h3 className="font-semibold mb-2">Deep audit — {audits.length} items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2 pr-3">Pri</th>
                        <th className="py-2 pr-3">Bureau</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Furnisher</th>
                        <th className="py-2 pr-3">Conf.</th>
                        <th className="py-2">Finding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audits.map((a: DeepAuditResult) => (
                        <tr key={a.item.id} className="border-b border-gray-100 dark:border-slate-800">
                          <td className="py-2 pr-3 font-mono text-xs">{a.priority}</td>
                          <td className="py-2 pr-3 uppercase text-xs">{a.item.bureau}</td>
                          <td className="py-2 pr-3">{a.item.itemType}</td>
                          <td className="py-2 pr-3 font-medium">{a.item.furnisherName}</td>
                          <td className="py-2 pr-3">{a.overallConfidence}%</td>
                          <td className="py-2 text-gray-500 text-xs">{a.findings[0]?.title ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Select a client or import a MyFreeScoreNow / Dispute Fox report.</p>
          )}
        </section>
      </div>
    </div>
  );
}
