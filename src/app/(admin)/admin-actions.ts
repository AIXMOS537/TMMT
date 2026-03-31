"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type SaveResult = { success: true } | { success: false; error: string };

export async function adminUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<SaveResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.from(table).upsert(record);
  if (error) {
    console.error(`[${table}] upsert failed:`, error.message);
    return { success: false, error: "Failed to save. Please try again." };
  }
  return { success: true };
}
