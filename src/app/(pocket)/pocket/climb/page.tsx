import Link from "next/link";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui";
import { createSSRClient } from "@/lib/supabase-server";
import { isOperatorUser, isOwnerUser } from "@/lib/auth-roles";

export const metadata = { title: "Climb · AIXMOS Pocket" };

// The rungs ahead — grounded in docs/OFFER-STACK.md. Member -> operator -> owner.
const RUNGS = [
  { label: "$97/mo member", note: "Learn the system, earn as you refer." },
  { label: "Active earner", note: "Steady, honest referrals on collected sales." },
  { label: "TMMT operator (invited)", note: "Your own fenced scope. Promotion is earned, not automatic." },
  { label: "$1,875 — your first taste build", note: "Your own ecosystem starter + leads/funnels set up." },
  { label: "$15K — car-rental vertical", note: "Front-end, design, and AIXMOS agents for rentals." },
  { label: "$25K — credit guidance + funding + rentals", note: "The full vertical, done with you." },
  { label: "$45–50K — full done-for-you ecosystem", note: "Managed store, backend support, your brain built." },
];

export default async function ClimbPage() {
  let operator = false;
  let owner = false;
  try {
    const supabase = await createSSRClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    operator = isOperatorUser(user);
    owner = isOwnerUser(user);
  } catch {
    operator = false;
  }

  // "You are here": owner = top, operator = rung 3 (index 2), member = rung 1.
  const hereIndex = owner ? RUNGS.length - 1 : operator ? 2 : 0;

  return (
    <div>
      <Link href="/pocket" className="text-sm text-blue-600 dark:text-blue-400">← Pocket</Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
        <TrendingUp className="h-6 w-6" /> Climb
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Your path from member → operator → your own business or location.
      </p>

      {operator && (
        <Card className="mt-4 p-5 border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20">
          <p className="font-semibold text-gray-900 dark:text-white">You&apos;re a TMMT operator. 🎉</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
            Your fenced operator workspace is ready — leads, training, and your daily
            driver live there.
          </p>
          <Link
            href="/operator"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open your operator hub <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      <ol className="mt-5 space-y-3">
        {RUNGS.map((r, i) => {
          const here = i === hereIndex;
          const done = i < hereIndex;
          return (
            <li key={i}>
              <Card className={`p-4 ${here ? "border-blue-400 dark:border-blue-700 ring-1 ring-blue-400/40" : ""}`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      done ? "bg-emerald-600" : here ? "bg-blue-600" : "bg-gray-400 dark:bg-slate-600"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {r.label}
                      {here && <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">you are here</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{r.note}</p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-xs text-gray-400 dark:text-slate-500">
        Operators are invited by the owner — it&apos;s earned, not automatic. Earnings
        are commission on collected sales only, never guaranteed income. Build cost and
        terms are set in writing before any rung begins.
      </p>
    </div>
  );
}
