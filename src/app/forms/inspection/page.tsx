"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, FormField, inputClass, Button } from "@/components/ui";
import { Car, CheckCircle, Camera } from "lucide-react";

export default function CustomerInspectionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (v) {
        if (k === "interior_clean" || k === "exterior_clean" || k === "confirmation") {
          record[k] = true;
        } else if (k === "odometer_reading") {
          record[k] = Number(v);
        } else {
          record[k] = v;
        }
      }
    });
    record.date_time = new Date().toISOString();

    const { error } = await supabase.from("customer_inspection_photos").insert(record);
    setLoading(false);
    if (error) { alert("Error: " + error.message); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Inspection Submitted!</h2>
          <p className="text-gray-600">Your vehicle inspection record has been saved. Safe travels!</p>
          <Button className="mt-6" onClick={() => setSubmitted(false)}>Submit Another</Button>
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
            <Camera className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Vehicle Inspection Form</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Complete before leaving TMMT premises</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Your Full Name" required>
              <input name="full_name" className={inputClass} required />
            </FormField>

            <FormField label="Odometer Reading" required>
              <input name="odometer_reading" type="number" className={inputClass} required placeholder="e.g., 45230" />
            </FormField>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Vehicle Condition</h3>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" name="interior_clean" value="true" className="h-4 w-4 text-blue-600 rounded" />
                  <div>
                    <span className="font-medium text-sm text-gray-900">Interior is clean</span>
                    <p className="text-xs text-gray-500">No trash, seats wiped, dashboard clean</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" name="exterior_clean" value="true" className="h-4 w-4 text-blue-600 rounded" />
                  <div>
                    <span className="font-medium text-sm text-gray-900">Exterior is clean</span>
                    <p className="text-xs text-gray-500">No visible damage, car washed</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">Photo Requirements</p>
              <ul className="mt-2 text-xs text-amber-700 list-disc list-inside space-y-1">
                <li>All 4 sides of the vehicle</li>
                <li>Dashboard / odometer</li>
                <li>Interior (front & back seats)</li>
                <li>Any existing damage</li>
              </ul>
              <p className="mt-2 text-xs text-amber-600">Email photos to the office or upload in-person</p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="confirmation" value="true" required className="h-4 w-4 text-blue-600 rounded mt-1" />
                <span className="text-sm text-gray-700">
                  I confirm that the above details accurately reflect the vehicle&apos;s condition before leaving TMMT Rentals premises.
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Inspection"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
