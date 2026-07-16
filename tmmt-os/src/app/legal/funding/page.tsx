export const metadata = {
  title: "Funding Referral Disclosure — TMMT / AIXMOS",
  robots: { index: false, follow: false },
};

export default function FundingLegalPage() {
  return (
    <>
      <h1>Funding Referrals</h1>
      <p><em>Last updated 2026-06-08. Canonical copy lives in <code>COMPLIANCE_DISCLAIMERS.md</code> §4.</em></p>

      <aside className="not-prose my-6 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <p className="text-sm text-blue-900 dark:text-blue-200 mb-2">
          Before any introduction we ask you to share a short readiness profile — non-intrusive and educational, no application.
        </p>
        <a href="/funding" className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
          Start the profile →
        </a>
      </aside>

      <h2>We are not a lender</h2>
      <p>
        TMMT and AIXMOS are <strong>not</strong> a lender. We do not underwrite, fund, service, or collect on loans or credit products. We may introduce you to independent third-party lenders or funding sources.
      </p>
      <p>
        If you elect to apply with any third-party source we introduce, you will contract <strong>directly with them</strong>, on their terms, and any decision to extend credit is theirs alone.
      </p>

      <h2>Referral fees</h2>
      <p>
        We may receive a referral or marketing fee from third-party sources you choose to engage with. <strong>This fee does not change your cost or rate</strong> with that source.
      </p>

      <h2>What an introduction is and is not</h2>
      <ul>
        <li><strong>Is</strong>: a hand-off of your contact information and (with your consent) a summary of your stated goals and readiness profile to a third party who may contact you.</li>
        <li><strong>Is not</strong>: an application on your behalf, a credit pull, an offer of credit, a guarantee of approval, or a commitment by us or by the third party to fund.</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You may decline any introduction. You may revoke consent at any time by emailing <a href="mailto:hello@tmmtrentals.com">hello@tmmtrentals.com</a>. Revocation does not undo introductions already shared but stops future ones.
      </p>
    </>
  );
}
