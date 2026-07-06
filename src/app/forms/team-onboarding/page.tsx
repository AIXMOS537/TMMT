"use client";

import { useEffect, useRef, useState } from "react";
import { submitTeamOnboarding } from "@/app/forms/actions";
import { CheckCircle, Rocket, ShieldCheck, HeartHandshake } from "lucide-react";

// Extra-large, friendly field styling — built for someone who has never used a
// computer. Big tap targets, big text, no jargon.
const bigInput =
  "w-full rounded-xl border-2 border-gray-300 dark:border-slate-600 px-4 py-3.5 text-lg text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-400 outline-none transition";

const roles = [
  { value: "operator", label: "Operator (run the day-to-day)" },
  { value: "teammate", label: "Teammate (help the mission)" },
  { value: "developer", label: "Developer (build / code)" },
  { value: "vendor", label: "Vendor (supply / service)" },
];

export default function TeamOnboardingForm() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const device = useRef<string>("");

  useEffect(() => {
    if (typeof navigator !== "undefined") device.current = navigator.userAgent.slice(0, 480);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (device.current) fd.set("device", device.current);
    const result = await submitTeamOnboarding(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setName((fd.get("full_name") as string)?.trim() || "");
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 p-6">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <CheckCircle className="mx-auto h-20 w-20 text-emerald-500 mb-4" />
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
            You&apos;re in{name ? `, ${name}` : ""}! 🎉
          </h1>
          <p className="text-lg text-gray-600 dark:text-slate-300">
            Your operator account is being set up right now — no waiting on anyone.
          </p>
          <p className="text-lg text-gray-600 dark:text-slate-300 mt-3">
            Check your <strong>email or phone</strong> for a login link to the Operator Academy.
            Complete your modules, grab your tracked links, and start earning your split.
          </p>
          <p className="text-base text-gray-500 dark:text-slate-400 mt-4">
            Login: <strong>tmmt-command-center.vercel.app</strong>
          </p>
          <p className="text-base text-gray-400 mt-6">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <Rocket className="h-8 w-8 text-blue-600" />
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">TMMT</span>
          </div>
          <p className="text-lg text-gray-600 dark:text-slate-300">
            Welcome. This takes 1 minute. No app to install.
          </p>
        </div>

        {/* Step 1 — The Mission */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-base">1</span>
            Read the mission
          </h2>
          <p className="text-base text-gray-700 dark:text-slate-300 leading-relaxed">
            <strong>Trap Money Moves Timeless</strong> — for the people, by the people.
            We help everyday people get out and bring their family with them, using simple
            systems and AI helpers to run a real business and grow — <em>one step at a time</em>,
            without having to ask or beg anyone.
          </p>
          <p className="text-base text-gray-700 dark:text-slate-300 leading-relaxed mt-3">
            The ask: do your part, leave it better than you found it, and always protect the
            owner and the family.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 2 — Say yes */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-emerald-500">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="bg-emerald-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-base">2</span>
              Say yes
            </h2>
            <label className="flex items-start gap-3 mb-4 cursor-pointer rounded-xl p-3 hover:bg-emerald-50 dark:hover:bg-slate-700 transition">
              <input type="checkbox" name="mission_accepted" required className="mt-1 h-6 w-6 accent-emerald-600 flex-shrink-0" />
              <span className="text-base text-gray-800 dark:text-slate-200 flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                I accept the mission.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer rounded-xl p-3 hover:bg-emerald-50 dark:hover:bg-slate-700 transition">
              <input type="checkbox" name="confidentiality_agreed" required className="mt-1 h-6 w-6 accent-emerald-600 flex-shrink-0" />
              <span className="text-base text-gray-800 dark:text-slate-200 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                I&apos;ll keep things confidential and never act against the owner or family.
              </span>
            </label>
          </div>

          {/* Step 3 — Tell us about you */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-purple-500 space-y-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="bg-purple-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-base">3</span>
              Tell us about you
            </h2>

            {error && (
              <div className="rounded-xl bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 text-base">
                {error}
              </div>
            )}

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Your name <span className="text-red-500">*</span>
              </label>
              <input name="full_name" required placeholder="First and last name" className={bigInput} />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Your phone number <span className="text-red-500">*</span>
              </label>
              <input name="phone" type="tel" required inputMode="tel" placeholder="(555) 123-4567" className={bigInput} />
              <p className="text-sm text-gray-500 mt-1">This is how Muhammad will reach you.</p>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Your email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input name="email" type="email" inputMode="email" placeholder="you@email.com" className={bigInput} />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                What will you be doing?
              </label>
              <select name="role" defaultValue="operator" className={bigInput}>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Your first step <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input name="first_step" placeholder="The one thing you'll do first" className={bigInput} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white text-2xl font-extrabold py-5 shadow-lg transition flex items-center justify-center gap-3"
          >
            {loading ? "Sending…" : <>I&apos;m In <Rocket className="h-7 w-7" /></>}
          </button>
          <p className="text-center text-sm text-gray-400 mt-4">
            Press the green button. That&apos;s the last step.
          </p>
        </form>
      </div>
    </div>
  );
}
