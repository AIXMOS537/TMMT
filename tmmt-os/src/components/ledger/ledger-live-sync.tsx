"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Refreshes the page when rental_ledger changes (team / investor / vendor posts). */
export function LedgerLiveSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("rental_ledger_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rental_ledger" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
