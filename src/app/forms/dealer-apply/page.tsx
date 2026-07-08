"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitDealerApply } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Building2, CheckCircle } from "lucide-react";

const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

export default function DealerApplyForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attribution = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const attr: Record<string, string> = {};
    for (const k of ATTRIBUTION_FIELDS) {
      const v = params.get(k);
      if (v) attr[k] = v;
    }
    attr.referrer_url = document.referrer || "";
    attr.landing_url = window.location.href;
    attribution.current = attr;
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    for (const [k, v] of Object.entries(attribution.current)) {
      if (v) fd.set(k, v);
    }
    const result = await submitDealerApply(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application received</h2>
          <p className="text-gray-600 dark:text-slate-400">
            We&apos;ll reach out within 1 business day with your dedicated demo and setup plan.
            Your data stays yours — separate instance, your keys.
          </p>
          <Link href="/kits" className="mt-6 inline-block text-[#1440C4] font-semibold hover:underline">
            View kits & pricing
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">TMMT × AIXMOS</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">
            Independent dealer application
          </h1>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            Mom-and-pop lots welcome. Your own TMMT stack — your customers, your fleet, your data.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Dealership name" required>
              <input name="dealership_name" className={inputClass} required placeholder="Main Street Motors" />
            </FormField>
            <FormField label="Your name" required>
              <input name="contact_name" className={inputClass} required placeholder="Jane Smith" />
            </FormField>
            <FormField label="Your role" required>
              <select name="role" className={selectClass} required defaultValue="">
                <option value="" disabled>Select role...</option>
                {["Owner", "GM", "F&I Manager", "Sales Manager", "Other"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Phone" required>
              <input name="phone" type="tel" className={inputClass} required placeholder="[phone removed]" />
            </FormField>
            <FormField label="Email" required>
              <input name="email" type="email" className={inputClass} required placeholder="owner@lot.com" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="City" required>
                <input name="city" className={inputClass} required placeholder="Richmond" />
              </FormField>
              <FormField label="State" required>
                <select name="state" className={selectClass} required defaultValue="">
                  <option value="" disabled>ST</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Units sold per month (approx.)">
              <select name="units_per_month" className={selectClass} defaultValue="">
                <option value="">Select...</option>
                {["Under 25", "25-50", "50-100", "100+"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Interested package">
              <select name="interested_package" className={selectClass} defaultValue="">
                <option value="">Select package...</option>
                <option value="Ops Kit">Ops Kit — $997 + $297/mo</option>
                <option value="Dealer Bundle">Dealer Bundle — $3,497 + $697/mo</option>
              </select>
            </FormField>
            <FormField label="What are you trying to fix?">
              <textarea
                name="notes"
                rows={3}
                className={inputClass}
                placeholder="Fleet tracking, lead capture, staff logins, declined-buyer follow-up..."
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Apply — get my demo"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-500">
          Dedicated instance per dealer. Not a shared login.{" "}
          <Link href="/kits" className="text-[#1440C4] hover:underline">See pricing</Link>
        </p>
      </div>
    </div>
  );
}
