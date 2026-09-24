"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isRateLimitedDurable } from "@/lib/rate-limit-durable";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import type { IssueCategory } from "@/lib/credit-dispute/policy/assertion";
import {
  addEvidence,
  caseQueueRow,
  confirmCustomerAssertion,
  customerCaseView,
  draftCustomerAssertion,
  type CustomerCaseView,
} from "@/lib/credit-dispute/engine/case-state";
import { discardEvidenceFile, signedEvidenceUrl, storeEvidenceFile } from "@/lib/credit-dispute/evidence/store.server";

/**
 * Customer Credit Center actions (C2) — DEVELOPMENT ONLY.
 *
 * OFF unless CREDIT_CENTER_CUSTOMER=1 (not set in production). Production also
 * keeps public signup open today (AUTH-SIGNUP-001), which is exactly why this stays
 * off there: any stranger could register.
 *
 * How a customer's case is found: ONLY by `payload.customerUserId === auth user id`,
 * a link an owner makes explicitly (linkCustomerAccount). Never by email, never by
 * an id the browser sends. Every action resolves the case from the session first,
 * so there is no parameter a customer can change to reach someone else's case.
 *
 * These run on the service role (dispute_clients is admin-only under RLS). That
 * makes the session check below the wall, so: authenticate, resolve own case,
 * rate-limit writes, then act — in that order, every time.
 */

export type MyResult<T> = { ok: true; data: T } | { ok: false; error: string };

const NOT_AVAILABLE: MyResult<never> = { ok: false, error: "Not available." };

function enabled(): boolean {
  return process.env.CREDIT_CENTER_CUSTOMER === "1";
}

type Mine = { userId: string; client: StoredClient; version: string | null };

/** C3-020: refuse a change made from a page (tab) that loaded an older version. */
function stale(mine: Mine, seenVersion?: string | null): boolean {
  return !!seenVersion && mine.version !== seenVersion;
}

async function myCase(): Promise<MyResult<Mine>> {
  if (!enabled()) return NOT_AVAILABLE;
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await createServiceRoleClient()
    .from("dispute_clients")
    .select("id, payload, updated_at")
    .eq("payload->>customerUserId", user.id)
    .limit(2);
  if (error) return { ok: false, error: "Could not load your case." };
  const rows = (data ?? []) as Array<{ id: string; payload: StoredClient; updated_at: string | null }>;
  // The filter is re-checked in code: the service role must never hand back a row
  // whose link is not exactly this user.
  const own = rows.filter((r) => r.payload?.customerUserId === user.id);
  if (own.length === 0) return { ok: false, error: "No credit case is linked to your account yet." };
  if (own.length > 1) return { ok: false, error: "More than one case is linked to your account. Please contact us." };
  return { ok: true, data: { userId: user.id, client: own[0].payload, version: own[0].updated_at } };
}

async function limited(userId: string): Promise<boolean> {
  return isRateLimitedDurable(`credit-customer:${userId}`, { windowMs: 60 * 60 * 1000, maxHits: 30 }, createServiceRoleClient());
}

async function save(mine: Mine, updated: StoredClient): Promise<MyResult<CustomerCaseView>> {
  const { data, error } = await createServiceRoleClient()
    .from("dispute_clients")
    .update({ payload: updated })
    .eq("id", mine.client.profile.id)
    .eq("updated_at", mine.version ?? "")
    .select("id");
  if (error) return { ok: false, error: "Could not save." };
  if (!Array.isArray(data) || data.length === 0) return { ok: false, error: "Your case changed. Reload and try again." };
  return { ok: true, data: customerCaseView(updated, caseQueueRow(updated, 0)) };
}

/** Your own items, statements and documents. Nothing else. `version` guards stale tabs. */
export async function getMyCreditCase(): Promise<MyResult<CustomerCaseView & { version: string | null }>> {
  const mine = await myCase();
  if (!mine.ok) return mine;
  return { ok: true, data: { ...customerCaseView(mine.data.client, caseQueueRow(mine.data.client, 0)), version: mine.data.version } };
}

/**
 * A two-minute link to one of YOUR OWN documents (C3-010). Checked in order:
 * feature flag → signed in → your case (by session link) → the document is on your
 * case, you uploaded it, and it has a stored file. Operator documents and anyone
 * else's are refused with the same answer, so nothing is revealed by trying ids.
 */
