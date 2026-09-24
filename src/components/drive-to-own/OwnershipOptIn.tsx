"use client";

/**
 * The button that starts the Drive-to-Own journey.
 *
 * Deliberately plain about what it is and is not: pressing it starts a path, it does not
 * apply for anything, commit the renter to anything, or change their rental. Overselling
 * here would be the first broken promise in a journey whose whole value is being honest
 * about what the renter can expect.
 */
import { useState, useTransition } from "react";
import { optInToOwnership } from "@/app/status/opt-in-actions";
import { CheckCircle } from "lucide-react";

export default function OwnershipOptIn({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-lg border border-white/10 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle className="h-4 w-4 text-green-500" aria-hidden />
          You&apos;re on the path
        </p>
        <p className="mt-2 text-sm opacity-80">
          We&apos;ll show your progress here. Nothing changes about your rental today.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-semibold">Thinking about owning one day?</h3>
      <p className="mt-2 text-sm opacity-80">
        We can show you exactly where you stand and what it would take to get approved for
        financing by a lender. It&apos;s free, it doesn&apos;t change your rental, and you can
        stop any time.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await optInToOwnership(token);
            if (r.ok) setDone(true);
            else setError(r.error);
          })
        }
        className="mt-3 rounded-md border border-white/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "One moment…" : "I'd like to own a car one day"}
      </button>
    </div>
  );
}
