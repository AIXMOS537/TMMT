import "server-only";

export const PROGRAM_DOCUMENTS_BUCKET = "program-documents";

/** Matches the bucket's own file_size_limit, so a rejection is explained here
 *  rather than arriving as an opaque storage error. */
export const MAX_PROGRAM_FILE_BYTES = 12 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function assertProgramUploadFile(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (file.size === 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP, or PDF." };
  }
  if (file.size > MAX_PROGRAM_FILE_BYTES) {
    return { ok: false, error: "File must be 12 MB or smaller." };
  }
  return { ok: true };
}

/**
 * Where the object lives.
 *
 * The extension comes from the MIME type rather than the supplied name, and the
 * name itself is stripped to a safe set and truncated — an uploaded filename is
 * user input, and it ends up in a path.
 */
export function programDocumentObjectKey(
  applicationId: string,
  docKey: string,
  fileName: string,
  mime: string
): string {
  const ext = EXT[mime] ?? "bin";
  const safeDoc = docKey.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return `${applicationId}/${safeDoc}/${Date.now()}-${safeName}.${ext}`;
}
