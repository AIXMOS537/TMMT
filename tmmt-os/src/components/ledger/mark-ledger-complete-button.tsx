"use client";

import { useTransition } from "react";
import { updateLedgerStatus } from "@/lib/ledger/actions";

export function MarkLedgerCompleteButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs font-medium text-primary underline disabled:opacity-50"
      onClick={() => {
        startTransition(() => {
          void updateLedgerStatus(entryId, "completed");
        });
      }}
    >
      {pending ? "Saving…" : "Mark completed"}
    </button>
  );
}
