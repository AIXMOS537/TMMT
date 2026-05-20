import Link from "next/link";
import { Suspense } from "react";
import { ContactFirstBanner } from "@/components/contact-first-banner";
import { TrackRequestForm } from "./track-form";

export const metadata = {
  title: "Track your request | TMMT OS",
  description: "Check status without calling — use your reference number and email.",
};

export const dynamic = "force-dynamic";

export default function TrackPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            TMMT OS
          </Link>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>

      <div className="container max-w-xl space-y-8 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Track your request</h1>
          <p className="text-muted-foreground">
            Enter the reference number from your confirmation and the email you used. No account
            required.
          </p>
        </header>

        <ContactFirstBanner variant="public" />
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading tracker…</p>}>
          <TrackRequestForm />
        </Suspense>

        <p className="text-sm text-muted-foreground text-center">
          Renters and partners with an account get live updates on{" "}
          <Link href="/login" className="text-primary underline">
            the client portal
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
