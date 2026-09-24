"use client";

import { useState } from "react";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { CheckCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { submitPartnerOptIn } from "./actions";
import { PARTNER_NAME } from "@/lib/partner-handoff";

const INTERESTS = [
  ["credit", "Credit guidance"],
  ["funding", "Business funding"],
  ["both", "Both"],
  ["other", "Something else"],
] as const;

export default function OptInForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const res = await submitPartnerOptIn(formData);
    setBusy(false);
    if (res.success) setHandoffUrl(res.handoffUrl);
    else setError(res.error);
  }

  if (handoffUrl) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              You&apos;re on our list, and the introduction is ready.
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
              We kept your details on the TMMT side so we can follow up either way.
              The last step is yours — open {PARTNER_NAME} when you&apos;re ready.
            </p>
            <a
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              href={handoffUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              Open {PARTNER_NAME}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form action={onSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <FormField label="Your name" required>
          <input className={inputClass} maxLength={200} name="contact_name" required />
        </FormField>

        <FormField label="Phone" required>
          <input className={inputClass} maxLength={20} name="phone" required type="tel" />
        </FormField>

        <FormField label="Email">
          <input className={inputClass} maxLength={254} name="email" type="email" />
        </FormField>

        <FormField label="What do you want help with?" required>
          <select className={selectClass} defaultValue="credit" name="interest" required>
            {INTERESTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Anything else we should pass along?">
          <textarea className={inputClass} maxLength={2000} name="notes" rows={3} />
        </FormField>

        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-slate-600 dark:bg-slate-800">
          {/* No default. Nothing leaves TMMT unless this is ticked. */}
          <input className="mt-0.5 h-4 w-4" name="consent" required type="checkbox" value="yes" />
          <span className="text-gray-700 dark:text-slate-300">
            Yes — introduce me to {PARTNER_NAME} and share the details above with them.
            I understand they are a separate company from TMMT.
          </span>
        </label>

        <Button disabled={busy} type="submit">
          {busy ? "Sending…" : "Request the introduction"}
        </Button>

        <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Leave the box unticked and nothing is shared — you stay with TMMT and we
          follow up ourselves.
        </p>
      </form>
    </Card>
  );
}
