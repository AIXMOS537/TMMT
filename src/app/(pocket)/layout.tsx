import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIXMOS Pocket",
  description:
    "Your credit-guidance coach and earn-as-you-learn hub — on every device.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "AIXMOS Pocket" },
};

// Mobile-first, no admin sidebar — AIXMOS Pocket is the member's pocket app,
// installable on any device (PWA). See docs/superpowers/specs/2026-06-19-...
export default function PocketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-screen-sm px-4 py-6">{children}</div>
    </div>
  );
}
