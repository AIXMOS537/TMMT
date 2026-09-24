import Link from "next/link";
import type { Metadata } from "next";

/**
 * The public trust page.
 *
 * EVERY SENTENCE HERE IS A PUBLIC PROMISE, and each was checked against the
 * code before it was written. Where the code did not support the obvious
 * wording, the wording changed — not the other way round. Specifically:
 *
 *  · "a person approves every message" was cut. Owner approval gates PROMOTIONAL
 *    sends; a booking confirmation goes without a human, which is the right
 *    design but not what "every" says.
 *  · "we ask permission before we text anyone" was cut. We now RECORD how
 *    permission was given (src/lib/consent.ts), but most of the existing book
 *    predates that column, so the honest claim is about what we record, not
 *    about a history we cannot evidence.
 *  · Bella's disclosure is described as an instruction she is given, because
 *    that is what it is — a prompt rule, not enforced code.
 *
 * If you change a line on this page, re-check it against the file named beside
 * it in the audit at ~/Sync/rick/MESH-BUS/to-carry/G8-TRUST-PAGE.md first.
 */
export const metadata: Metadata = {
  title: "How we handle your information",
  description:
    "How we contact people on your behalf: consent, opt-outs, quiet hours, approvals, and keeping your data separate.",
};

const PROMISES: Array<{ title: string; body: string[] }> = [
  {
    title: "Stop means stop",
    body: [
      "If someone tells us to stop, we stop. Not just for one campaign — we add them to a single block list that every message we send is checked against, for every business we work with.",
      "It works with the plain words people actually use, not only the exact word STOP.",
    ],
  },
  {
    title: "We don't message people late at night",
    body: [
      "We use the time where they are, not where we are. Nothing goes out between 9 at night and 8 in the morning, their time.",
      "We do this for email too, even though the rules only require it for texts.",
    ],
  },
  {
    title: "We keep a record of how someone agreed to hear from us",
    body: [
      "When someone gives us permission to contact them, we record how they gave it and when — a form they filled in, a text they replied to, or something they signed.",
      "We would rather tell you plainly that we are still filling in that record for older contacts than claim it has always been there.",
    ],
  },
  {
    title: "A person approves anything promotional",
    body: [
      "Nothing promotional goes out until someone on our team approves it. That is built into the system, not left to memory — the code refuses to send otherwise.",
      "Routine messages you asked for, like a booking confirmation, send on their own. That is the difference between helpful and spam.",
    ],
  },
  {
    title: "Your customers' details stay yours",
    body: [
      "Each business's information is kept separate. One business cannot see another's customers, and the separation is enforced by the database itself, not just by the app.",
    ],
  },
  {
    title: "Our phone assistant tells people she's AI",
    body: [
      "She is told to say she is an assistant, not a person, and to pass the caller to a real human whenever they ask.",
      "We test that before she ever answers a real call, and asking for a person is one of the things we check.",
    ],
  },
  {
    title: "You can see it, and you can stop it",
    body: [
      "You get a page showing everything running on your account, and a button that stops all of it. You do not have to email us or wait for us.",
      "Nothing is deleted when you stop it. You can start it again whenever you want.",
    ],
  },
];

export default function TrustPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          How we handle your information
        </h1>
        <p className="mt-3 text-gray-600 dark:text-slate-300">
          We contact people on your behalf. That only works if we do it properly. Here is
          exactly what we do, in plain words.
        </p>

        <div className="mt-10 space-y-9">
          {PROMISES.map((p) => (
            <section key={p.title}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{p.title}</h2>
              {p.body.map((line) => (
                <p key={line} className="mt-2 text-gray-600 dark:text-slate-300">
                  {line}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-gray-200 p-5 dark:border-slate-700">
          <p className="text-gray-900 dark:text-white">
            If anything here matters to your business and you want to see how it actually
            works, ask us. We will show you the real thing rather than talk about it.
          </p>
          <Link
            href="/intake"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white"
          >
            Ask us about it
          </Link>
        </div>
      </div>
    </main>
  );
}
