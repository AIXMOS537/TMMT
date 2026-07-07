import type { Metadata } from "next";
import Link from "next/link";
import { Shield, ArrowRight, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Join TMMT — Operator Application",
  description:
    "Apply to become a TMMT operator. Mission fit test required. Founding slots limited.",
};

const steps = [
  {
    n: "01",
    title: "Mission fit test",
    desc: "80% pass required. Alignment, integrity, low-overhead mindset.",
    href: "/fit-test",
    cta: "Take fit test",
  },
  {
    n: "02",
    title: "Application",
    desc: "Name, contact, role. Returning team requires executive review.",
    href: "/forms/team-onboarding",
    cta: "Apply",
  },
  {
    n: "03",
    title: "Academy + earnings",
    desc: "Scoped access, tracked links, earn before you ask for more.",
    href: "/forms/affiliates",
    cta: "Affiliate track",
  },
];

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      <header className="border-b border-white/10 px-6 py-14 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          TMMT Operator Network
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Join the mission</h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-400 leading-relaxed">
          For the people. Low overhead after setup. Max 100 operators lifetime — 10 founding
          slots at launch. Not everyone gets in; that&apos;s justice, not cruelty.
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p>
            Returning team and past operators must pass the fit test <strong>and</strong> receive
            executive approval before access is restored.
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-mono text-blue-400">{s.n}</p>
                <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
              </div>
              <Link
                href={s.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#1440C4] px-5 py-2.5 text-sm font-semibold hover:bg-blue-600"
              >
                {s.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <ul className="mt-12 space-y-2 text-sm text-slate-500">
          {[
            "Credit guidance vocabulary: guidance, never repair",
            "Scoped access — links, Academy, earnings only",
            "Owner holds kill-switch and executive approvals",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
