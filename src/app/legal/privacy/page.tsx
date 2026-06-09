export const metadata = {
  title: "Privacy — TMMT / AIXMOS",
  robots: { index: false, follow: false },
};

export default function PrivacyLegalPage() {
  return (
    <>
      <h1>Privacy</h1>
      <p><em>Last updated 2026-06-08. This summary applies to the TMMT and AIXMOS surfaces. Not a substitute for legal counsel.</em></p>

      <h2>What we collect</h2>
      <ul>
        <li>Contact information you provide on our forms (name, phone, email).</li>
        <li>Funding readiness profile data you choose to share (entity type, banking status, self-reported credit awareness in bucket form).</li>
        <li>Form attribution metadata (UTM tags, referrer, landing URL) for analytics.</li>
        <li>Background-check information when you authorize it for rental eligibility.</li>
      </ul>
      <p>
        We do <strong>not</strong> request or store full social security numbers or full dates of birth on our credit-guidance intake. Score data, if any, is collected only as <strong>self-reported buckets</strong> (e.g., 620–679), never as a numeric input.
      </p>

      <h2>Why we collect it</h2>
      <ul>
        <li>To respond to your inquiry and provide the service you requested.</li>
        <li>To prepare educational follow-up appropriate to your stated goals.</li>
        <li>With your consent, to introduce you to third-party lenders or funding sources.</li>
        <li>To meet recordkeeping and compliance requirements.</li>
      </ul>

      <h2>How we share it</h2>
      <p>
        We share data with third parties only with your consent or as required by law. Third-party lender introductions transmit a summary of your readiness profile and the contact details you provided.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Request a copy of the data we hold on you by emailing <a href="mailto:hello@tmmtrentals.com">hello@tmmtrentals.com</a>.</li>
        <li>Request deletion of your record (some recordkeeping requirements may apply).</li>
        <li>Opt out of SMS at any time by replying <strong>STOP</strong>. See <a href="/legal/sms">SMS Terms</a>.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Personal data is stored in row-level-security-protected tables with anonymous-write, authenticated-read access patterns. Banned-term checks block submissions that contain language inconsistent with our educational-only posture.
      </p>
    </>
  );
}
