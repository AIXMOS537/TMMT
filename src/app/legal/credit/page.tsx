export const metadata = {
  title: "Credit Guidance Disclosure — TMMT / AIXMOS",
  robots: { index: false, follow: false },
};

export default function CreditLegalPage() {
  return (
    <>
      <h1>Credit Guidance</h1>
      <p><em>Last updated 2026-06-08. Canonical copy lives in <code>COMPLIANCE_DISCLAIMERS.md</code> §1.</em></p>

      <aside className="not-prose my-6 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <p className="text-sm text-blue-900 dark:text-blue-200 mb-2">
          Ready to take action? Start your <strong>Funding Readiness Profile</strong> — educational only, no credit pull, no SSN, takes ~5 minutes.
        </p>
        <a href="/funding" className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
          Start the profile →
        </a>
      </aside>

      <h2>Not credit repair</h2>
      <p>
        TMMT and AIXMOS provide <strong>educational information</strong> about consumer credit, score factors, and lender criteria. We do <strong>not</strong> represent ourselves to be, and are not, a credit repair organization as defined under the Credit Repair Organizations Act (CROA, 15 U.S.C. § 1679a). We do not promise to remove, dispute, or alter accurate items on your credit report. We do not act as your agent in communications with credit bureaus, lenders, or collectors.
      </p>
      <p>
        Any actions you take on your credit profile are taken by you, with information we provide. Results vary; we make <strong>no guarantee</strong> that any specific action will raise your score by a specific amount or within a specific timeframe.
      </p>

      <h2>What we do</h2>
      <ul>
        <li>Educate on credit profile fundamentals (utilization, age, mix, payment history).</li>
        <li>Help you organize a <strong>funding readiness profile</strong> — banking, entity status, bookkeeping, documentation.</li>
        <li>Surface concrete next steps you can take yourself.</li>
        <li>When appropriate, introduce you to independent third-party lenders or funding sources.</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>Promise approval, funding, or any specific lender outcome.</li>
        <li>Promise score increases by any amount or by any date.</li>
        <li>Dispute items on your behalf or contact bureaus, lenders, or collectors on your behalf.</li>
        <li>Provide legal or tax advice. Consult counsel and a CPA for those.</li>
      </ul>

      <h2>AI assistance</h2>
      <p>
        Some of our intake, education, and follow-up surfaces are powered by AI. The assistant is not a lawyer, financial advisor, or human representative. For binding decisions, request escalation to a human team member at <a href="mailto:hello@tmmtrentals.com">hello@tmmtrentals.com</a>.
      </p>

      <h2>State carve-outs</h2>
      <p>
        Certain states have specific credit-services regulations. We periodically review our practices against NY, CA, FL, TX, and GA at minimum. If you reside in one of these states, contact us for state-specific clarifications before enrolling in any program.
      </p>

      <h2>How to reach us</h2>
      <p>
        Questions about this disclosure: <a href="mailto:hello@tmmtrentals.com">hello@tmmtrentals.com</a>.
      </p>
    </>
  );
}
