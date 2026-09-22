"use client";

import { useEffect, useState } from "react";
import { Card, Button, PageHeader } from "@/components/ui";
import type { CustomerCaseView } from "@/lib/credit-dispute/engine/case-state";
import type { IssueCategory } from "@/lib/credit-dispute/policy/assertion";
import { confirmMyStatement, draftMyStatement, getMyCreditCase, getMyDocumentLink, uploadMyDocument } from "./actions";

/**
 * REPORT → ITEM → WHAT DO YOU BELIEVE IS WRONG? → YOUR OWN WORDS → (DOCUMENT) → REVIEW → CONFIRM
 *
 * Deliberately plain and neutral. Nothing is preselected: no category, no wording,
 * no "this isn't mine" default. Negative is not the same as wrong, and the page says
 * so. Choosing a category only files the concern; it does not write anything for you.
 */

const CATEGORIES: Array<{ value: IssueCategory; label: string }> = [
  { value: "NOT_MINE", label: "I don't recognise this account" },
  { value: "IDENTITY_THEFT", label: "Someone else opened it in my name" },
  { value: "BALANCE_INCORRECT", label: "The balance is wrong" },
  { value: "PAYMENT_HISTORY_INCORRECT", label: "My payment history is wrong" },
  { value: "STATUS_INCORRECT", label: "The status is wrong (e.g. shows open or unpaid)" },
  { value: "DATE_INCORRECT", label: "A date is wrong" },
  { value: "DUPLICATE", label: "It is listed more than once" },
  { value: "INQUIRY_NOT_RECOGNIZED", label: "I don't recognise this credit check" },
  { value: "ACCOUNT_DETAILS_INCORRECT", label: "Other account details are wrong" },
  { value: "OTHER", label: "Something else" },
];

type Step = "item" | "what" | "words" | "review";

