"use client";

import { adminUpsert as liveAdminUpsert } from "@/app/(admin)/admin-actions";
import { isDeskTable } from "@/lib/offline/tables";
import { cacheUpsert, isBrowserOffline, outboxAdd } from "@/lib/offline/store";

export type DeskSaveResult = { success: true; offline?: boolean } | { success: false; error: string };

/**
 * Same write the live rentals desk uses. Always lands in the local copy first
 * so a user can fill everything before they have internet. When online, also
 * upserts live. Failures stay queued for /api/offline/merge.
 */
export async function adminUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<DeskSaveResult> {
  if (!isDeskTable(table) && table !== "tasks") {
    return liveAdminUpsert(table, record);
  }

  const local = await cacheUpsert(table, record);
  await outboxAdd(table, local);

  if (isBrowserOffline()) {
    return { success: true, offline: true };
  }

  try {
    const live = await liveAdminUpsert(table, local);
    if (live.success) return live;
    return { success: true, offline: true };
  } catch {
    return { success: true, offline: true };
  }
}
