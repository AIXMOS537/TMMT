"use client";

import { useEffect, useState } from "react";
import { Card, Button } from "@/components/ui";
import type { StoredClient, StoredDisputeRound } from "@/lib/credit-dispute/data/store";
import type { FactualBasis } from "@/lib/credit-dispute/policy/dispute-policy";
import type { ResponseOutcome, SendMethod } from "@/lib/credit-dispute/policy/assertion";
import type { TimelineEntry } from "@/lib/credit-dispute/engine/case-state";
import {
  authorizeFollowUpRound,
  classifyCustomerAssertion,
  getCaseTimeline,
  getEvidenceDownloadUrl,
  linkCustomerAccount,
  recordDisputeResponse,
  recordRoundSent,
  reviewDisputeRound,
  reviewEvidenceDocument,
} from "../actions";

/**
 * Operator case console (C2-10). Everything here RECORDS what a person did or saw.
 * Nothing sends, mails, submits or contacts anyone. Recording "sent" requires the
 * exact approved text; recording a response requires a real response; a follow-up
 * requires a specific, written reason.
 */

const GROUNDS: FactualBasis[] = [
  "not_mine", "identity_theft", "never_late", "wrong_balance", "wrong_dates", "wrong_status", "duplicate",
  "paid_in_full_reported_unpaid", "settled_reported_unsettled", "included_in_bankruptcy", "no_permissible_purpose",
  "reinserted_without_notice", "dispute_not_notated", "unverifiable",
];
const METHODS: Array<{ v: SendMethod; l: string }> = [
  { v: "mail", l: "Mail" }, { v: "certified_mail", l: "Certified mail (only if it really was)" }, { v: "fax", l: "Fax" },
  { v: "online_portal", l: "Online portal" }, { v: "hand_delivered", l: "Hand delivered" }, { v: "other", l: "Other" },
];
const OUTCOMES: ResponseOutcome[] = ["deleted", "corrected", "updated", "verified", "no_change", "no_response", "frivolous", "unknown"];

type Props = { client: StoredClient; onChange: (c: StoredClient) => void; onError: (m: string) => void };

async function apply(p: Props, run: () => Promise<{ ok: true; data: StoredClient | null } | { ok: false; error: string }>) {
  const r = await run();
  if (!r.ok) return p.onError(r.error);
  if (r.data) p.onChange(r.data);
}

export function RoundLifecycle({ round, ...p }: Props & { round: StoredDisputeRound }) {
  const id = p.client.profile.id;
  const [sentAt, setSentAt] = useState("");
  const [method, setMethod] = useState<SendMethod | "">("");
  const [recipient, setRecipient] = useState("");
  const [tracking, setTracking] = useState("");
  const [outcome, setOutcome] = useState<ResponseOutcome | "">("");
  const [summary, setSummary] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [party, setParty] = useState("");
  const [reason, setReason] = useState("");

  if (round.status === "approved") {
    return (
      <div className="space-y-2 border-t pt-2 text-xs">
        <p className="font-medium">Record that a person sent this approved letter (this does not send anything)</p>
        <input type="date" aria-label="Sent on" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className="border rounded px-1" />
        <select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value as SendMethod)} className="border rounded px-1 ml-2">
          <option value="">— how was it sent? —</option>
          {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <input aria-label="Recipient" placeholder="Sent to" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="border rounded px-1 ml-2" />
        <input aria-label="Tracking" placeholder="Tracking / reference (only if you have one)" value={tracking} onChange={(e) => setTracking(e.target.value)} className="border rounded px-1 ml-2 w-64" />
        <div className="flex gap-2">
          <Button disabled={!sentAt || !method || !recipient} onClick={() => apply(p, () => recordRoundSent(id, round.id, { sentAt: new Date(sentAt).toISOString(), method: method as SendMethod, recipient, trackingRef: tracking || undefined }))}>
            Record as sent
          </Button>
          <Button variant="secondary" onClick={() => { const note = window.prompt("Why reopen this approved letter?"); if (note) apply(p, () => reviewDisputeRound(id, round.id, { kind: "reopen", note })); }}>
            Reopen for review
          </Button>
        </div>
      </div>
    );
  }

  if (round.status === "sent") {
    return (
      <div className="space-y-2 border-t pt-2 text-xs">
        <p>Sent {round.sent?.sentAt.slice(0, 10)} by {round.sent?.method.replace("_", " ")} to {round.sent?.recipient}{round.sent?.trackingRef ? ` · ref ${round.sent.trackingRef}` : ""} (recorded by {round.sent?.recordedBy})</p>
        <p className="font-medium">Record the response exactly as it reads</p>
        <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as ResponseOutcome)} className="border rounded px-1">
          <option value="">— what did the response say? —</option>
          {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
        </select>
        <input type="date" aria-label="Received on" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="border rounded px-1 ml-2" />
        <input aria-label="Responding party" placeholder="Who responded" value={party} onChange={(e) => setParty(e.target.value)} className="border rounded px-1 ml-2" />
        <textarea aria-label="Response summary" placeholder="What the response said" value={summary} onChange={(e) => setSummary(e.target.value)} className="block w-full border rounded p-1 h-16" />
        <Button disabled={!outcome || !receivedAt || !summary.trim()} onClick={() => apply(p, () => recordDisputeResponse(id, round.id, { outcome: outcome as ResponseOutcome, summary, receivedAt: new Date(receivedAt).toISOString(), respondingParty: party || undefined }))}>
          Record response
        </Button>
      </div>
    );
  }

  if (round.status === "response_received" && round.response) {
    const resolved = ["deleted", "corrected", "updated"].includes(round.response.outcome);
    return (
      <div className="space-y-2 border-t pt-2 text-xs">
        <p>
          Response {round.response.receivedAt.slice(0, 10)}{round.response.respondingParty ? ` from ${round.response.respondingParty}` : ""}: <strong>{round.response.outcome}</strong> — {round.response.summary}
        </p>
        {round.response.followUpReason ? (
          <p>Follow-up authorized by {round.response.followUpAuthorizedBy}: “{round.response.followUpReason}”</p>
        ) : resolved ? (
          <p>Resolved by the response. No follow-up.</p>
        ) : (
          <>
            <p className="font-medium">Authorize a follow-up — what did the response get wrong or leave unanswered?</p>
            <textarea aria-label="Follow-up reason" value={reason} onChange={(e) => setReason(e.target.value)} className="block w-full border rounded p-1 h-16" />
            <Button disabled={reason.trim().length < 20} onClick={() => apply(p, () => authorizeFollowUpRound(id, round.id, reason))}>Authorize follow-up</Button>
          </>
        )}
      </div>
    );
  }
  return null;
}

