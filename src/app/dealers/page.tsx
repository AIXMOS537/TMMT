import Link from "next/link";
import { checkoutHref, kitCheckout } from "@/lib/kit-checkout";

const objections = [
  {
    q: "Can we just log into your system?",
    a: "Not for independent stores. You get your own instance — your customer list and books never sit next to another dealer's.",
  },
  {
    q: "We're a small lot — is this overkill?",
    a: "Ops Kit is built for single-location floors. Start with fleet desk + lead intake, add Command when you're ready.",
  },
  {
    q: "What about credit repair for our buyers?",
    a: "Ops first. Credit guidance (not repair) is a later add-on after legal gates — we start by running your floor clean.",
  },
  {
    q: "How fast can we go live?",
    a: "Checkout today → we provision your dedicated stack → hand you admin login + training within days, not months.",
  },
] as const;

export default function DealersPage() {
  const opsCheckout = checkoutHref(kitCheckout.ops, "ops");
  const dealerBundle = checkoutHref(kitCheckout.dealerBundle, "dealer-bundle");
  const support =
    kitCheckout.supportPhone || kitCheckout.supportEmail
      ? [kitCheckout.supportPhone, kitCheckout.supportEmail].filter(Boolean).join(" · ")
      : "Contact us after checkout";

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0A1628]">
      <header className="bg-[#0A1628] px-6 py-16 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
          AIXMOS Dealer · mom-and-pop flagship
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-5xl">
          One operating system. Your lot. Your books.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          Replace the pile of follow-up tools, clipboards, and owner-blind dashboards
          with one AIXMOS instance — fleet desk, lead intake, staff logins, and owner
          command. Dedicated. Not a shared login. If it closes one extra deal a month,
          it pays for itself.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={dealerBundle}
            className="rounded-lg bg-[#1440C4] px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Get Dealer Bundle — $3,497
          </a>
          <Link
            href="/forms/dealer-apply"
            className="rounded-lg border border-white/30 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Apply as a dealer
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-center text-2xl font-bold">Built for independent dealers</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Lead intake → your pipeline",
              desc: "Public forms capture buyers and renters. Every lead lands in your admin — not a shared CRM.",
            },
            {
              title: "Fleet & lot desk",
              desc: "Track vehicles, contracts, maintenance, and payments from one ops dashboard.",
            },
            {
              title: "Staff logins",
              desc: "Floor team, managers, and owners each see only what their role allows.",
            },
            {
              title: "Owner command center",
              desc: "Portfolio view, escalations, and partner hub when you add the Command Kit or bundle.",
            },
            {
              title: "Your own deployment",
              desc: "Dedicated Supabase + Vercel — your keys, your backup, your data isolation.",
            },
            {
              title: "14-day hand-hold",
              desc: "Launch playbook + training so your team is not guessing on day one.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold text-[#1440C4]">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-14">
        <h2 className="text-center text-2xl font-bold">Pick your package</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl bg-white p-8 shadow-md ring-1 ring-slate-200/80">
            <h3 className="text-xl font-bold">Ops Kit</h3>
            <p className="text-sm text-slate-500">Single-location floor / fleet desk</p>
            <p className="mt-4 text-3xl font-bold text-[#1440C4]">
              $997 <span className="text-base font-medium text-slate-600">+ $297/mo</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>✓ Fleet, customers, payments, tickets</li>
              <li>✓ Public intake forms for leads</li>
              <li>✓ Staff logins on TMMT Ops</li>
            </ul>
            <a
              href={opsCheckout}
              className="mt-6 block rounded-lg bg-[#1440C4] py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start with Ops Kit
            </a>
          </article>

          <article className="rounded-2xl border-2 border-[#1440C4] bg-white p-8 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1440C4]">
              Best for mom-and-pop owners
            </p>
            <h3 className="mt-1 text-xl font-bold">Dealer Bundle</h3>
            <p className="text-sm text-slate-500">Ops + Command — full stack</p>
            <p className="mt-4 text-3xl font-bold text-[#1440C4]">
              $3,497 <span className="text-base font-medium text-slate-600">+ $697/mo</span>
            </p>
            <p className="text-sm text-green-700">Save $497 vs buying kits separately</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>✓ Everything in Ops Kit</li>
              <li>✓ Command Center owner hub</li>
              <li>✓ Dedicated instance provisioned for your store</li>
            </ul>
            <a
              href={dealerBundle}
              className="mt-6 block rounded-lg bg-[#1440C4] py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Get Dealer Bundle
            </a>
          </article>
        </div>
        <p id="checkout-pending" className="mt-8 text-center text-sm text-slate-500">
          Secure checkout via Stripe · Questions:{" "}{support}
        </p>
      </section>

      <section className="border-t border-slate-200 bg-white px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-xl font-bold">Common questions</h2>
          <dl className="mt-8 space-y-6">
            {objections.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-[#0A1628]">{item.q}</dt>
                <dd className="mt-1 text-sm text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h2 className="text-xl font-bold">See it before you buy</h2>
        <p className="mt-2 text-slate-600">
          Walk through live lead intake and ops admin on a demo call — no pressure.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/forms/lead-intake"
            className="rounded-lg bg-[#1440C4] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try lead intake form
          </Link>
          <Link
            href="/kits"
            className="rounded-lg border border-[#1440C4] px-6 py-3 text-sm font-semibold text-[#1440C4] hover:bg-blue-50"
          >
            Full kit comparison
          </Link>
          <Link
            href="/configurator"
            className="rounded-lg border border-[#1440C4] px-6 py-3 text-sm font-semibold text-[#1440C4] hover:bg-blue-50"
          >
            See what is running today
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <p>AIXMOS Dealer · dedicated instance · ops + intake + owner command. Not a DMS replacement.</p>
        <p className="mt-2">
          <Link href="/legal/rental" className="text-[#1440C4] hover:underline">
            Legal & disclaimers
          </Link>
          {" · "}
          <Link href="/trust" className="text-[#1440C4] hover:underline">
            How we handle your data
          </Link>
          {" · "}
          <Link href="/login" className="text-[#1440C4] hover:underline">
            Staff login
          </Link>
        </p>
      </footer>
    </div>
  );
}
