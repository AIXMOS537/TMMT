"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
