"use client";

import { useState } from "react";
import Link from "next/link";
import { submitMissionFitTest } from "@/app/forms/actions";
import { MISSION_FIT_QUESTIONS } from "@/lib/v3/mission-fit";
import { Shield, CheckCircle, XCircle } from "lucide-react";

const APPLICANT_TYPES = [
  { value: "new_operator", label: "New — I want to become an operator" },
  { value: "returning_team", label: "Returning — I worked with TMMT/AIXMOS before" },
  { value: "failed_operator", label: "Returning operator — I was in the network before" },
  { value: "new_party", label: "New partner / vendor / other" },
];

const SCALE = [1, 2, 3, 4, 5];

export default function MissionFitTestPage() {
  const [step, setStep] = useState<"form" | "done">("form");
  const [passed, setPassed] = useState(false);
  const [score, setScore] = useState(0);
  const [executiveReview, setExecutiveReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submitMissionFitTest(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setPassed(result.passed ?? false);
    setScore(result.score ?? 0);
    setExecutiveReview(result.executiveReview ?? false);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6">
        <div className="max-w-md w-full text-center bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700">
          {passed && !executiveReview ? (
            <>
              <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Fit for the mission</h1>
              <p className="text-slate-300">Score: {score}% — proceed to apply</p>
              <Link href="/join" className="mt-6 inline-block px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold">
                Continue to /join →
              </Link>
            </>
          ) : passed && executiveReview ? (
            <>
              <Shield className="mx-auto h-16 w-16 text-amber-400 mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Passed — executive review required</h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Score: {score}%. Returning team and past operators need executive approval before access.
              </p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-16 w-16 text-red-400 mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Not a fit right now</h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Score: {score}%. TMMT is for people aligned with the mission — low overhead, integrity, earn your way.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <Shield className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
          <h1 className="text-2xl font-bold text-white">Mission fit test</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            For the people. Max 100 operators lifetime — starting with 10 founding slots. Returning team must pass to come back.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
          {error && <div className="rounded-lg bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 text-sm">{error}</div>}

          <input name="full_name" required placeholder="Full name *" className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-white" />
          <input name="phone" type="tel" required placeholder="Phone *" className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-white" />
          <input name="email" type="email" placeholder="Email" className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-white" />
          <select name="applicant_type" required className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-white">
            {APPLICANT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {MISSION_FIT_QUESTIONS.map((q) => (
            <fieldset key={q.id} className="border-t border-slate-700 pt-4">
              <legend className="text-sm text-slate-200 mb-3 leading-relaxed">{q.text}</legend>
              <div className="flex gap-3">
                {SCALE.map((s) => (
                  <label key={s} className="text-xs text-slate-400 cursor-pointer">
                    <input type="radio" name={q.id} value={s} required className="accent-emerald-500 mr-1" />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-60">
            {loading ? "Scoring…" : "Submit fit test"}
          </button>
        </form>
      </div>
    </div>
  );
}
