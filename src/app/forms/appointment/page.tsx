"use client";

import { useState } from "react";
import { submitAppointment } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Car, CheckCircle, CalendarDays } from "lucide-react";

const appointmentTypes = [
  "Vehicle Pickup",
  "Vehicle Return",
  "Inspection",
  "Insurance Review",
  "Payment Discussion",
  "General Inquiry",
];

const timeSlots = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM",
];

export default function AppointmentForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submitAppointment(fd);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setSubmitted(true);
  };

  // Minimum date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Scheduled!</h2>
          <p className="text-gray-600 dark:text-slate-400">We&apos;ll send you a confirmation. If you need to reschedule, please call us.</p>
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
            <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">Schedule an Appointment</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Book a time to visit us</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Full Name" required>
              <input name="customer_name" className={inputClass} required />
            </FormField>
            <FormField label="Phone" required>
              <input name="phone" type="tel" className={inputClass} required />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" className={inputClass} />
            </FormField>

            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Appointment Details</h3>
              <FormField label="Appointment Type" required>
                <select name="appointment_type" className={selectClass} required>
                  <option value="">Select type...</option>
                  {appointmentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="Date" required>
                  <input name="appointment_date" type="date" min={minDate} className={inputClass} required />
                </FormField>
                <FormField label="Time" required>
                  <select name="appointment_time" className={selectClass} required>
                    <option value="">Select time...</option>
                    {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            <FormField label="Notes">
              <textarea name="notes" rows={3} className={inputClass} placeholder="Anything we should know before your appointment..." />
            </FormField>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
