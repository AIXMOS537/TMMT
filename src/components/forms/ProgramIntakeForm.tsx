"use client";

import { useState } from "react";
import { submitProgramIntake } from "@/app/forms/actions";
import { Card, FormField, inputClass, Button, ErrorBanner } from "@/components/ui";
import { CheckCircle } from "lucide-react";
import BrandName from "@/components/brand/BrandName";

type Props = {
  formSlug: "apply" | "academy-join" | "operator-apply" | "sovereign";
  title: string;
  kid: string;
  cost: string;
  time: string;
  lane?: string;
};

export default function ProgramIntakeForm({ formSlug, title, kid, cost, time, lane }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("form_slug", formSlug);
    if (lane) fd.set("lane", lane);
    const result = await submitProgramIntake(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07070c] p-6">
        <Card className="p-8 text-center max-w-md bg-zinc-900 text-white">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">We have you</h2>
          <p className="text-zinc-300 text-sm">
            Your name is on the people record. An operator follows up. Nothing ships until Taha taps yes on money/legal.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070c] text-white py-12 px-4">
      <div className="max-w-lg mx-auto">
        <p className="text-xs tracking-[0.28em] uppercase text-cyan-300 mb-2">
          <BrandName />
        </p>
        <h1 className="text-3xl font-black mb-2">{title}</h1>
        <p className="text-zinc-300 text-sm mb-1">{kid}</p>
        <p className="text-amber-300 text-sm mb-8">
          {cost} · {time}
        </p>
        <Card className="p-6 bg-zinc-900 border-zinc-800">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Full name" required>
              <input name="contact_name" className={inputClass} required />
            </FormField>
            <FormField label="Phone" required>
              <input name="phone" type="tel" className={inputClass} required />
            </FormField>
            <FormField label="Email" required>
              <input name="email" type="email" className={inputClass} required />
            </FormField>
            <FormField label="What you want">
              <textarea name="notes" rows={4} className={inputClass} placeholder="Plain words. No promises needed." />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Submit"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
