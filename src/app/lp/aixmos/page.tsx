import Link from "next/link";
import type { Metadata } from "next";

/**
 * The AIXMOS front door.
 *
 * Reached at /lp/aixmos, which middleware already treats as public — no
 * signed-out visitor is bounced to /login from here. That matters because every
 * other route on this app is staff-only, so until this page existed there was
 * nowhere a stranger could read what AIXMOS is, let alone buy it.
 *
 * The copy says only what is true and only what ships today: a drive that
 * installs a local AI pack on the buyer's own machine. No cloud account, no
 * per-seat pricing, no usage meter running while they think.
 *
 * Deliberately NOT on this page: a CashApp handle or a Zelle address. Those are
 * personal rails and belong in a 1:1 invoice to a named customer, not on a page
 * the open internet can scrape. The CTA captures the lead and a human follows
 * up; wire a real hosted checkout before pointing paid traffic here.
 */

export const metadata: Metadata = {
  title: "PROJECT AIXMOS — a private AI that runs on your own computer",
  description:
    "A drive that installs an AI helper on your machine. Runs locally, works offline, no per-use billing. Study, paperwork, job hunting, and running a business.",
};

const WHO = [
  {
    who: "Students",
    what: "Turn a textbook chapter or PDF into a summary, the key terms, practice questions, and a one-page revision sheet. Plan, draft and sharpen a long essay from your own notes and reading.",
  },
  {
    who: "Anyone facing paperwork",
    what: "A bill, a lease, a letter from an agency — explained in plain language, with what to watch out for and the exact words to use on the phone.",
  },
  {
    who: "People looking for work",
    what: "A resume built from however you describe yourself, tailored to a specific posting, a cover letter that is not generic, and interview practice.",
  },
  {
    who: "People running something",
    what: "Eighteen advisor skills — finance, operations, marketing, proposals, customer success, competitive research, meetings and retrospectives.",
  },
];

const TRUE_LIMITS = [
  "It can be wrong — especially about numbers, dates, names and formulas. Anything that will be graded, signed, paid or submitted gets checked against the original.",
  "It cannot look things up. There is no internet in it. It will never hand you a citation or a statistic, because any it produced would be invented.",
  "It explains; it does not advise. For anything legal, medical, financial or immigration-related it points you to who to call — free help first — instead of guessing at your situation.",
];

export default function AixmosLandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-[#0A1628]">
      <div className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#41527a]">
          Project AIXMOS
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
          A private AI that runs on your own computer.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#41527a]">
          Not in a cloud. Not on someone else&apos;s server. You put in a drive, it
          installs on your machine, and it keeps working with the wifi off. There is
          no account to make, no key to buy, and nothing is charged per use.
        </p>
        <p className="mt-3 text-lg leading-relaxed text-[#41527a]">
          Whatever you give it — a textbook, a medical bill, a half-finished
          resume — stays on your computer. That is the point, not a feature.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/forms/lead-intake"
            className="rounded-xl bg-[#0A1628] px-6 py-3 font-semibold text-white"
          >
            Ask about getting one
          </Link>
          <a
            href="#what"
            className="rounded-xl border border-[#dbe4f5] bg-white px-6 py-3 font-semibold text-[#0A1628]"
          >
            See what it does
          </a>
        </div>

        <section id="what" className="mt-14">
          <h2 className="text-2xl font-semibold">Who it is for</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {WHO.map((x) => (
              <div
                key={x.who}
                className="rounded-xl border border-[#dbe4f5] bg-white p-5"
              >
                <h3 className="font-semibold">{x.who}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#41527a]">{x.what}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-[#41527a]">
            You do not have to learn a list of commands. Open it and say what you are
            trying to do, in your own words. It works alongside the AI tools people
            already use — Claude Code, Codex and Cursor — and it also runs on its own
            if you use none of them.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold">What it costs</h2>
          <div className="mt-5 rounded-xl border border-[#dbe4f5] bg-white p-6">
            <p className="text-3xl font-semibold">
              $97<span className="text-base font-normal text-[#41527a]">/month</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#41527a]">
              Unlimited use — not per seat, not per message. Includes the drive, the
              full skill pack, updates, and a real answer within 24 hours when you are
              stuck.
            </p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[#41527a]">
            Running an agency or a fleet and want this under your own brand? There is a
            white-label path, priced on scope.{" "}
            <Link className="font-semibold underline" href="/forms/lead-intake">
              Tell us what you are building
            </Link>
            .
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold">Being straight about the limits</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#41527a]">
            The brain that ships with this is small enough to run on a normal laptop.
            That trade is what makes it private and free to use, and it has
            consequences worth knowing before you buy, not after:
          </p>
          <ul className="mt-4 space-y-3">
            {TRUE_LIMITS.map((t) => (
              <li
                key={t}
                className="rounded-xl border border-[#dbe4f5] bg-white p-4 text-sm leading-relaxed text-[#41527a]"
              >
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-[#41527a]">
            Used this way it is genuinely useful. Used as an oracle it will eventually
            embarrass you. We would rather say so now than sell you something on a
            promise it cannot keep.
          </p>
        </section>

        <section className="mt-14 rounded-xl border border-[#dbe4f5] bg-white p-6">
          <h2 className="text-xl font-semibold">Interested?</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#41527a]">
            Tell us what you are trying to get done and we will tell you honestly
            whether this is the right thing for it.
          </p>
          <Link
            href="/forms/lead-intake"
            className="mt-4 inline-block rounded-xl bg-[#0A1628] px-6 py-3 font-semibold text-white"
          >
            Start here
          </Link>
        </section>

        <p className="mt-12 text-xs leading-relaxed text-[#41527a]">
          AIXMOS is a software tool. It is not a lawyer, a doctor, an accountant or a
          financial adviser, and it does not replace one.
        </p>
      </div>
    </main>
  );
}
