"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { submitLeadIntake } from "@/app/forms/actions";
import { trackEvent } from "@/lib/analytics";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Car, CheckCircle } from "lucide-react";
import BrandName from "@/components/brand/BrandName";
import { offerLabel } from "@/lib/offer-labels";

const priorityOptions = ["Urgent", "Moderate", "Requires Follow Up"];

const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function inferSource(utmSource: string, referrer: string): string {
  if (utmSource) return utmSource.toLowerCase();
  const r = referrer.toLowerCase();
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("instagram")) return "ig";
  if (r.includes("snapchat")) return "snap";
  if (r.includes("facebook.com") || r.includes("fb.com") || r.includes("m.facebook")) return "meta";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("google") || r.includes("bing") || r.includes("duckduckgo")) return "organic";
  if (r) return "referral";
  return "direct";
}

export default function LeadIntakeForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // useSearchParams, not window.location in an effect: it is stable across the
  // server and client passes, so the heading is right on first paint instead of
  // flipping after hydration.
  const offer = offerLabel(useSearchParams().get("offer"));
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
    attr.source = inferSource(attr.utm_source ?? "", document.referrer);
    attr.source_campaign = attr.utm_campaign ?? params.get("campaign") ?? "";
    attr.source_medium = attr.utm_medium ?? "";
    // Carry the offer id itself, so a lead from a money CTA is identifiable on
    // the row and not only inferable from utm_campaign.
    const offerId = params.get("offer");
    if (offerId) attr.utm_content = attr.utm_content || offerId;
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
    const result = await submitLeadIntake(fd);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    trackEvent("lead_intake_submitted", {
      platform: "web",
      source: attribution.current.source ?? "direct",
      source_medium: attribution.current.source_medium ?? "",
      source_campaign: attribution.current.source_campaign ?? "",
      priority_level: String(fd.get("priority_level") ?? ""),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 dark:text-slate-400">Your inquiry has been submitted. We&apos;ll reach out to you shortly.</p>
          <Button className="mt-6" onClick={() => { setSubmitted(false); }}>Submit Another</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Car className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <BrandName className="text-2xl font-bold text-gray-900 dark:text-white" />
          </div>
          {/*
            The heading follows what they clicked. This form is the fallback
            for every money CTA whose checkout link is not configured yet, so a
            fixed "Vehicle Rental Inquiry" told a $50K buyer they were in the
            wrong place. An unrecognised or absent ?offer= keeps the rental
            wording, which is what a direct visitor is here for.
          */}
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">
            {offer ? "Request Details" : "Vehicle Rental Inquiry"}
          </h1>
          {offer ? (
            <p className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {offer}
            </p>
          ) : null}
          <p className="text-gray-500 text-sm mt-1">
            {offer
              ? "Tell us how to reach you and we'll take it from here."
              : "Fill out the form below and we'll get back to you"}
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Full Name" required>
              <input name="contact_name" className={inputClass} required placeholder="John Doe" />
            </FormField>
            <FormField label="Phone Number" required>
              <input name="phone" type="tel" className={inputClass} required placeholder="(555) 123-4567" />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" className={inputClass} placeholder="john@example.com" />
            </FormField>
            <FormField label="What are you looking for?">
              <input name="opportunity_name" className={inputClass} placeholder="e.g., Weekly sedan rental for rideshare" />
            </FormField>
            <FormField label="How urgent is your need?">
              <select name="priority_level" className={selectClass}>
                <option value="">Select urgency...</option>
                {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Additional Notes">
              <textarea name="notes" rows={3} className={inputClass} placeholder="Any details about your rental needs..." />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Inquiry"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
