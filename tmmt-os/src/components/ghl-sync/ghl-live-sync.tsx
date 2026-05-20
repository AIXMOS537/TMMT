"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const GHL_TABLES = [
  "ghl_contacts",
  "ghl_form_submissions",
  "ghl_appointments",
  "sync_events",
  "crm_sync_records",
] as const;

/** Refreshes /internal/ghl-sync when GHL webhooks write to Supabase. */
export function GhlLiveSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel = supabase.channel("ghl_live_sync");

    for (const table of GHL_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          router.refresh();
        }
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
