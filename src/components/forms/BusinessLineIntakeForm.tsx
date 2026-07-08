"use client";

import { useState } from "react";
import Link from "next/link";
import { submitBusinessLineIntake } from "@/app/forms/actions";
import type { TmmtBusinessLine } from "@/lib/business-lines/registry";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { CheckCircle } from "lucide-react";

const REQUEST_LABELS: Record<string, string> = {
  rental_booking: "Rental / booking",
  rental_support: "Rental support",
  maintenance: "Maintenance",
  repair: "Repair",
  detail: "Detailing",
  tow: "Tow / transport",
  inspection: "Inspection",
  delivery: "Delivery / logistics",
  content: "Content / media",
  other: "Other",
};

type Props = {
  line: TmmtBusinessLine;
};

export function BusinessLineIntakeForm({ line }: Props) {
  const intake = line.intake!;
  const [submitted, setSubmitted] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("business_line", line.id);
    const result = await submitBusinessLineIntake(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRefCode(result.refCode ?? null);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request received</h2>
          <p className="text-gray-600 dark:text-slate-400">
            {intake.title} — we&apos;ll follow up shortly.
            {refCode ? ` Reference: ${refCode}` : null}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => { setSubmitted(false); setRefCode(null); }}>Submit another</Button>
            <Link href="/kits" className="text-sm text-blue-600 hover:underline">
              View dealer kits & pricing
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
            TMMT · {line.shortName}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{intake.title}</h1>
          <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">{intake.description}</p>
        </div>

        <Card className={`p-6 bg-gradient-to-br ${intake.accent}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Contact name" required>
              <input name="customer_name" className={inputClass} required placeholder="Your name" />
            </FormField>
            <FormField label="Phone" required>
              <input name="customer_phone" type="tel" className={inputClass} required placeholder="[phone removed]" />
            </FormField>
            <FormField label="Email">
              <input name="customer_email" type="email" className={inputClass} placeholder="you@dealership.com" />
            </FormField>
            <FormField label="Request type">
              <select name="request_type" className={selectClass} defaultValue={intake.requestTypes[0] ?? "other"}>
                {intake.requestTypes.map((t) => (
                  <option key={t} value={t}>{REQUEST_LABELS[t] ?? t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Subject" required>
              <input
                name="subject"
                className={inputClass}
                required
                placeholder={intake.subjectPlaceholder}
              />
            </FormField>
            <FormField label="Details">
              <textarea
                name="details"
                rows={4}
                className={inputClass}
                placeholder={intake.detailsPlaceholder}
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit request"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          Dealership operators:{" "}
          <Link href="/kits" className="text-blue-600 hover:underline">see kits & pricing</Link>
          {" · "}
          <Link href="/forms/lead-intake" className="text-blue-600 hover:underline">general inquiry</Link>
        </p>
      </div>
    </div>
  );
}
