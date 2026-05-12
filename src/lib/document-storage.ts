import "server-only";

export const DOCUMENTS_BUCKET = "staff-documents";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const PDF_TYPES = new Set(["application/pdf"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMime(mime: string): string | null {
  return EXT[mime] ?? null;
}

export function assertPdfFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!PDF_TYPES.has(file.type)) {
    return { ok: false, error: "Please upload a PDF file." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "PDF must be 15 MB or smaller." };
  }
  return { ok: true };
}

export function assertLicenseImageFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Use JPEG, PNG, or WebP for license photos." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Each image must be 8 MB or smaller." };
  }
  return { ok: true };
}

export function contractPdfObjectKey(contractId: string, mime: string): string {
  const ext = extensionForMime(mime) ?? "pdf";
  return `contracts/${contractId}/contract-${Date.now()}.${ext}`;
}

export function licenseObjectKey(
  table: "background_checks" | "active_customers",
  rowId: string,
  side: "front" | "back",
  mime: string
): string {
  const ext = extensionForMime(mime) ?? "jpg";
  const prefix = table === "background_checks" ? "licenses/background_checks" : "licenses/active_customers";
  return `${prefix}/${rowId}/${side}-${Date.now()}.${ext}`;
}
