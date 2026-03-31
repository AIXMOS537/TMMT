"use client";

import { useState } from "react";
import { submitOnboardingInspection } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Car, CheckCircle, Search } from "lucide-react";

const conditionOptions = ["Excellent", "Good", "Fair", "Poor", "N/A"];
const yesNo = ["Yes", "No"];

export default function OnboardingInspectionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submitOnboardingInspection(fd);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Inspection Complete!</h2>
          <p className="text-gray-600 dark:text-slate-400">Vehicle onboarding inspection has been recorded. The vehicle is ready for the fleet.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Car className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">TMMT Rentals</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">Vehicle Onboarding Inspection</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Complete all sections before adding a vehicle to the fleet</p>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(s)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    step === s ? "bg-blue-600 text-white" : step > s ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                  }`}
                >
                  {s}
                </button>
                {s < 4 && <div className={`w-8 h-0.5 ${step > s ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"}`} />}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {["Vehicle Info", "Mechanical", "Cleanliness & Tracking", "Documents & Final"][step - 1]}
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            {/* Step 1: Vehicle Information */}
            <div className={step === 1 ? "" : "hidden"}>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">Step 1: Vehicle Information</h3>
              <FormField label="Inspector Name" required>
                <input name="inspector_name" className={inputClass} required />
              </FormField>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <FormField label="Make" required><input name="make" className={inputClass} required /></FormField>
                <FormField label="Model" required><input name="model" className={inputClass} required /></FormField>
                <FormField label="Year" required><input name="year" className={inputClass} required placeholder="2024" /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="VIN" required><input name="vin" className={inputClass} required placeholder="17 characters" /></FormField>
                <FormField label="License Plate"><input name="license_plate" className={inputClass} /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="Color"><input name="color" className={inputClass} /></FormField>
                <FormField label="Odometer" required>
                  <input name="odometer" type="number" className={inputClass} required />
                </FormField>
              </div>
            </div>

            {/* Step 2: Mechanical Inspection */}
            <div className={step === 2 ? "" : "hidden"}>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">Step 2: Mechanical Inspection</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: "engine_condition", label: "Engine Condition" },
                  { name: "transmission_condition", label: "Transmission" },
                  { name: "brake_condition", label: "Brakes" },
                  { name: "suspension_condition", label: "Suspension" },
                  { name: "exhaust_condition", label: "Exhaust" },
                  { name: "ac_heater_condition", label: "A/C & Heater" },
                  { name: "electrical_condition", label: "Electrical Systems" },
                  { name: "lights_condition", label: "Lights (All)" },
                ].map((item) => (
                  <FormField key={item.name} label={item.label}>
                    <select name={item.name} className={selectClass}>
                      <option value="">Select...</option>
                      {conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>
                ))}
              </div>

              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Tire Pressure (PSI)</h4>
                <div className="grid grid-cols-4 gap-3">
                  <FormField label="Front Left"><input name="tire_pressure_fl" type="number" className={inputClass} /></FormField>
                  <FormField label="Front Right"><input name="tire_pressure_fr" type="number" className={inputClass} /></FormField>
                  <FormField label="Rear Left"><input name="tire_pressure_rl" type="number" className={inputClass} /></FormField>
                  <FormField label="Rear Right"><input name="tire_pressure_rr" type="number" className={inputClass} /></FormField>
                </div>
              </div>

              <FormField label="Tire Condition">
                <select name="tire_condition" className={selectClass}>
                  <option value="">Select...</option>
                  {conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>

              <FormField label="Mechanical Notes">
                <textarea name="mechanical_notes" rows={3} className={inputClass} placeholder="Any mechanical issues or observations..." />
              </FormField>
            </div>

            {/* Step 3: Cleanliness & Tracking */}
            <div className={step === 3 ? "" : "hidden"}>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">Step 3: Cleanliness & Tracking</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Exterior Condition">
                  <select name="exterior_condition" className={selectClass}>
                    <option value="">Select...</option>
                    {conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Interior Condition">
                  <select name="interior_condition" className={selectClass}>
                    <option value="">Select...</option>
                    {conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Exterior Clean?">
                <select name="exterior_clean" className={selectClass}>
                  <option value="">Select...</option>
                  {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
              <FormField label="Interior Clean?">
                <select name="interior_clean" className={selectClass}>
                  <option value="">Select...</option>
                  {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-3">GPS / Tracker</h4>
                <FormField label="GPS Tracker Installed?">
                  <select name="tracker_installed" className={selectClass}>
                    <option value="">Select...</option>
                    {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Tracker Type/ID">
                  <input name="tracker_id" className={inputClass} placeholder="Tracker serial number or type" />
                </FormField>
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-3">Keys</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Number of Keys">
                    <select name="key_count" className={selectClass}>
                      <option value="">Select...</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3+">3+</option>
                    </select>
                  </FormField>
                  <FormField label="Key Fob Working?">
                    <select name="key_fob_working" className={selectClass}>
                      <option value="">Select...</option>
                      {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </FormField>
                </div>
              </div>
            </div>

            {/* Step 4: Documents & Final */}
            <div className={step === 4 ? "" : "hidden"}>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">Step 4: Documents & Final Review</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Registration on File?">
                  <select name="registration_on_file" className={selectClass}>
                    <option value="">Select...</option>
                    {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Insurance on File?">
                  <select name="insurance_on_file" className={selectClass}>
                    <option value="">Select...</option>
                    {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Title on File?">
                  <select name="title_on_file" className={selectClass}>
                    <option value="">Select...</option>
                    {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Smog/Emissions Current?">
                  <select name="smog_current" className={selectClass}>
                    <option value="">Select...</option>
                    {yesNo.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Overall Rating" required>
                <select name="overall_rating" className={selectClass} required>
                  <option value="">Select rating...</option>
                  <option value="Fleet Ready">Fleet Ready — No issues</option>
                  <option value="Conditional">Conditional — Minor items to address</option>
                  <option value="Needs Work">Needs Work — Repairs required before fleet use</option>
                  <option value="Rejected">Rejected — Not suitable for fleet</option>
                </select>
              </FormField>

              <FormField label="Additional Notes / Summary">
                <textarea name="notes" rows={4} className={inputClass} placeholder="Overall summary, items to follow up on, etc." />
              </FormField>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mt-4">
                <strong>Note:</strong> Photos should be taken separately and uploaded to the vehicle&apos;s record in the fleet management system.
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 font-medium hover:bg-gray-50 dark:bg-slate-900 transition-colors"
                >
                  Back
                </button>
              )}
              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  Next Step
                </button>
              ) : (
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Submitting..." : "Complete Inspection"}
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
