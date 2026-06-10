import type { Metadata } from "next";
import type { ReactNode } from "react";

const TITLE = "Funding Readiness Profile — TMMT / AIXMOS";
const DESCRIPTION =
  "A short, conversational profile to help you understand your financial position and what to prepare next. Educational only — not credit repair, no score guarantee, no credit pull.";
const URL = "https://tmmt-ops.vercel.app/funding";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "TMMT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function CreditFundingIntakeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
