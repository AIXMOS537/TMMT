"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, FormField, inputClass, selectClass, Button } from "@/components/ui";
import { Car, CheckCircle, ShieldCheck } from "lucide-react";

const insuranceOptions = ["Yes", "No"];

export default function BackgroundCheckForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {
      background_check_status: "Pending",
      insurance_check_status: "Pending",
      earnings_verification_status: "Pending",
    };
    fd.forEach((v, k) => {
      if (v) {
        if (k === "verification_form_submitted") record[k] = true;
        else record[k] = v;
      }
    });
    record.verification_form_submitted = true;

    const { error } = await supabase.from("background_checks").insert(record);
    setLoading(false);
    if (error) { alert("Error: " + error.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Submitted!</h2>
          <p className="text-gray-600">Your background check information has been received. We&apos;ll review and update you on your eligibility status.</p>
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
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h1 className="text-xl font-semibold text-gray-800">Background Check & Verification</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Required information for your rental application</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Full Name" required>
              <input name="customer_name" className={inputClass} required />
            </FormField>
            <FormField label="Phone Number" required>
              <input name="phone_number" type="tel" className={inputClass} required />
            </FormField>
            <FormField label="Email" required>
              <input name="email" type="email" className={inputClass} required />
            </FormField>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Insurance Information</h3>
              <FormField label="Do you have your own insurance?" required>
                <select name="own_insurance" className={selectClass} required>
                  <option value="">Select...</option>
                  {insuranceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Additional Notes</h3>
              <FormField label="Review Notes (if any)">
                <textarea name="review_notes" rows={3} className={inputClass} placeholder="Any additional information..." />
              </FormField>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium">Document Requirements</p>
              <ul className="mt-2 list-disc list-inside space-y-1 text-blue-700">
                <li>Driver&apos;s License (front & back)</li>
                <li>Proof of Insurance (if applicable)</li>
                <li>Recent Paystub or earnings proof</li>
              </ul>
              <p className="mt-2 text-xs text-blue-600">Upload documents via email or bring to your appointment</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Verification Form"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
