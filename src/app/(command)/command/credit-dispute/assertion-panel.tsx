"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import type { FactualBasis } from "@/lib/credit-dispute/policy/dispute-policy";
import type { EvidenceKind } from "@/lib/credit-dispute/policy/assertion";
import { recordCustomerAssertion, recordEvidenceReference } from "./actions";

/**
 * "What does the customer say is wrong?" (C1-003 / C1-013)
 *
 * This is where a CUSTOMER ASSERTION is recorded — the thing every letter now has
 * to trace back to. Deliberately:
 *   - nothing is preselected. The item and the problem are both chosen by a person;
 *     the importer's guesses are shown as hints, never filled in.
 *   - the customer's explanation is typed in their own words; nothing is generated.
 *   - "the customer confirmed this" is a separate tick, off by default. Without it,
 *     nothing can be written in their name.
 * Evidence here is a reference (what the document is), not an upload: there is no
 * credit-evidence store yet (see CREDIT_CASE_MODEL.md).
 */

const PROBLEMS: Array<{ value: FactualBasis; label: string }> = [
  { value: "not_mine", label: "This account is not mine" },
  { value: "identity_theft", label: "Opened through identity theft (needs a report)" },
  { value: "never_late", label: "I was never late on it" },
  { value: "wrong_balance", label: "The balance is wrong" },
  { value: "wrong_dates", label: "The dates are wrong" },
  { value: "wrong_status", label: "The status is wrong" },
  { value: "duplicate", label: "It is listed twice" },
  { value: "paid_in_full_reported_unpaid", label: "I paid it, it shows unpaid" },
  { value: "settled_reported_unsettled", label: "I settled it, it shows outstanding" },
  { value: "included_in_bankruptcy", label: "It was discharged in bankruptcy" },
  { value: "no_permissible_purpose", label: "I did not apply for this inquiry" },
  { value: "reinserted_without_notice", label: "It was removed and came back" },
  { value: "dispute_not_notated", label: "I disputed it and it is not marked disputed" },
  { value: "unverifiable", label: "It came back verified; I want the method" },
];

const EVIDENCE_KINDS: Array<{ value: EvidenceKind; label: string }> = [
  { value: "identity_theft_report", label: "Identity theft report (FTC / police)" },
  { value: "payment_record", label: "Payment record" },
  { value: "account_statement", label: "Account statement" },
  { value: "settlement_letter", label: "Settlement letter" },
  { value: "bankruptcy_discharge", label: "Bankruptcy discharge" },
  { value: "correspondence", label: "Letter from bureau / creditor" },
  { value: "credit_report_copy", label: "Copy of an earlier credit report" },
  { value: "id_document", label: "ID document" },
  { value: "other", label: "Other" },
];

