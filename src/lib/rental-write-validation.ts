import type { SupabaseClient } from "@supabase/supabase-js";
import { validateRentalRecord } from "./rental-record-validation";

/** Validate partial date edits against the existing row, using the caller's RLS. */
export async function validateRentalWrite(
  table: string,
  record: Record<string, unknown>,
  supabase: Pick<SupabaseClient, "from">,
): Promise<string | null> {
  const error = validateRentalRecord(table, record);
  if (error) return error;
  const changesStart = Object.hasOwn(record, "start_date");
  const changesEnd = Object.hasOwn(record, "end_date");
  if (table !== "contracts" || !record.id || changesStart === changesEnd) return null;

  const existing = await supabase.from("contracts").select("start_date,end_date")
    .eq("id", record.id).maybeSingle();
  if (existing.error) return "Could not check the existing contract dates. Please try again.";
  return validateRentalRecord(table, { ...existing.data, ...record });
}
