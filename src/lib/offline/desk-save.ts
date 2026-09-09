"use client";

import { adminUpsert as liveAdminUpsert } from "@/app/(admin)/admin-actions";
import { isDeskTable } from "@/lib/offline/tables";
import { cacheUpsert, isBrowserOffline, outboxAdd } from "@/lib/offline/store";
import { validateRentalRecord } from "@/lib/rental-record-validation";

export type DeskSaveResult = { success: true; offline?: boolean } | { success: false; error: string };

/**
 * Online saves acknowledge the server result. Offline/network-failed saves
 * acknowledge only a durable outbox write. A rejected write is never success.
 */
export async function adminUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<DeskSaveResult> {
  if (!isDeskTable(table) && table !== "tasks") {
    return liveAdminUpsert(table, record);
  }

  const validationError = validateRentalRecord(table, record);
  if (validationError) return { success: false, error: validationError };

  // Keep one identity across an ambiguous network failure and its retry. Cache
  // timestamps are local metadata and must not become database column writes.
  const candidate = { ...record, id: record.id ?? crypto.randomUUID() };
  if (!isBrowserOffline()) {
    try {
      const live = await liveAdminUpsert(table, candidate);
      if (live.success) await cacheUpsert(table, candidate);
      return live;
    } catch (error) {
      const transportFailure = error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
      if (!isBrowserOffline() && !transportFailure) {
        return { success: false, error: "Could not save. Check your connection and sign-in, then try again." };
      }
    }
  }

  try {
    await outboxAdd(table, candidate);
    await cacheUpsert(table, candidate);
    return { success: true, offline: true };
  } catch {
    return { success: false, error: "Your changes could not be saved on this device. Keep this form open and reconnect before trying again." };
  }
}
