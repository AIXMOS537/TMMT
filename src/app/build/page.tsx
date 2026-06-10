import Link from "next/link";
import type { Metadata } from "next";
import {
  highTicketTiers,
  tierActionUrl,
  consultUrl,
  supportContact,
} from "@/lib/high-ticket";

// Unlisted by design — flip to indexable + link from nav when copy/prices are
// approved and GHL checkout URLs are set. See docs/HIGH-TICKET-GO-LIVE.md.
export const metadata: Metadata = {
  title: "Done-for-you builds — TMMT × AIXMOS",
  description: "We build your operation end to end. Reserve your build with a deposit.",
  robots: { index: false, follow: false },
};

const steps = [
  { n: "1", title: "Reserve your build", desc: "Lock your spot with a deposit — secure checkout." },
  { n: "2", title: "We build it", desc: "Scoped, done-for-you. Balance invoiced at kickoff." },
  { n: "3", title: "You run it", desc: "Launch playbook, onboarding, and handover." },
];

export default function BuildLandingPage() {
  const bookCall = consultUrl || "#book-a-call";

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0A1628]">
      <header className="bg-[#0A1628] px-6 py-14 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
          TMMT × AIXMOS — Done-for-you builds
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          We build your business. You run it.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          From a systematized back office to a turnkey rental or e-commerce
          operation. Reserve your build with a deposit — we scope it, build it,
          and hand it over.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#tiers"
            className="rounded-lg bg-[#1440C4] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View builds & pricing
          </a>
          <a
            href={bookCall}
            className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Book a strategy call
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-xl font-semibold">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-blue-100 bg-white p-5 text-center shadow-sm"
            >
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#1440C4] font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold text-[#1440C4]">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tiers" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-center text-2xl font-bold">Choose your build</h2>
        <p className="mt-2 text-center text-slate-600">
          Reserve with a deposit via secure checkout · Balance invoiced at kickoff
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {highTicketTiers.map((tier) => (
            <article
              key={tier.id}
              className={`flex flex-col rounded-2xl bg-white p-6 shadow-md ring-1 ${
                tier.featured ? "ring-2 ring-[#1440C4]" : "ring-slate-200/80"
              }`}
            >
              {tier.featured && (
                <span className="mb-2 inline-block w-fit rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-[#1440C4]">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold">{tier.name}</h3>
              <p className="text-sm text-slate-500">{tier.tagline} · {tier.audience}</p>
              <p className="mt-3 text-2xl font-bold text-[#1440C4]">{tier.priceLabel}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{tier.depositLabel}</p>
              <p className="text-xs text-slate-500">{tier.balanceNote}</p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-[#1440C4]">✓</span>
                    {b}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-sm font-medium text-slate-900">{tier.outcome}</p>

              <a
                href={tierActionUrl(tier)}
                className="mt-4 block rounded-lg bg-[#1440C4] py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
              >
                {tier.cta === "call" ? "Book a strategy call" : "Reserve your build"}
              </a>
              {tier.cta === "reserve" && (
                <a
                  href={bookCall}
                  className="mt-2 block rounded-lg border-2 border-[#1440C4] py-2.5 text-center text-sm font-semibold text-[#1440C4] hover:bg-blue-50"
                >
                  Questions? Book a call
                </a>
              )}
            </article>
          ))}
        </div>

        <p id="reserve-pending" className="mt-10 text-center text-sm text-slate-500">
          Checkout links activate once GHL deposit products are connected.
          {supportContact ? ` Questions: ${supportContact}` : " Book a call above to get started."}
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <p>TMMT Rentals · AIXMOS · Deposits are non-refundable once a build begins.</p>
        <p className="mt-2">
          <Link href="/login" className="text-[#1440C4] hover:underline">
            Staff login
          </Link>
        </p>
      </footer>
    </div>
  );
}
