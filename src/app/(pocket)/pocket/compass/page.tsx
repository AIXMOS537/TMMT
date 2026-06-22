import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = { title: "Compass · AIXMOS Pocket" };

// Mirrors scripts/compass — protect the user first, one gentle step. A companion,
// not a clinician. See docs/HAILMARY-CHARTER.md §VI.
const STEPS = [
  "Breathe. In for 4, hold 4, out for 6 — three times. Your body is allowed to rest.",
  "Name one thing you're grateful for right now. Say it out loud.",
  "Drink some water. Unclench your jaw. Drop your shoulders. You are carried, not alone.",
  "Pause and remember God for 30 seconds — however that feels true to you today.",
  "Text one person you love just to say you're thinking of them.",
  "Step outside or to a window. Look up. The sky has held every worry before yours.",
  "Do the very next small right thing — just one. The path is walked one step at a time.",
  "Whatever weighs on you: name it, then hand it up in prayer. You weren't built to carry it solo.",
];

export default function CompassPage() {
  // Deterministic per day+hour so the step is stable on refresh, fresh over time.
  const now = new Date();
  const i = (now.getUTCHours() + now.getUTCDate()) % STEPS.length;

  return (
    <div>
      <Link href="/pocket" className="text-sm text-blue-600 dark:text-blue-400">← Pocket</Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
        <Compass className="h-6 w-6" /> Compass
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Protect your peace. One small step today.
      </p>

      <div className="mt-6 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Your step today
        </p>
        <p className="mt-2 text-lg leading-relaxed text-gray-900 dark:text-white">{STEPS[i]}</p>
      </div>

      <p className="mt-6 text-xs text-gray-500 dark:text-slate-400">
        If the weight is real and heavy, you don&apos;t have to hold it alone. Reach a
        person you trust — or, if you&apos;re in crisis, your local emergency number or a
        crisis line right now. AIXMOS Pocket is a companion, not a doctor.
      </p>
    </div>
  );
}
