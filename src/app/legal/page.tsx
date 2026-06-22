import Link from "next/link";

export const metadata = {
  title: "Legal — TMMT / AIXMOS",
  robots: { index: false, follow: false },
};

const ITEMS = [
  { href: "/legal/credit", label: "Credit Guidance", desc: "Educational only. Not credit repair. No score guarantee." },
  { href: "/legal/funding", label: "Funding Referrals", desc: "We are not a lender. Third-party introductions only." },
  { href: "/legal/rental", label: "Rental Agreement", desc: "Not an extension of credit. Holder Rule applies if restructured." },
  { href: "/legal/sms", label: "SMS Terms", desc: "TCPA / 10DLC consent. Reply STOP to unsubscribe." },
  { href: "/legal/privacy", label: "Privacy", desc: "What we collect, why, and how to remove it." },
];

export default function LegalIndex() {
  return (
    <>
      <h1>Legal &amp; Compliance</h1>
      <p>Disclosures and policies for the TMMT and AIXMOS platforms. Last reviewed 2026-06-08.</p>
      <ul className="not-prose space-y-3 mt-6">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="block p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-800 transition">
              <div className="font-semibold text-gray-900 dark:text-white">{i.label}</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">{i.desc}</div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
