"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitPartnerApply } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Car, CheckCircle } from "lucide-react";

/**
 * The supply-side front door.
 *
 * /forms/* is already public in middleware, so a car owner can reach this without
 * an account. Everything here is deliberately short: name, number, what the car
 * is. The gates that actually decide the deal — commercial-use insurance, title,
 * and the split — are worked by a human afterwards, and the RLS policy on
 * partner_acquisition refuses any submission that tries to arrive pre-cleared.
 *
 * The finance question is asked because a financed car is fine, but only if the
 * owner's payout clears their note. Asking now avoids a partner who quits in
 * month 2 when they realise the maths never worked.
 */

const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export default function PartnerApplyForm() {
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

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    for (const [k, v] of Object.entries(attribution.current)) formData.set(k, v);
    const res = await submitPartnerApply(formData);
    setLoading(false);
    if (res.success) setSubmitted(true);
    else setError(res.error);
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-600" />
            <div>
              <h1 className="text-xl font-semibold">Got it — we&apos;ll call you.</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#41527a]">
                One thing to start looking into now, because it decides everything else:
                <strong> whether your insurance allows the car to be rented out.</strong> A normal
                personal policy usually stops covering the moment a car earns money, so we cannot
                put it on the road until that is sorted. Ask your carrier about commercial or
                rental use and we will walk you through the rest.
              </p>
              <Link className="mt-4 inline-block text-sm font-semibold underline" href="/">
                Back to TMMT
              </Link>
            </div>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <div className="mb-6 flex items-center gap-3">
        <Car className="h-7 w-7 text-[#0A1628]" />
        <h1 className="text-2xl font-semibold text-[#0A1628]">Put your car to work</h1>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-[#41527a]">
        If you own a car that is sitting still, we rent it to screened drivers and you take a share
        of every week it earns. You keep the title. We handle the renter, the paperwork and the
        chasing.
      </p>

      <Card>
        <form action={onSubmit} className="space-y-4">
          <FormField label="Your name">
            <input id="owner_name" name="owner_name" required maxLength={200} className={inputClass} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone">
              <input id="phone" name="phone" type="tel" required maxLength={20} className={inputClass} />
            </FormField>
            <FormField label="Email (optional)">
              <input id="email" name="email" type="email" maxLength={254} className={inputClass} />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Year">
              <input id="vehicle_year" name="vehicle_year" inputMode="numeric" maxLength={4} className={inputClass} />
            </FormField>
            <FormField label="Make">
              <input id="vehicle_make" name="vehicle_make" maxLength={60} className={inputClass} />
            </FormField>
            <FormField label="Model">
              <input id="vehicle_model" name="vehicle_model" maxLength={60} className={inputClass} />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Mileage (roughly)">
              <input id="mileage" name="mileage" inputMode="numeric" maxLength={9} className={inputClass} />
            </FormField>
            <FormField label="Is it paid off?">
              <select id="finance_status" name="finance_status" defaultValue="" className={selectClass}>
                <option value="">Select…</option>
                <option value="Owned outright">Paid off</option>
                <option value="Financed">Still financing it</option>
                <option value="Leased">Leased</option>
              </select>
            </FormField>
          </div>

          <FormField
            label="If you're still paying it off, what's the monthly payment?"
          >
            <input
              id="monthly_note_payment"
              name="monthly_note_payment"
              inputMode="decimal"
              maxLength={12}
              placeholder="e.g. 420"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[#41527a]">
              We ask because your share has to clear that payment. If it doesn&apos;t, the deal
              doesn&apos;t work for you and we&apos;ll say so.
            </p>
          </FormField>

          <FormField label="Who insures it now? (optional)">
            <input id="insurance_carrier" name="insurance_carrier" maxLength={120} className={inputClass} />
          </FormField>

          <FormField label="Anything else we should know?">
            <textarea id="notes" name="notes" rows={3} maxLength={2000} className={inputClass} />
          </FormField>

          {error && <ErrorBanner message={error} />}

          <Button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send it"}
          </Button>

          <p className="text-xs leading-relaxed text-[#41527a]">
            Sending this doesn&apos;t commit you to anything. Not every car is a fit — the usual
            blocker is insurance, since a personal policy generally stops covering a car the moment
            it earns money. We&apos;ll tell you either way.
          </p>
        </form>
      </Card>
    </main>
  );
}
