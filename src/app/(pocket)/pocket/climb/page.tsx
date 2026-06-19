import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";

export const metadata = { title: "Climb · AIXMOS Pocket" };

// The rungs ahead — grounded in docs/OFFER-STACK.md. Member -> operator -> owner.
const RUNGS = [
  { label: "You are here — $97/mo member", note: "Learn the system, earn as you refer." },
  { label: "Active earner", note: "Steady, honest referrals on collected sales." },
  { label: "TMMT operator (invited)", note: "Your own fenced scope. Promotion is earned, not automatic." },
  { label: "$1,875 — your first taste build", note: "Your own ecosystem starter + leads/funnels set up." },
  { label: "$15K — car-rental vertical", note: "Front-end, design, and AIXMOS agents for rentals." },
  { label: "$25K — credit guidance + funding + rentals", note: "The full vertical, done with you." },
  { label: "$45–50K — full done-for-you ecosystem", note: "Managed store, backend support, your brain built." },
];

export default function ClimbPage() {
  return (
    <div>
      <Link href="/pocket" className="text-sm text-blue-600 dark:text-blue-400">← Pocket</Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
        <TrendingUp className="h-6 w-6" /> Climb
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Your path from member → operator → your own business or location.
      </p>

      <ol className="mt-5 space-y-3">
        {RUNGS.map((r, i) => (
          <li key={i}>
            <Card className={`p-4 ${i === 0 ? "border-blue-300 dark:border-blue-800" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{r.label}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{r.note}</p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs text-gray-400 dark:text-slate-500">
        Earnings are commission on collected sales only — never guaranteed income. Build
        cost and terms are set in writing before any rung begins.
      </p>
    </div>
  );
}
