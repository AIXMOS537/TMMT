import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — TMMT",
  robots: { index: false, follow: false },
};

// Shown only when a page navigation fails because the device is offline.
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#0A1628] text-white text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
          📶
        </div>
        <h1 className="text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-3 text-slate-300">
          No internet right now. The app is still installed and ready — reconnect
          and it&apos;ll pick up where you left off.
        </p>
        {/* Intentional raw <a>: a full-document navigation is what retries
            loading the app after reconnecting. next/link's client-side nav is
            the wrong behavior on the offline fallback. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#1440C4] px-6 py-3 text-sm font-semibold hover:bg-blue-700"
        >
          Try again
        </a>
      </div>
    </div>
  );
}
