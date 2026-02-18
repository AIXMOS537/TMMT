"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, FormField, inputClass, selectClass, Button } from "@/components/ui";
import { Car, CheckCircle } from "lucide-react";

const priorityOptions = ["Urgent", "Moderate", "Requires Follow Up"];

export default function LeadIntakeForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = { status: "New Lead" };
    fd.forEach((v, k) => { if (v) record[k] = k === "phone" ? Number(v) : v; });

    const { error } = await supabase.from("incoming_leads").insert(record);
    setLoading(false);
    if (error) { alert("Error submitting: " + error.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600">Your inquiry has been submitted. We&apos;ll reach out to you shortly.</p>
          <Button className="mt-6" onClick={() => { setSubmitted(false); }}>Submit Another</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Car className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">TMMT Rentals</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Vehicle Rental Inquiry</h1>
          <p className="text-gray-500 text-sm mt-1">Fill out the form below and we&apos;ll get back to you</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
