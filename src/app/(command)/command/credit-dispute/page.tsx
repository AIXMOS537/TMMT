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
  generateDisputeRound,
  importClientsFromBrowser,
  recordItemAssessment,
} from "./actions";
import type { NotDisputed } from "@/lib/credit-dispute/engine/gated-protocol";
import type { FactualBasis } from "@/lib/credit-dispute/policy/dispute-policy";
import {
  deepAuditAll,
  assessFundingReadiness,
  type DeepAuditResult,
} from "@/lib/credit-dispute/engine/protocol";
import { AssertionPanel } from "./assertion-panel";
import { tierLabel, tierColor } from "@/lib/credit-dispute/engine/funding-readiness";
import { CREDIT_GHL_TAGS } from "@/lib/credit-dispute/ghl-tags";
import { pathLabel } from "@/lib/client-journey/credit-paths";


/**
 * The grounds a person may record.
 *
 * Only grounds with a verified statutory route appear here. The theories in
 * docs/knowledge/QUARANTINE-disputed-legal-theories.md are deliberately absent —
 * if it is not selectable, it cannot end up in a letter.
 */
const BASIS_OPTIONS: Array<{ value: FactualBasis; label: string }> = [
  { value: "not_mine", label: "Not mine" },
  { value: "identity_theft", label: "Identity theft (report filed)" },
  { value: "never_late", label: "Never late — paid on time" },
  { value: "wrong_balance", label: "Balance is wrong" },
  { value: "wrong_dates", label: "Dates are wrong" },
  { value: "wrong_status", label: "Status is wrong" },
  { value: "duplicate", label: "Duplicate of another entry" },
  { value: "paid_in_full_reported_unpaid", label: "Paid, reported unpaid" },
  { value: "settled_reported_unsettled", label: "Settled, reported outstanding" },
  { value: "included_in_bankruptcy", label: "Discharged in bankruptcy" },
  { value: "no_permissible_purpose", label: "Inquiry not authorised" },
  { value: "reinserted_without_notice", label: "Reinserted without notice" },
  { value: "dispute_not_notated", label: "Dispute not notated" },
  { value: "unverifiable", label: "Came back verified — demand method" },
];

export default function CreditDisputeCommandPage() {
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<{ summary: string; notDisputed: NotDisputed[]; nextActions: string[] } | null>(null);
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
  // The accuracy calls ride inside the client record itself, which
  // listDisputeClients() loads from dispute_clients.payload. Recording one
  // writes through a server action and refresh() brings it back, so this
  // re-renders without a local copy of anything.
  const current = selected?.assessments ?? {};

  async function handleGenerate() {
    if (!selected) return;
    setError("");

    // C1: decided AND rendered on the server, from the stored record. The browser
    // no longer builds letters. On a fresh import this will usually produce ZERO
    // letters and a list of items waiting on a fact — that is correct: nobody has
    // recorded what the customer says is wrong yet.
    const res = await generateDisputeRound(selected.profile.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const out = res.data;
    const nextActions =
      out.kind === "stored"
        ? [`Review ${out.roundIds.length} draft letter(s) on the Letters page: check every fact against its source, then approve, return or cancel`]
        : [];
    setRun({ summary: out.plan.summary, notDisputed: out.plan.notDisputed, nextActions });
    if (out.kind === "stored") {
      await refresh();
      setMessage(`${out.plan.summary} — drafts stored for review. Nothing has been sent.`);
    } else if (out.kind === "gated") {
      setMessage(`${out.plan.summary}. Letter generation is closed by the attorney gate.`);
    } else if (out.kind === "facts_missing") {
      setMessage(`Nothing written: ${out.detail}`);
    } else {
      setMessage(`${out.plan.summary} — nothing is ready for a letter yet.`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit dispute command"
        description="AIXMOS in-house, staff-operated — Dispute Fox + MyFreeScoreNow → accuracy gate → letters → funding handoff"
      />

      <Card className="p-4 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 text-sm">
        <p className="text-gray-700 dark:text-slate-300">
          <strong>Same spine as TMMT:</strong> GHL tags ({CREDIT_GHL_TAGS.guidanceActive} → {CREDIT_GHL_TAGS.fundingPrep}),
          credit_billing_plans, shared Supabase. Not a separate product — ops layer on what you already built. NOTE: this engine is not yet wired to client_journey; the rental journey and the credit engine are still separate.
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

      {run && run.notDisputed.length > 0 && (
        <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
            Not disputed ({run.notDisputed.length})
          </h3>
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
            These are safe to read out to the client as-is.
          </p>
          <ul className="mt-3 space-y-3">
            {run.notDisputed.map((n) => (
              <li key={n.negativeItemId} className="text-sm">
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {n.furnisherName}
                </span>
                <p className="text-gray-700 dark:text-slate-300">{n.reason}</p>
                {n.missing && n.missing.length > 0 && (
                  <ul className="ml-4 list-disc text-xs text-amber-800 dark:text-amber-300">
                    {n.missing.map((m) => (
                      <li key={m.code}>{m.message}</li>
                    ))}
                  </ul>
                )}
                {n.nextStep && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                    Next: {n.nextStep}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {run && run.nextActions.length > 0 && (
        <Card className="p-4 text-sm">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100">Next actions</h3>
          <ul className="mt-2 space-y-1 text-gray-700 dark:text-slate-300">
            {run.nextActions.map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>
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
                        <th className="py-2 pr-3">Accuracy call</th>
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
                          <td className="py-2 pr-3">
                            <select
                              aria-label={`Accuracy call for ${a.item.furnisherName}`}
                              className="text-xs border rounded px-1 py-0.5 bg-white dark:bg-slate-900 dark:border-slate-700"
                              value={
                                current[a.item.id]?.accuracy === "accurate"
                                  ? "accurate"
                                  : current[a.item.id]?.basis ?? ""
                              }
                              onChange={async (e) => {
                                const v = e.target.value;
                                if (!selected) return;
                                const assessment =
                                  v === ""
                                    ? { accuracy: "unknown" as const }
                                    : v === "accurate"
                                      ? { accuracy: "accurate" as const }
                                      : { accuracy: "inaccurate" as const, basis: v as FactualBasis };

                                // Server action, not localStorage: the call is part of
                                // the client record, and that record holds DOB, SSN
                                // last four and the home address.
                                setError("");
                                const res = await recordItemAssessment(
                                  selected.profile.id,
                                  a.item.id,
                                  assessment
                                );
                                if (!res.ok) {
                                  setError(res.error);
                                  return;
                                }
                                setRun(null);
                                await refresh();
                              }}
                            >
                              <option value="">Not assessed</option>
                              <option value="accurate">Accurate — coach, do not dispute</option>
                              {BASIS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 text-gray-500 text-xs">{a.findings[0]?.title ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <AssertionPanel
                client={selected}
                onSaved={async () => {
                  setRun(null);
                  await refresh();
                }}
                onError={setError}
              />
            </div>
          ) : (
            <p className="text-gray-500">Select a client or import a MyFreeScoreNow / Dispute Fox report.</p>
          )}
        </section>
      </div>
    </div>
  );
}
