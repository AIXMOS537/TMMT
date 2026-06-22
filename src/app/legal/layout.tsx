import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/legal/credit", label: "Credit Guidance" },
  { href: "/legal/funding", label: "Funding Referrals" },
  { href: "/legal/rental", label: "Rental Agreement" },
  { href: "/legal/sms", label: "SMS Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <Link href="/legal" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Legal index
          </Link>
        </header>
        <nav className="flex flex-wrap gap-2 mb-8 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <article className="prose prose-slate dark:prose-invert max-w-none">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-500">
          Source of truth: <code>COMPLIANCE_DISCLAIMERS.md</code>. Reviewed every 90 days or when CFPB/FTC guidance changes. Not a substitute for legal counsel.
        </footer>
      </div>
    </div>
  );
}
