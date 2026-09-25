import Link from "next/link";

export const metadata = {
  title: "Page not found · TMMT Rentals",
  description: "That page isn't here. Head back to TMMT Rentals.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7ff] px-6 text-[#0A1628]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          TMMT Rentals
        </p>
        <h1 className="mt-3 text-3xl font-bold">That page isn&apos;t here</h1>
        <p className="mt-3 text-sm text-slate-600">
          The link you followed doesn&apos;t lead anywhere anymore. The cars,
          the waitlist, and the rental desk are all still where you left them.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#1440C4] px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back to TMMT Rentals
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Looking for help?{" "}
          <Link href="/forms/ticket" className="text-[#1440C4] hover:underline">
            Get help
          </Link>
        </p>
      </div>
    </div>
  );
}
