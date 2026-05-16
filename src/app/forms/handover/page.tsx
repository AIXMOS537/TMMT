"use client";

import { useState } from "react";
import { submitHandover } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Car, CheckCircle, ClipboardCheck } from "lucide-react";

const fuelLevels = ["Empty", "1/4", "1/2", "3/4", "Full"];

export default function HandoverForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoverType, setHandoverType] = useState("Pickup");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submitHandover(fd);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Handover Complete!</h2>
          <p className="text-gray-600 dark:text-slate-400">The vehicle handover has been recorded successfully.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Car className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">TMMT Rentals</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">Vehicle Handover Checklist</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Complete this checklist when picking up or returning a vehicle</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <input type="hidden" name="handover_type" value={handoverType} />
            {/* Handover Type Toggle */}
            <div className="flex gap-2">
              {["Pickup", "Return"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setHandoverType(type)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    handoverType === type
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700"
                  }`}
                >
                  Vehicle {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Customer Name" required>
                <input name="customer_name" className={inputClass} required />
              </FormField>
              <FormField label="Staff Member" required>
                <input name="staff_name" className={inputClass} required />
              </FormField>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Vehicle Info</h3>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Make"><input name="vehicle_make" className={inputClass} /></FormField>
                <FormField label="Model"><input name="vehicle_model" className={inputClass} /></FormField>
                <FormField label="License Plate"><input name="license_plate" className={inputClass} /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="Odometer Reading" required>
                  <input name="odometer_reading" type="number" className={inputClass} required />
                </FormField>
                <FormField label="Fuel Level" required>
                  <select name="fuel_level" className={selectClass} required>
                    <option value="">Select...</option>
                    {fuelLevels.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Condition Checklist</h3>
              <div className="space-y-3">
                {[
                  { name: "check_exterior", label: "Exterior — No new scratches, dents, or damage" },
                  { name: "check_interior", label: "Interior — Clean, no damage to seats/dashboard" },
                  { name: "check_tires", label: "Tires — Good condition, proper pressure" },
                  { name: "check_lights", label: "Lights — All headlights, brake lights, and signals working" },
                  { name: "check_documents", label: "Documents — Registration, insurance card present" },
                ].map((item) => (
                  <label key={item.name} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      name={item.name}
                      className="mt-0.5 h-5 w-5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <FormField label="Condition Notes">
              <textarea name="condition_notes" rows={3} className={inputClass} placeholder="Note any damage, scratches, or issues observed..." />
            </FormField>

            <FormField label="Customer Signature (Type Full Name)" required>
              <input name="customer_signature" className={inputClass} required placeholder="Type your full legal name as signature" />
            </FormField>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Recording..." : `Complete ${handoverType} Handover`}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