export async function getMyDocumentLink(evidenceId: string): Promise<MyResult<string>> {
  const mine = await myCase();
  if (!mine.ok) return mine;
  const e = (mine.data.client.evidence ?? []).find((x) => x.id === String(evidenceId ?? ""));
  if (!e || e.source !== "customer" || e.uploadedBy !== `customer:${mine.data.userId}` || !e.storagePath) {
    return { ok: false, error: "Document not found." };
  }
  if (!e.storagePath.startsWith(`${mine.data.client.orgId ?? "no-org"}/${mine.data.client.profile.id}/`)) {
    return { ok: false, error: "Document not found." };
  }
  const url = await signedEvidenceUrl(e.storagePath);
  return url ? { ok: true, data: url } : { ok: false, error: "Document not available." };
}

/** Step 1: say what you believe is wrong with one of YOUR items, in your own words. A draft. */
export async function draftMyStatement(input: {
  negativeItemId: string;
  category: IssueCategory;
  statement: string;
  seenVersion?: string | null;
}): Promise<MyResult<CustomerCaseView>> {
  const mine = await myCase();
  if (!mine.ok) return mine;
  if (stale(mine.data, input?.seenVersion)) return { ok: false, error: "Your case changed. Reload and try again." };
  if (await limited(mine.data.userId)) return { ok: false, error: "Too many changes. Try again later." };
  try {
    const updated = draftCustomerAssertion(
      mine.data.client,
      {
        id: `assert-${randomUUID()}`,
        negativeItemId: String(input?.negativeItemId ?? ""),
        category: input?.category,
        statement: String(input?.statement ?? ""),
      },
      `customer:${mine.data.userId}`
    );
    return save(mine.data, updated);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That could not be saved." };
  }
}

/** Step 3: confirm your own draft. After this, the words are fixed. */
export async function confirmMyStatement(assertionId: string, seenVersion?: string | null): Promise<MyResult<CustomerCaseView>> {
  const mine = await myCase();
  if (!mine.ok) return mine;
  if (stale(mine.data, seenVersion)) return { ok: false, error: "Your case changed. Reload and try again." };
  if (await limited(mine.data.userId)) return { ok: false, error: "Too many changes. Try again later." };
  const a = (mine.data.client.assertions ?? []).find((x) => x.id === assertionId);
  // Only a draft THIS customer wrote. An operator's record is not theirs to confirm.
  if (!a || a.source !== "customer" || a.recordedBy !== `customer:${mine.data.userId}`) {
    return { ok: false, error: "Statement not found." };
  }
  try {
    return save(mine.data, confirmCustomerAssertion(mine.data.client, assertionId, `customer:${mine.data.userId}`, "customer_portal"));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That could not be confirmed." };
  }
}

/** Step 2 (optional): attach a document to one of YOUR items / drafts. */
export async function uploadMyDocument(formData: FormData): Promise<MyResult<CustomerCaseView>> {
  const mine = await myCase();
  if (!mine.ok) return mine;
  if (await limited(mine.data.userId)) return { ok: false, error: "Too many changes. Try again later." };
  if (stale(mine.data, (formData.get("seenVersion") as string) || null)) return { ok: false, error: "Your case changed. Reload and try again." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file first." };
  const client = mine.data.client;
  const negativeItemId = String(formData.get("negativeItemId") ?? "");
  const assertionId = (formData.get("assertionId") as string) || undefined;
  if (!client.negativeItems.some((i) => i.id === negativeItemId)) return { ok: false, error: "Item not found." };
  if (assertionId) {
    const a = (client.assertions ?? []).find((x) => x.id === assertionId);
    if (!a || a.recordedBy !== `customer:${mine.data.userId}` || a.negativeItemId !== negativeItemId) {
      return { ok: false, error: "Statement not found." };
    }
  }

  const stored = await storeEvidenceFile(file, { orgId: client.orgId, clientId: client.profile.id });
  if (!stored.ok) return { ok: false, error: stored.error };
  try {
    const updated = addEvidence(client, {
      id: stored.file.evidenceId,
      kind: "other",
      description: String(formData.get("description") ?? "").trim().slice(0, 500) || stored.file.fileName,
      negativeItemId,
      assertionId,
      storagePath: stored.file.storagePath,
      sha256: stored.file.sha256,
      mime: stored.file.mime,
      sizeBytes: stored.file.sizeBytes,
      fileName: stored.file.fileName,
      source: "customer",
      uploadedBy: `customer:${mine.data.userId}`,
      uploadedAt: new Date().toISOString(),
    });
    const res = await save(mine.data, updated);
    if (!res.ok) await discardEvidenceFile(stored.file.storagePath);
    return res;
  } catch (e) {
    await discardEvidenceFile(stored.file.storagePath);
    return { ok: false, error: e instanceof Error ? e.message : "Could not attach that document." };
  }
}
