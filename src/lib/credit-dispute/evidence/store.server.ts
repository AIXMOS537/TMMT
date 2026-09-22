import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  CREDIT_EVIDENCE_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  checkEvidenceFile,
  evidenceObjectKey,
  type FileCheck,
} from "./files";

/**
 * Evidence file storage (C2). Server-only; the service role is used ONLY after the
 * caller's authorization for this exact case has been checked by the action.
 *
 * OFF unless CREDIT_EVIDENCE_UPLOADS=1. Production has neither the flag nor the
 * private `credit-evidence` bucket (it is in the staged, unapplied migration), so
 * in production every call here refuses before touching storage.
 */

export function evidenceUploadsEnabled(): boolean {
  return process.env.CREDIT_EVIDENCE_UPLOADS === "1";
}

export type StoredFile = {
  evidenceId: string;
  storagePath: string;
  sha256: string;
  mime: string;
  sizeBytes: number;
  fileName: string;
};

export type StoreResult = { ok: true; file: StoredFile } | { ok: false; error: string; code?: string };

/** Validate by content, then store under a server-built key. Nothing user-named reaches the path. */
export async function storeEvidenceFile(
  file: File,
  where: { orgId?: string | null; clientId: string }
): Promise<StoreResult> {
  if (!evidenceUploadsEnabled()) return { ok: false, error: "Document uploads are not enabled.", code: "disabled" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check: FileCheck = checkEvidenceFile({ bytes, declaredType: file.type, fileName: file.name });
  if (!check.ok) return { ok: false, error: check.error, code: check.code };

  const evidenceId = `evid-${randomUUID()}`;
  const storagePath = evidenceObjectKey({ orgId: where.orgId, clientId: where.clientId, evidenceId, ext: check.ext });
  const { error } = await createServiceRoleClient()
    .storage.from(CREDIT_EVIDENCE_BUCKET)
    .upload(storagePath, bytes, { contentType: check.mime, upsert: false });
  if (error) {
    console.error("[credit evidence upload]", error.message);
    return { ok: false, error: "Upload failed. Please try again." };
  }
  return {
    ok: true,
    file: {
      evidenceId,
      storagePath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      mime: check.mime,
      sizeBytes: check.sizeBytes,
      fileName: check.displayName,
    },
  };
}

/** Remove an object whose metadata row failed to save — no orphans holding someone's documents. */
export async function discardEvidenceFile(storagePath: string): Promise<void> {
  await createServiceRoleClient().storage.from(CREDIT_EVIDENCE_BUCKET).remove([storagePath]);
}

/** A short-lived link for ONE authorized viewer. Never stored, never public. */
export async function signedEvidenceUrl(storagePath: string): Promise<string | null> {
  if (!evidenceUploadsEnabled()) return null;
  const { data, error } = await createServiceRoleClient()
    .storage.from(CREDIT_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: true });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
