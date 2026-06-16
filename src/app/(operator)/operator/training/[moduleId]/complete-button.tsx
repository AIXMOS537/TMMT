"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button, ErrorBanner } from "@/components/ui";
import { markModuleComplete } from "../actions";

export function CompleteButton({
  moduleId,
  done,
}: {
  moduleId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={16} /> Module complete
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await markModuleComplete(moduleId);
            if (res && "error" in res) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Saving…" : "Mark module complete"}
      </Button>
    </div>
  );
}
