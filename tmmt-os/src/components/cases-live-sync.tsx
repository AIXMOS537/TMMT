"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Refreshes when cases or client-visible updates change. */
export function CasesLiveSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("client_cases_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, () => {
        router.refresh();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_client_updates" },
        () => {
          router.refresh();
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
