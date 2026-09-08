/**
 * Local copy of TMMT Rentals tables. Same shapes the live app writes.
 * Used when the device is offline; merge.ts pushes the outbox when they come back.
 */

const DB_NAME = "tmmt-rentals-desk";
const DB_VERSION = 1;
const TABLES = "tables";
const OUTBOX = "outbox";

export type { DeskTable } from "@/lib/offline/tables";
export { DESK_TABLES, isDeskTable } from "@/lib/offline/tables";

export type OutboxItem = {
  id: string;
  table: string;
  record: Record<string, unknown>;
  queued_at: string;
  synced?: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TABLES)) {
        db.createObjectStore(TABLES, { keyPath: "table" });
      }
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheRead(table: string): Promise<Record<string, unknown>[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(TABLES, "readonly");
    const row = await reqToPromise(
      tx.objectStore(TABLES).get(table) as IDBRequest<{ table: string; rows: Record<string, unknown>[] } | undefined>
    );
    db.close();
    return row?.rows ?? [];
  } catch {
    return [];
  }
}

export async function cacheReplace(table: string, rows: Record<string, unknown>[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(TABLES, "readwrite");
    tx.objectStore(TABLES).put({ table, rows });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* local cache is best-effort */
  }
}

export async function cacheUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const rows = await cacheRead(table);
  const id = String(record.id ?? crypto.randomUUID());
  const next = { ...record, id, updated_at: new Date().toISOString() };
  const idx = rows.findIndex((r) => String(r.id) === id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
  else rows.unshift(next);
  await cacheReplace(table, rows);
  return next;
}

export async function outboxAdd(table: string, record: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  try {
    const item: OutboxItem = {
      id: crypto.randomUUID(),
      table,
      record,
      queued_at: new Date().toISOString(),
    };
    const tx = db.transaction(OUTBOX, "readwrite");
    tx.objectStore(OUTBOX).put(item);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Offline write was aborted."));
    });
  } finally {
    db.close();
  }
}

export async function outboxPending(): Promise<OutboxItem[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(OUTBOX, "readonly");
    const all = await reqToPromise(tx.objectStore(OUTBOX).getAll() as IDBRequest<OutboxItem[]>);
    db.close();
    return (all ?? []).filter((i) => !i.synced);
  } catch {
    return [];
  }
}

export async function outboxClear(ids: string[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(OUTBOX, "readwrite");
    const store = tx.objectStore(OUTBOX);
    for (const id of ids) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