export function CaseConsole(p: Props) {
  const c = p.client;
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [linkId, setLinkId] = useState("");

  useEffect(() => {
    getCaseTimeline(c.profile.id).then((r) => r.ok && setTimeline(r.data));
  }, [c]);

  const items = new Map(c.negativeItems.map((i) => [i.id, i]));

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm space-y-2">
        <h2 className="font-semibold">What the customer says is wrong</h2>
        {(c.assertions ?? []).length === 0 && <p className="text-gray-500">Nothing recorded yet.</p>}
        {(c.assertions ?? []).map((a) => (
          <div key={a.id} className="border-t pt-2">
            <p className="text-xs text-gray-500">
              {items.get(a.negativeItemId)?.furnisherName ?? a.negativeItemId} · {a.status}
              {a.category ? ` · customer category: ${a.category.toLowerCase().replace(/_/g, " ")}` : ""}
              {a.confirmation ? ` · confirmed ${a.confirmation.confirmedAt.slice(0, 10)} (${a.confirmation.channel.replace("_", " ")})` : " · NOT confirmed"}
            </p>
            <p>“{a.originalStatement ?? a.statement}”</p>
            <p className="text-xs">
              Ground: <strong>{(a.classification?.basis ?? a.basis ?? "needs classification").replace(/_/g, " ")}</strong>
              {a.classification ? ` (classified by ${a.classification.by})` : ""}
            </p>
            {a.status !== "withdrawn" && (
              <select
                aria-label="Classify ground"
                className="text-xs border rounded px-1 mt-1"
                value=""
                onChange={(e) => e.target.value && apply(p, () => classifyCustomerAssertion(c.profile.id, a.id, e.target.value as FactualBasis))}
              >
                <option value="">— classify the specific ground (does not change their words) —</option>
                {GROUNDS.map((g) => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
              </select>
            )}
          </div>
        ))}
      </Card>

      <Card className="p-4 text-sm space-y-2">
        <h2 className="font-semibold">Documents</h2>
        {(c.evidence ?? []).length === 0 && <p className="text-gray-500">None on file.</p>}
        {(c.evidence ?? []).map((e) => (
          <div key={e.id} className="border-t pt-2 text-xs flex flex-wrap items-center gap-2">
            <span>{e.kind.replace(/_/g, " ")} — {e.description}{e.fileName ? ` (${e.fileName})` : ""} · {e.source} · {e.reviewState ?? "pending_review"}</span>
            {e.storagePath && (
              <Button variant="secondary" onClick={async () => { const r = await getEvidenceDownloadUrl(c.profile.id, e.id); if (r.ok) window.open(r.data, "_blank", "noopener"); else p.onError(r.error); }}>
                Open (2-minute link)
              </Button>
            )}
            {e.reviewState !== "accepted" && <Button variant="secondary" onClick={() => apply(p, () => reviewEvidenceDocument(c.profile.id, e.id, "accepted"))}>Accept</Button>}
            {e.reviewState !== "rejected" && <Button variant="secondary" onClick={() => apply(p, () => reviewEvidenceDocument(c.profile.id, e.id, "rejected"))}>Reject</Button>}
          </div>
        ))}
      </Card>

      <Card className="p-4 text-sm space-y-2">
        <h2 className="font-semibold">Customer account</h2>
        {c.customerUserId ? <p className="text-xs">Linked to a customer login.</p> : (
          <div className="flex gap-2 items-center">
            <input aria-label="Customer user id" placeholder="Customer's user id" value={linkId} onChange={(e) => setLinkId(e.target.value)} className="border rounded px-1 text-xs w-80" />
            <Button variant="secondary" onClick={() => apply(p, () => linkCustomerAccount(c.profile.id, linkId))}>Link</Button>
          </div>
        )}
      </Card>

      <Card className="p-4 text-sm">
        <h2 className="font-semibold mb-2">Case timeline</h2>
        <ol className="space-y-1 text-xs">
          {timeline.map((t) => (
            <li key={`${t.at}-${t.seq}`}>
              <span className="text-gray-500">{t.at.replace("T", " ").slice(0, 16)}</span> · {t.label} · <span className="text-gray-500">{t.actor}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