export function MyCreditFlow({ uploadsEnabled }: { uploadsEnabled: boolean }) {
  const [view, setView] = useState<CustomerCaseView | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("item");
  const [itemId, setItemId] = useState("");
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [statement, setStatement] = useState("");
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  /** C3-020: the version this page shows. Sent with every change; a change from a stale tab is refused. */
  const [version, setVersion] = useState<string | null>(null);

  async function reload() {
    const r = await getMyCreditCase();
    if (!r.ok) return setError(r.error);
    setView(r.data);
    setVersion(r.data.version);
  }

  useEffect(() => {
    getMyCreditCase().then((r) => {
      if (!r.ok) return setError(r.error);
      setView(r.data);
      setVersion(r.data.version);
    });
  }, []);

  const item = view?.items.find((i) => i.id === itemId);
  const draft = view?.statements.find((s) => s.id === draftId);

  async function saveDraft() {
    if (!itemId || !category) return;
    setBusy(true);
    setError("");
    const before = new Set(view?.statements.map((s) => s.id));
    const r = await draftMyStatement({ negativeItemId: itemId, category, statement, seenVersion: version });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setView(r.data);
    const created = r.data.statements.find((s) => !before.has(s.id));
    if (created) setDraftId(created.id);
    setStep("review");
    await reload();
  }

  async function confirm() {
    if (!draftId) return;
    setBusy(true);
    const r = await confirmMyStatement(draftId, version);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setView(r.data);
    setStep("item");
    setItemId("");
    setCategory("");
    setStatement("");
    setDraftId("");
    await reload();
  }

  async function upload(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("negativeItemId", itemId);
    if (draftId) fd.set("assertionId", draftId);
    if (version) fd.set("seenVersion", version);
    setBusy(true);
    const r = await uploadMyDocument(fd);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setView(r.data);
    form.reset();
    await reload();
  }

  if (!view) {
    return <p className="text-sm text-gray-600">{error || "Loading your credit items…"}</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Your credit items" description={`Case status: ${view.statusLabel}`} />
      <p className="text-sm text-gray-600 dark:text-slate-400">
        If you believe something on your report is inaccurate or incomplete, tell us what and why, in your own words.
        An item being negative does not mean it is wrong, and we only raise what you tell us is wrong.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}

      {step === "item" && (
        <Card className="p-4 space-y-3 text-sm">
          <h2 className="font-semibold">1. Which item?</h2>
          {view.items.length === 0 && <p>No items on file.</p>}
          {view.items.map((i) => (
            <label key={i.id} className="flex items-center gap-2">
              <input type="radio" name="item" checked={itemId === i.id} onChange={() => setItemId(i.id)} />
              {i.furnisherName} · {i.bureau} · {i.itemType.replace(/_/g, " ")}
              {i.accountRef ? ` · ${i.accountRef}` : ""}
            </label>
          ))}
          <Button disabled={!itemId} onClick={() => setStep("what")}>Next</Button>
        </Card>
      )}

      {step === "what" && item && (
        <Card className="p-4 space-y-3 text-sm">
          <h2 className="font-semibold">2. What do you believe is wrong with {item.furnisherName}?</h2>
          {CATEGORIES.map((c) => (
            <label key={c.value} className="flex items-center gap-2">
              <input type="radio" name="category" checked={category === c.value} onChange={() => setCategory(c.value)} />
              {c.label}
            </label>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("item")}>Back</Button>
            <Button disabled={!category} onClick={() => setStep("words")}>Next</Button>
          </div>
        </Card>
      )}

      {step === "words" && item && (
        <Card className="p-4 space-y-3 text-sm">
          <h2 className="font-semibold">3. In your own words, what is wrong and how do you know?</h2>
          <textarea
            aria-label="Your explanation"
            className="w-full border rounded p-2 h-32 bg-white dark:bg-slate-900"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
          <p className="text-xs text-gray-500">We will not add to or change what you write.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("what")}>Back</Button>
            <Button disabled={busy || statement.trim().length < 10} onClick={saveDraft}>Save and review</Button>
          </div>
        </Card>
      )}

      {step === "review" && draft && item && (
        <Card className="p-4 space-y-3 text-sm">
          <h2 className="font-semibold">4. Review before you confirm</h2>
          <p><strong>Item:</strong> {item.furnisherName} · {item.bureau}</p>
          <p><strong>What you believe is wrong:</strong> {CATEGORIES.find((c) => c.value === draft.category)?.label}</p>
          <p><strong>Your words:</strong> “{draft.statement}”</p>
          {uploadsEnabled && (
            <form
              className="space-y-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                upload(e.currentTarget);
              }}
            >
              <p className="text-xs font-medium">Optional: a document that supports this (PDF, PNG, JPEG, WebP; 10 MB max)</p>
              <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" aria-label="Document" />
              <input name="description" placeholder="What is this document?" className="block w-full border rounded px-2 py-1" />
              <Button variant="secondary" disabled={busy}>Attach</Button>
            </form>
          )}
          <p className="text-xs text-gray-600">
            By confirming, you are telling us this is accurate to the best of your knowledge. It will not be changed after you confirm.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("words")}>Back</Button>
            <Button disabled={busy} onClick={confirm}>Confirm</Button>
          </div>
        </Card>
      )}

      {view.documents.length > 0 && (
        <Card className="p-4 text-sm space-y-2">
          <h2 className="font-semibold">Documents you have sent us</h2>
          {view.documents.map((d) => (
            <div key={d.id} className="border-t pt-2 flex items-center gap-2">
              <span>{d.description}{d.fileName ? ` (${d.fileName})` : ""}</span>
              {uploadsEnabled && (
                <Button variant="secondary" onClick={async () => { const r = await getMyDocumentLink(d.id); if (r.ok) window.open(r.data, "_blank", "noopener"); else setError(r.error); }}>
                  View (2-minute link)
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      {view.statements.length > 0 && (
        <Card className="p-4 text-sm space-y-2">
          <h2 className="font-semibold">What you have told us</h2>
          {view.statements.map((s) => (
            <div key={s.id} className="border-t pt-2">
              <p>“{s.statement}”</p>
              <p className="text-xs text-gray-500">
                {s.status === "active" ? `Confirmed ${s.confirmedAt?.slice(0, 10)}` : s.status === "draft" ? "Draft — not confirmed" : "Withdrawn"}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
