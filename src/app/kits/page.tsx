import Link from "next/link";
import { checkoutHref, kitCheckout } from "@/lib/kit-checkout";

const kits = [
  {
    id: "ops",
    name: "TMMT Ops Kit",
    audience: "Dealerships & fleet operators",
    setup: "$997",
    monthly: "$297/mo",
    bullets: [
      "Fleet, customers, payments, tickets",
      "Public intake forms for leads",
      "Staff logins on TMMT Ops",
    ],
    buyOnline: kitCheckout.ops,
    buyUsb: kitCheckout.opsUsb,
  },
  {
    id: "command",
    name: "TMMT Command Kit",
    audience: "Owners, partners, investors",
    setup: "$2,997",
    monthly: "$497/mo",
    bullets: [
      "Portfolio hub & /command",
      "Role portals & vendor assign",
      "Owner brief & escalation",
    ],
    buyOnline: kitCheckout.command,
    buyUsb: kitCheckout.commandUsb,
  },
  {
    id: "growth",
    name: "AIXMOS Operator",
    audience: "Entrepreneurs & operator recruits",
    setup: "$97",
    monthly: "/mo membership",
    bullets: [
      "500 tokens / month + 15-module cert path",
      "Playbooks, intake, and operator office hours",
      "The low-cost door — one seat instead of ten SaaS bills",
    ],
    buyOnline: kitCheckout.growth,
    buyUsb: "",
    operatorApply: kitCheckout.operatorApply,
  },
] as const;

export default function KitsLandingPage() {
  const support =
    kitCheckout.supportPhone || kitCheckout.supportEmail
      ? [kitCheckout.supportPhone, kitCheckout.supportEmail].filter(Boolean).join(" · ")
      : "Contact support after checkout";

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0A1628]">
      <header className="bg-[#0A1628] px-6 py-14 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
          AIXMOS · one service · two doors
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Dealer flagship or $97 operator seat.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          One operating system for independent lots and everyday entrepreneurs.
          Fleet desk, intake, staff logins, owner command, and the operator
          academy — instead of paying five other tools.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#kits"
            className="rounded-lg bg-[#1440C4] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View kits & pricing
          </a>
          <Link
            href="/dealers"
            className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Dealer packages
          </Link>
          <Link
            href="/forms/dealer-apply"
            className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Apply as a dealer
          </Link>
          <Link
            href="/forms/lead-intake"
            className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/10"
          >
            Rental inquiry
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-xl font-semibold">How it fits together</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { title: "AIXMOS Dealer", desc: "Ops + command on your dedicated instance" },
            { title: "AIXMOS Operator", desc: "$97/mo · 500 tokens · cert path" },
            { title: "GHL hub", desc: "Checkout, CRM, follow-up — already included" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-blue-100 bg-white p-5 text-center shadow-sm"
            >
              <h3 className="font-semibold text-[#1440C4]">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="kits" className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="text-center text-2xl font-bold">Choose your kit</h2>
        <p className="mt-2 text-center text-slate-600">
          Secure checkout via Stripe · Instant digital access or USB shipped to you
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <article
              key={kit.id}
              className="flex flex-col rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/80"
            >
              <h3 className="text-lg font-bold">{kit.name}</h3>
              <p className="text-sm text-slate-500">{kit.audience}</p>
              <p className="mt-3 text-2xl font-bold text-[#1440C4]">
                {kit.setup}
                <span className="text-base font-medium text-slate-600">
                  {" "}
                  + {kit.monthly}
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                {kit.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-[#1440C4]">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              <a
                href={checkoutHref(kit.buyOnline, kit.id)}
                className="mt-6 block rounded-lg bg-[#1440C4] py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
              >
                Buy online — instant access
              </a>
              {kit.buyUsb ? (
                <a
                  href={checkoutHref(kit.buyUsb, `${kit.id}-usb`)}
                  className="mt-2 block rounded-lg border-2 border-[#1440C4] py-2.5 text-center text-sm font-semibold text-[#1440C4] hover:bg-blue-50"
                >
                  Buy + ship USB
                </a>
              ) : null}
              {"operatorApply" in kit && kit.operatorApply ? (
                <a
                  href={checkoutHref(kit.operatorApply)}
                  className="mt-2 block rounded-lg border-2 border-[#1440C4] py-2.5 text-center text-sm font-semibold text-[#1440C4] hover:bg-blue-50"
                >
                  Apply as operator
                </a>
              ) : null}
            </article>
          ))}
        </div>

        <article className="mt-8 rounded-2xl border-2 border-[#1440C4] bg-white p-8 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Dealer Bundle</h3>
              <p className="text-slate-600">
                TMMT Ops + Command Center — save $497 on setup
              </p>
              <p className="mt-2 text-2xl font-bold text-[#1440C4]">
                $3,497 <span className="text-base font-medium">+ $697/mo</span>
              </p>
            </div>
            <a
              href={checkoutHref(kitCheckout.dealerBundle, "dealer-bundle")}
              className="shrink-0 rounded-lg bg-[#1440C4] px-8 py-3 text-center font-semibold text-white hover:bg-blue-700"
            >
              Get dealer bundle
            </a>
          </div>
        </article>

        {/*
          The kits above are bundles. Some buyers do not want a bundle, they
          want to know what is actually running before they pay — so this is
          the one link on the page that leads away from a price and toward the
          honest inventory.
        */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h3 className="text-lg font-semibold">Not sure which kit?</h3>
          <p className="mt-1 text-sm text-slate-600">
            Pick the parts you want one at a time. Every item tells you whether it is
            running today or not switched on yet.
          </p>
          <Link
            href="/configurator"
            className="mt-4 inline-block rounded-lg border-2 border-[#1440C4] px-6 py-2.5 text-sm font-semibold text-[#1440C4] hover:bg-blue-50"
          >
            Build your own list
          </Link>
        </div>

        <p id="checkout-pending" className="mt-10 text-center text-sm text-slate-500">
          Buy opens GoHighLevel checkout (or the live GHL site with your kit campaign
          until product links are pasted). Questions: {support}
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <p>AIXMOS · one operating system · dealer flagship or $97 operator seat.</p>
        <p className="mt-2">
          <Link href="/login" className="text-[#1440C4] hover:underline">
            Staff login
          </Link>
        </p>
      </footer>
    </div>
  );
}
