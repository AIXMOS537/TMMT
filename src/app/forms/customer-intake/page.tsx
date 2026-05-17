"use client";

import { useState } from "react";
import { submitCustomerIntake } from "@/app/workflow-actions";
import {
  Card,
  FormField,
  inputClass,
  selectClass,
  Button,
  ErrorBanner,
} from "@/components/ui";
import { INTAKE_REQUEST_TYPES } from "@/lib/workflow";
import { ClipboardList, CheckCircle } from "lucide-react";

const priorityOptions = ["Urgent", "Moderate", "Standard"];

export default function CustomerIntakePage() {
  const [submitted, setSubmitted] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submitCustomerIntake(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCaseId(result.id ?? null);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Request received
          </h2>
          <p className="text-gray-600 dark:text-slate-400 text-sm">
            We created a trackable case for your request. Our team will review it and follow up
            shortly.
          </p>
          {caseId && (
            <p className="mt-4 text-xs font-mono text-gray-500 dark:text-slate-500">
              Reference: {caseId.slice(0, 8).toUpperCase()}
            </p>
          )}
          <Button className="mt-6" onClick={() => { setSubmitted(false); setCaseId(null); }}>
            Submit another request
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">TMMT</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">
            Customer intake
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            Every submission becomes a tracked case for our operations team
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Full name" required>
              <input name="contact_name" className={inputClass} required placeholder="Jane Smith" />
            </FormField>
            <FormField label="Phone" required>
              <input name="phone" type="tel" className={inputClass} required placeholder="(555) 123-4567" />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" className={inputClass} placeholder="you@email.com" />
            </FormField>
            <FormField label="What do you need?" required>
              <select name="request_type" className={selectClass} required defaultValue="rental_inquiry">
                {INTAKE_REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Urgency">
              <select name="priority" className={selectClass} defaultValue="">
                <option value="">Select…</option>
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Details">
              <textarea
                name="description"
                rows={4}
                className={inputClass}
                placeholder="Describe your request — vehicle, location, timing, etc."
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
