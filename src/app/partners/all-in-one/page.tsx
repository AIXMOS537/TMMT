import type { Metadata } from "next";
import OptInForm from "./OptInForm";
import { PARTNER_NAME } from "@/lib/partner-handoff";

/**
 * The one page in TMMT OS allowed to link to the partner's site, and it only
 * does so after someone fills this form and ticks the consent box.
 *
 * Everything that used to hand visitors over automatically — the /credit and
 * /funding redirects, the 301 on the /lp/* landing pages, /join, and the
 * checkout fallback behind every money button — was removed in favour of this.
 */
export const metadata: Metadata = {
  title: `Work with ${PARTNER_NAME} — TMMT`,
  description: `Optional introduction to ${PARTNER_NAME}. TMMT customers are never sent there automatically.`,
  robots: { index: false, follow: false },
};

export default function PartnerOptInPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
        Want an introduction to {PARTNER_NAME}?
      </h1>
      <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
        {PARTNER_NAME} is a separate company we work with on credit and funding.
        TMMT will never send you there on its own — this page exists so you can
        ask for the introduction if you want it. Fill this in and we&apos;ll pass
        your details along; skip it and nothing changes.
      </p>
      <div className="mt-6">
        <OptInForm />
      </div>
    </main>
  );
}