export function AssertionPanel({
  client,
  onSaved,
  onError,
}: {
  client: StoredClient;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [basis, setBasis] = useState<FactualBasis | "">("");
  const [statement, setStatement] = useState("");
  const [source, setSource] = useState<"customer" | "operator">("customer");
  const [confirmed, setConfirmed] = useState(false);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [evKind, setEvKind] = useState<EvidenceKind | "">("");
  const [evDesc, setEvDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const item = client.negativeItems.find((i) => i.id === itemId);
  const current = (client.assertions ?? []).find((a) => a.negativeItemId === itemId && a.status === "active");
  const itemEvidence = (client.evidence ?? []).filter((e) => e.negativeItemId === itemId);
  const hint = item?.isInaccurate || item?.isOutdated || item?.isUnverifiable;

  async function saveAssertion() {
    if (!itemId || !basis) return onError("Choose the item and what the customer says is wrong.");
    setBusy(true);
    const res = await recordCustomerAssertion(client.profile.id, itemId, {
      basis,
      statement,
      source,
      customerConfirmed: confirmed,
      evidenceIds,
    });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    setBasis("");
    setStatement("");
    setConfirmed(false);
    setEvidenceIds([]);
    await onSaved();
  }

  async function saveEvidence() {
    if (!itemId || !evKind) return onError("Choose the item and the kind of document.");
    setBusy(true);
    const res = await recordEvidenceReference(client.profile.id, {
      kind: evKind,
      description: evDesc,
      negativeItemId: itemId,
      assertionId: current?.id,
      source: "operator",
    });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    setEvKind("");
    setEvDesc("");
    await onSaved();
  }

  return (
    <Card className="p-4 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold">What does the customer say is wrong?</h3>
        <p className="text-xs text-gray-500 mt-1">
          A negative item is not the same as a wrong one. Letters only state what the customer says, in their words,
          after they confirm it.
        </p>
      </div>

      <label className="block">
        <span className="text-xs text-gray-600">Item</span>
        <select
          aria-label="Item"
          className="mt-1 block w-full border rounded px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700"
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setEvidenceIds([]);
          }}
        >
          <option value="">— choose an item —</option>
          {client.negativeItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.furnisherName} · {i.bureau} · {i.itemType}
            </option>
          ))}
        </select>
      </label>

      {item && (
        <>
          {hint && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              The importer flagged this item. That is a guess from the report, not something the customer said — ask them.
            </p>
          )}
          {current && (
            <p className="text-xs text-gray-600 dark:text-slate-400">
              On record: <strong>{(current.classification?.basis ?? current.basis ?? current.category ?? "unclassified").replace(/_/g, " ").toLowerCase()}</strong> — “{current.statement}” ({current.source},{" "}
              {current.customerConfirmed ? "confirmed by the customer" : "NOT confirmed by the customer"}, recorded by{" "}
              {current.recordedBy}). Saving a new one replaces it; the old one is kept.
            </p>
          )}

          <label className="block">
            <span className="text-xs text-gray-600">The problem, as the customer describes it</span>
            <select
              aria-label="Stated problem"
              className="mt-1 block w-full border rounded px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700"
              value={basis}
              onChange={(e) => setBasis(e.target.value as FactualBasis | "")}
            >
              <option value="">— the customer has to say —</option>
              {PROBLEMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-600">In the customer&apos;s own words</span>
            <textarea
              aria-label="Customer statement"
              className="mt-1 block w-full border rounded p-2 h-20 bg-white dark:bg-slate-900 dark:border-slate-700"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1">
              <input type="radio" checked={source === "customer"} onChange={() => setSource("customer")} /> The customer told us
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={source === "operator"} onChange={() => setSource("operator")} /> My own reading of a document
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={confirmed} disabled={source !== "customer"} onChange={(e) => setConfirmed(e.target.checked)} />
              The customer confirmed this is what they are saying
            </label>
          </div>

          {itemEvidence.length > 0 && (
            <fieldset className="text-xs">
              <legend className="text-gray-600">Supporting documents on file</legend>
              {itemEvidence.map((e) => (
                <label key={e.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={evidenceIds.includes(e.id)}
                    onChange={(ev) =>
                      setEvidenceIds((cur) => (ev.target.checked ? [...cur, e.id] : cur.filter((x) => x !== e.id)))
                    }
                  />
                  {e.kind.replace(/_/g, " ")} — {e.description}
                </label>
              ))}
            </fieldset>
          )}

          <Button onClick={saveAssertion} disabled={busy}>
            Record the customer&apos;s statement
          </Button>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium">Add a supporting document reference</p>
            <select
              aria-label="Document kind"
              className="block w-full border rounded px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700"
              value={evKind}
              onChange={(e) => setEvKind(e.target.value as EvidenceKind | "")}
            >
              <option value="">— kind of document —</option>
              {EVIDENCE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Document description"
              className="block w-full border rounded px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700"
              placeholder="What it is, e.g. 'Bank statement showing the March payment' (no account numbers)"
              value={evDesc}
              onChange={(e) => setEvDesc(e.target.value)}
            />
            <Button variant="secondary" onClick={saveEvidence} disabled={busy}>
              Add document reference
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
