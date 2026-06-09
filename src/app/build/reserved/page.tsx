import Link from "next/link";
import type { Metadata } from "next";
import { consultUrl, supportContact } from "@/lib/high-ticket";

// Post-checkout confirmation — set this as the GHL deposit redirect/“thank you”
// URL. Unlisted + noindex like the rest of the /build funnel.
export const metadata: Metadata = {
  title: "Build reserved — TMMT × AIXMOS",
  description: "Your deposit is in and your build is reserved. Here's what happens next.",
  robots: { index: false, follow: false },
};

const next = [
  { n: "1", title: "We reach out", desc: "Our team contacts you within one business day to schedule your kickoff call." },
  { n: "2", title: "Kickoff & scope", desc: "We confirm scope, timeline, and the remaining balance — invoiced at kickoff." },
  { n: "3", title: "We build, you launch", desc: "Done-for-you build, then onboarding, launch playbook, and handover." },
];

export default function BuildReservedPage() {
  const bookCall = consultUrl || "#book-a-call";

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0A1628]">
      <header className="bg-[#0A1628] px-6 py-16 text-center text-white">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Your build is reserved</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          Deposit received — thank you. Your spot is locked in and our team is on it.
          Here&apos;s exactly what happens next.
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <ol className="space-y-5">
          {next.map((s) => (
            <li key={s.n} className="flex items-start gap-4 rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1440C4] font-bold text-white">
                {s.n}
              </div>
              <div>
                <h3 className="font-semibold text-[#1440C4]">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border-2 border-[#1440C4] bg-white p-6 text-center">
          <p className="font-semibold">Want to get a head start?</p>
          <p className="mt-1 text-sm text-slate-600">
            Book your kickoff call now instead of waiting for us to reach out.
          </p>
          <a
            href={bookCall}
            className="mt-4 inline-block rounded-lg bg-[#1440C4] px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Book your kickoff call
          </a>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          {supportContact
            ? `Questions? ${supportContact}`
            : "Questions? Reply to your receipt email and we'll help."}
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <p>TMMT Rentals · AIXMOS</p>
        <p className="mt-2">
          <Link href="/build" className="text-[#1440C4] hover:underline">
            ← Back to builds
          </Link>
        </p>
      </footer>
    </div>
  );
}
