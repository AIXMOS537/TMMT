import "server-only";

export const VENDOR_FILES_BUCKET = "vendor-files";

export const MAX_VENDOR_FILE_BYTES = 12 * 1024 * 1024;

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

export function assertVendorUploadFile(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Upload JPEG, PNG, WebP, or PDF only." };
  }
  if (file.size > MAX_VENDOR_FILE_BYTES) {
    return { ok: false, error: "File must be 12 MB or smaller." };
  }
  return { ok: true };
}

export function vendorJobObjectKey(
  vendorJobId: string,
  fileName: string,
  mime: string
): string {
  const ext = EXT[mime] ?? fileName.split(".").pop() ?? "bin";
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `jobs/${vendorJobId}/${Date.now()}-${safe}.${ext}`;
}
