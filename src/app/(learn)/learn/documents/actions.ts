"use server";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { authorizeApplicationAccess } from "@/lib/program-applications-server";
import {
  PROGRAM_DOCUMENTS_BUCKET,
  assertProgramUploadFile,
  programDocumentObjectKey,
} from "@/lib/program-documents";

/**
 * Real document upload for the funding application.
 *
 * /learn/documents had no file input. "Mark uploaded" flipped a boolean in
 * browser state, and /work/admin reads that same boolean as docsOk to unlock
 * "Approve → supervisor" — so the document gate of the whole application could
 * be satisfied without producing a document.
 *
 * These run on the service role, because the applicant may be following a
 * token deep link with no session at all. That makes
 * authorizeApplicationAccess the only thing standing between a request and
 * someone else's paperwork, so it is checked first, every time, before a byte
 * moves.
 */

export type DocResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ProgramDocument = {
  docKey: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  verified: boolean;
};

export async function listProgramDocuments(
  applicationId: string,
  token: string | null
): Promise<DocResult<ProgramDocument[]>> {
  const access = await authorizeApplicationAccess(applicationId, token);
  if (!access.ok) return { ok: false, error: "Not found." };

  const { data, error } = await createServiceRoleClient()
    .from("program_documents")
    .select("doc_key, file_name, size_bytes, created_at, verified_at")
    .eq("application_id", applicationId);

  if (error) return { ok: false, error: "Could not load documents." };

  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      docKey: r.doc_key as string,
      fileName: r.file_name as string,
      sizeBytes: (r.size_bytes as number) ?? 0,
      createdAt: r.created_at as string,
      verified: r.verified_at != null,
    })),
  };
}

export async function uploadProgramDocument(
  formData: FormData
): Promise<DocResult<ProgramDocument>> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const docKey = String(formData.get("docKey") ?? "");
  const token = (formData.get("token") as string | null) || null;
  const file = formData.get("file");

  if (!applicationId || !docKey) return { ok: false, error: "Missing application or document." };
  if (!(file instanceof File)) return { ok: false, error: "Choose a file first." };

  const access = await authorizeApplicationAccess(applicationId, token);
  if (!access.ok) return { ok: false, error: "Not found." };

  const check = assertProgramUploadFile(file);
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = createServiceRoleClient();
  const storagePath = programDocumentObjectKey(applicationId, docKey, file.name, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(PROGRAM_DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("[program document upload]", uploadErr.message);
    return { ok: false, error: "Upload failed. Please try again." };
  }

  // One live file per checklist item. Replacing means the previous object is no
  // longer referenced, so remove it rather than leaving an orphan in the bucket
  // holding someone's payslip forever.
  const { data: previous } = await supabase
    .from("program_documents")
    .select("storage_path")
    .eq("application_id", applicationId)
    .eq("doc_key", docKey)
    .maybeSingle();

  const { error: rowErr } = await supabase
    .from("program_documents")
    .upsert(
      {
        application_id: applicationId,
        doc_key: docKey,
        storage_path: storagePath,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: access.userId,
        verified_at: null,
        verified_by: null,
      },
      { onConflict: "application_id,doc_key" }
    );

  if (rowErr) {
    // Do not leave the object behind when its row failed — that is how a
    // bucket ends up holding files nothing knows about.
    await supabase.storage.from(PROGRAM_DOCUMENTS_BUCKET).remove([storagePath]);
    console.error("[program_documents insert]", rowErr.message);
    return { ok: false, error: "Upload failed. Please try again." };
  }

  const oldPath = previous?.storage_path as string | undefined;
  if (oldPath && oldPath !== storagePath) {
    await supabase.storage.from(PROGRAM_DOCUMENTS_BUCKET).remove([oldPath]);
  }

  return {
    ok: true,
    data: {
      docKey,
      fileName: file.name,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
      verified: false,
    },
  };
}

export async function removeProgramDocument(
  applicationId: string,
  docKey: string,
  token: string | null
): Promise<DocResult> {
  const access = await authorizeApplicationAccess(applicationId, token);
  if (!access.ok) return { ok: false, error: "Not found." };

  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("program_documents")
    .select("storage_path")
    .eq("application_id", applicationId)
    .eq("doc_key", docKey)
    .maybeSingle();

  if (!row) return { ok: true, data: undefined };

  const { error } = await supabase
    .from("program_documents")
    .delete()
    .eq("application_id", applicationId)
    .eq("doc_key", docKey);

  if (error) return { ok: false, error: "Could not remove that document." };

  await supabase.storage
    .from(PROGRAM_DOCUMENTS_BUCKET)
    .remove([row.storage_path as string]);

  return { ok: true, data: undefined };
}

/** Staff only — verifying your own paperwork is not a thing. */
export async function verifyProgramDocument(
  applicationId: string,
  docKey: string,
  verified: boolean
): Promise<DocResult> {
  const access = await authorizeApplicationAccess(applicationId, null);
  if (!access.ok || !access.staff) return { ok: false, error: "Not authorized." };

  const { error } = await createServiceRoleClient()
    .from("program_documents")
    .update({
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? access.userId : null,
    })
    .eq("application_id", applicationId)
    .eq("doc_key", docKey);

  if (error) return { ok: false, error: "Could not update that document." };
  return { ok: true, data: undefined };
}
