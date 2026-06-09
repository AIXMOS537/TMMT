import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "../types";
import { rowToApplication, type ProgramApplicationRow } from "./serialize";

export function subscribeProgramApplication(
  supabase: SupabaseClient,
  applicationId: string,
  onUpdate: (application: AppState["application"]) => void
): () => void {
  const channel = supabase
    .channel(`program_application:${applicationId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "program_applications",
        filter: `id=eq.${applicationId}`,
      },
      (payload) => {
        const row = payload.new as ProgramApplicationRow;
        if (row) onUpdate(rowToApplication(row));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
