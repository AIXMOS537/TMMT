"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, FormField, inputClass, selectClass, Button } from "@/components/ui";
import { Car, CheckCircle, AlertTriangle } from "lucide-react";

const issueTypes = [
  "Mechanical Issue",
  "Electrical Issue",
  "Body Damage",
  "Flat Tire",
  "Accident",
  "Locked Out",
  "Battery Dead",
  "Check Engine Light",
  "A/C or Heating",
  "Windshield/Glass",
  "Other",
];

const urgencyLevels = ["Low", "Medium", "High", "Emergency"];

export default function TicketForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {
      status: "Open",
      created_at: new Date().toISOString(),
    };
    fd.forEach((v, k) => {
      if (v) record[k] = v;
    });

    const { error } = await supabase.from("tickets").insert(record);
    setLoading(false);
    if (error) { alert("Error: " + error.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket Submitted</h2>
          <p className="text-gray-600">Our team has been notified. We&apos;ll reach out shortly to assist you.</p>
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
          <div className="flex items-center justify-center gap-2 mt-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-semibold text-gray-800">Report an Issue</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Let us know about a problem with your rental vehicle</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Your Name" required>
              <input name="customer_name" className={inputClass} required />
            </FormField>
            <FormField label="Phone" required>
              <input name="phone" type="tel" className={inputClass} required />
            </FormField>
            <FormField label="Vehicle (Make/Model/Year)">
              <input name="vehicle_description" className={inputClass} placeholder="e.g., 2022 Toyota Camry" />
            </FormField>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Issue Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Issue Type" required>
                  <select name="issue_type" className={selectClass} required>
                    <option value="">Select type...</option>
                    {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Urgency" required>
                  <select name="urgency" className={selectClass} required>
                    <option value="">Select urgency...</option>
                    {urgencyLevels.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Description" required>
                <textarea name="description" rows={4} className={inputClass} required placeholder="Please describe the issue in detail..." />
              </FormField>
              <FormField label="Current Location">
                <input name="location" className={inputClass} placeholder="Where is the vehicle right now?" />
              </FormField>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Emergency?</strong> If you&apos;re in an unsafe situation or there&apos;s been an accident, please call 911 first, then contact us directly.
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Ticket"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
