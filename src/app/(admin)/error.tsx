"use client";

import { Button } from "@/components/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Failed to load page</h2>
        <p className="text-gray-500 dark:text-slate-400 mb-4 text-sm">
          Something went wrong loading this page.
        </p>
        <Button onClick={reset}>Retry</Button>
      </div>
    </div>
  );
}
