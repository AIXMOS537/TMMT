"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, FormField, inputClass, selectClass, Button } from "@/components/ui";
import { Car, CheckCircle, CalendarCheck } from "lucide-react";

const vehicleTypes = ["Compact/Hatchback", "Sedan", "SUV", "Minivan", "Electric/Hybrid"];

export default function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {
      status: "Waiting",
      date_added: new Date().toISOString().split("T")[0],
    };
    fd.forEach((v, k) => {
      if (v) {
        if (k === "year") record[k] = Number(v);
        else if (k === "desired_weekly_payment") record[k] = Number(v);
        else record[k] = v;
      }
    });

    const { error } = await supabase.from("waitlist").insert(record);
    setLoading(false);
    if (error) { alert("Error: " + error.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re on the List!</h2>
          <p className="text-gray-600 dark:text-slate-400">We&apos;ll contact you as soon as a matching vehicle becomes available.</p>
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
            <span className="text-2xl font-bold text-gray-900 dark:text-white">TMMT Rentals</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <CalendarCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">Join the Waitlist</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Let us know what vehicle you&apos;re looking for</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Full Name" required>
              <input name="customer_name" className={inputClass} required />
            </FormField>
            <FormField label="Phone" required>
              <input name="customer_phone" type="tel" className={inputClass} required />
            </FormField>
            <FormField label="Email">
              <input name="customer_email" type="email" className={inputClass} />
            </FormField>
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Vehicle Preferences</h3>
              <FormField label="Vehicle Type">
                <select name="vehicle_type" className={selectClass}>
                  <option value="">Any type</option>
                  {vehicleTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <FormField label="Make"><input name="make" className={inputClass} placeholder="e.g., Toyota" /></FormField>
                <FormField label="Model"><input name="model" className={inputClass} placeholder="e.g., Camry" /></FormField>
                <FormField label="Year"><input name="year" type="number" className={inputClass} placeholder="2022" /></FormField>
              </div>
            </div>
            <FormField label="Desired Weekly Payment ($)">
              <input name="desired_weekly_payment" type="number" step="0.01" className={inputClass} placeholder="e.g., 300" />
            </FormField>
            <FormField label="Additional Notes">
              <textarea name="desired_specs_notes" rows={3} className={inputClass} placeholder="Any other preferences or requirements..." />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Join Waitlist"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
