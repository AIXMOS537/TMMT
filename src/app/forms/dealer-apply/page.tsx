"use client";

import { useEffect, useRef, useState } from "react";
import { submitDealerApplication } from "@/app/forms/actions";
import { CheckCircle, Rocket, ShieldCheck, Car, Coins, HeartHandshake, BadgeCheck } from "lucide-react";

const bigInput =
  "w-full rounded-xl border-2 border-gray-300 dark:border-slate-600 px-4 py-3.5 text-lg text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-400 outline-none transition";

const plans = [
  {
    value: "downtime_engine",
    emoji: "🟢",
    name: "Start Small",
    line: "Turn your slow days into money days.",
    sub: "Your cars that just sit there start earning. Smart helpers answer calls and book deals for you.",
  },
  {
    value: "multi_lane",
    emoji: "🟡",
    name: "Grow Bigger",
    line: "Sell more than just cars.",
    sub: "Add credit help, funding, and training. More ways to make money under one roof.",
  },
  {
    value: "flagship",
    emoji: "🔴",
    name: "The Whole Thing",
    line: "Your whole business, done for you.",
    sub: "Everything, set up and running. Only one dealer per city. That dealer is you.",
  },
];

export default function DealerApplyForm() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState("downtime_engine");
  const device = useRef<string>("");

  useEffect(() => {
    if (typeof navigator !== "undefined") device.current = navigator.userAgent.slice(0, 480);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("interested_tier", tier);
    if (device.current) fd.set("device", device.current);
    const result = await submitDealerApplication(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setName((fd.get("owner_name") as string)?.trim() || "");
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 p-6">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <CheckCircle className="mx-auto h-20 w-20 text-emerald-500 mb-4" />
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
            Got it{name ? `, ${name}` : ""}! 🎉
          </h1>
          <p className="text-lg text-gray-600 dark:text-slate-300">
            Your application is in. We look at every dealer by hand — not everyone gets in.
          </p>
          <p className="text-lg text-gray-600 dark:text-slate-300 mt-3">
            If you&apos;re a fit, we&apos;ll <strong>call or text you</strong> to set up your lot.
          </p>
          <p className="text-base text-gray-400 mt-6">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header — dead simple promise */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <Car className="h-8 w-8 text-blue-600" />
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">TMMT</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
            Make money on your slow days.
          </h1>
          <p className="text-lg text-gray-600 dark:text-slate-300 mt-1">
            A whole business, dropped into your dealership. Ready to go.
          </p>
        </div>

        {/* What you get — three plain pictures */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          {[
            { icon: Coins, t: "Your idle cars earn", s: "Cars sitting on the lot start making money on the side." },
            { icon: Rocket, t: "Robots do the work", s: "Smart helpers answer calls, chase leads, and book deals 24/7." },
            { icon: HeartHandshake, t: "Help more buyers", s: "Bad credit? We help fix it and get them funded — you still sell the car." },
          ].map((b) => (
            <div key={b.t} className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <b.icon className="h-7 w-7 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{b.t}</p>
                <p className="text-sm text-gray-600 dark:text-slate-400">{b.s}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Pick a plan — simple words */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-blue-500">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-base">1</span>
              Pick how you want to start
            </h2>
            <div className="space-y-3">
              {plans.map((p) => (
                <label
                  key={p.value}
                  className={`block rounded-xl border-2 p-4 cursor-pointer transition ${
                    tier === p.value
                      ? "border-blue-500 bg-blue-50 dark:bg-slate-700"
                      : "border-gray-200 dark:border-slate-600 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier_radio"
                    className="sr-only"
                    checked={tier === p.value}
                    onChange={() => setTier(p.value)}
                  />
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-base text-gray-800 dark:text-slate-200">{p.line}</p>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{p.sub}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* The door / bouncer — the non-negotiables */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-amber-500">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="bg-amber-500 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-base">2</span>
              The door — be honest
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Not everyone gets in. To keep the family safe, all three must be true.
            </p>
            {[
              { name: "licensed_dealer", icon: BadgeCheck, label: "I am a real, licensed car dealer." },
              { name: "has_real_lot", icon: Car, label: "I have a real lot with real cars." },
              { name: "plays_fair", icon: ShieldCheck, label: "I play fair and treat people right." },
            ].map((c) => (
              <label key={c.name} className="flex items-start gap-3 mb-3 cursor-pointer rounded-xl p-3 hover:bg-amber-50 dark:hover:bg-slate-700 transition">
                <input type="checkbox" name={c.name} required className="mt-1 h-6 w-6 accent-amber-600 flex-shrink-0" />
                <span className="text-base text-gray-800 dark:text-slate-200 flex items-center gap-2">
                  <c.icon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  {c.label}
                </span>
              </label>
            ))}
          </div>

          {/* Tell us about you */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-purple-500 space-y-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="bg-purple-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-base">3</span>
              Tell us about your lot
            </h2>

            {error && (
              <div className="rounded-xl bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 text-base">
                {error}
              </div>
            )}

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Dealership name <span className="text-red-500">*</span>
              </label>
              <input name="dealership_name" required placeholder="Your dealership" className={bigInput} />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Your name <span className="text-red-500">*</span>
              </label>
              <input name="owner_name" required placeholder="First and last name" className={bigInput} />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Your phone <span className="text-red-500">*</span>
              </label>
              <input name="phone" type="tel" required inputMode="tel" placeholder="(555) 123-4567" className={bigInput} />
              <p className="text-sm text-gray-500 mt-1">This is how we reach you.</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input name="email" type="email" inputMode="email" placeholder="you@email.com" className={bigInput} />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                City &amp; State
              </label>
              <input name="city_state" placeholder="e.g. Phoenix, AZ" className={bigInput} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">Years open</label>
                <input name="years_in_business" inputMode="numeric" placeholder="e.g. 3" className={bigInput} />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">Cars on lot</label>
                <input name="units_on_lot" inputMode="numeric" placeholder="e.g. 20" className={bigInput} />
              </div>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                Dealer license # <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input name="license_number" placeholder="So we can verify you" className={bigInput} />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-slate-200 mb-1.5">
                What&apos;s your biggest struggle right now?
              </label>
              <textarea name="biggest_struggle" rows={3} placeholder="Tell us in your own words" className={bigInput} />
            </div>
          </div>

          {/* Agreements */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-5 border-l-4 border-emerald-500">
            <label className="flex items-start gap-3 mb-3 cursor-pointer rounded-xl p-3 hover:bg-emerald-50 dark:hover:bg-slate-700 transition">
              <input type="checkbox" name="mission_accepted" required className="mt-1 h-6 w-6 accent-emerald-600 flex-shrink-0" />
              <span className="text-base text-gray-800 dark:text-slate-200">
                I accept the mission — help people, do it right, leave it better.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer rounded-xl p-3 hover:bg-emerald-50 dark:hover:bg-slate-700 transition">
              <input type="checkbox" name="confidentiality_agreed" required className="mt-1 h-6 w-6 accent-emerald-600 flex-shrink-0" />
              <span className="text-base text-gray-800 dark:text-slate-200">
                I&apos;ll keep things private and never hurt the family inside.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white text-2xl font-extrabold py-5 shadow-lg transition flex items-center justify-center gap-3"
          >
            {loading ? "Sending…" : <>Apply Now <Rocket className="h-7 w-7" /></>}
          </button>
          <p className="text-center text-sm text-gray-400 mt-4">
            One dealer per city. We review every application by hand.
          </p>
        </form>
      </div>
    </div>
  );
}
