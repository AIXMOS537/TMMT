"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isStaffUser } from "@/lib/auth-roles";
import { adminUpsert } from "@/lib/admin-actions";
import {
  DOCUMENTS_BUCKET,
  assertLicenseImageFile,
  assertPdfFile,
  contractPdfObjectKey,
  licenseObjectKey,
} from "@/lib/document-storage";

type DocResult<T = void> = { success: true; data?: T } | { success: false; error: string };

type LicenseTable = "background_checks" | "active_customers";

function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function requireStaff(): Promise<DocResult<{ userId: string }>> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isStaffUser(user)) return { success: false, error: "Not authorized." };
  return { success: true, data: { userId: user.id } };
}

/** Signed read URL for staff preview (short-lived). */
export async function getSignedDocumentUrl(
  storagePath: string
): Promise<DocResult<{ url: string }>> {
  const gate = await requireStaff();
  if (!gate.success) return gate;
  if (!storagePath || storagePath.includes("..")) {
    return { success: false, error: "Invalid path." };
  }
  const svc = createServiceRoleClient();
  const { data, error } = await svc.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    console.error("[getSignedDocumentUrl]", error?.message);
    return { success: false, error: "Could not create link." };
  }
  return { success: true, data: { url: data.signedUrl } };
}

export async function uploadContractPdf(formData: FormData): Promise<DocResult> {
  const gate = await requireStaff();
  if (!gate.success) return gate;

  const contractId = String(formData.get("contractId") ?? "").trim();
  const file = formData.get("file");
  if (!contractId || !(file instanceof File) || file.size === 0) {
    return { success: false, error: "Contract and PDF file are required." };
  }
  const pdf = assertPdfFile(file);
  if (!pdf.ok) return { success: false, error: pdf.error };

  const supabase = await createSSRClient();
  const { data: row, error: fetchErr } = await supabase
    .from("contracts")
    .select("id, contract_pdf_storage_path")
    .eq("id", contractId)
    .maybeSingle();
  if (fetchErr || !row?.id) {
    return { success: false, error: "Contract not found." };
  }

  const svc = createServiceRoleClient();
  const oldPath = row.contract_pdf_storage_path as string | null;
  const objectKey = contractPdfObjectKey(contractId, file.type);
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage.from(DOCUMENTS_BUCKET).upload(objectKey, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    console.error("[uploadContractPdf]", upErr.message);
    return { success: false, error: "Upload failed." };
  }
  if (oldPath) {
    await svc.storage.from(DOCUMENTS_BUCKET).remove([oldPath]).catch(() => {});
  }

  const now = new Date().toISOString();
  const result = await adminUpsert("contracts", {
    id: contractId,
    contract_pdf_storage_path: objectKey,
    contract_pdf_uploaded_at: now,
  });
  if (!result.success) {
    await svc.storage.from(DOCUMENTS_BUCKET).remove([objectKey]).catch(() => {});
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function removeContractPdf(contractId: string): Promise<DocResult> {
  const gate = await requireStaff();
  if (!gate.success) return gate;
  if (!contractId) return { success: false, error: "Missing contract id." };

  const supabase = await createSSRClient();
  const { data: row } = await supabase
    .from("contracts")
    .select("contract_pdf_storage_path")
    .eq("id", contractId)
    .maybeSingle();
  const path = row?.contract_pdf_storage_path as string | null;
  if (path) {
    const svc = createServiceRoleClient();
    await svc.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => {});
  }
  const result = await adminUpsert("contracts", {
    id: contractId,
    contract_pdf_storage_path: null,
    contract_pdf_uploaded_at: null,
  });
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

export async function uploadStaffLicenseImage(formData: FormData): Promise<DocResult> {
  const gate = await requireStaff();
  if (!gate.success) return gate;

  const table = String(formData.get("table") ?? "") as LicenseTable;
  const recordId = String(formData.get("recordId") ?? "").trim();
  const side = String(formData.get("side") ?? "") as "front" | "back";
  const file = formData.get("file");

  if (table !== "background_checks" && table !== "active_customers") {
    return { success: false, error: "Invalid request." };
  }
  if (!recordId || (side !== "front" && side !== "back")) {
    return { success: false, error: "Invalid request." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose an image file." };
  }
  const img = assertLicenseImageFile(file);
  if (!img.ok) return { success: false, error: img.error };

  const supabase = await createSSRClient();
  const { data: existing, error: fe } = await supabase
    .from(table)
    .select("id, drivers_license_front_path, drivers_license_back_path")
    .eq("id", recordId)
    .maybeSingle();
  if (fe || !existing?.id) return { success: false, error: "Record not found." };

  const col = side === "front" ? "drivers_license_front_path" : "drivers_license_back_path";
  const oldPath = (existing as Record<string, unknown>)[col] as string | null;

  const svc = createServiceRoleClient();
  const objectKey = licenseObjectKey(table, recordId, side, file.type);
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage.from(DOCUMENTS_BUCKET).upload(objectKey, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    console.error("[uploadStaffLicenseImage]", upErr.message);
    return { success: false, error: "Upload failed." };
  }
  if (oldPath) await svc.storage.from(DOCUMENTS_BUCKET).remove([oldPath]).catch(() => {});

  const patch: Record<string, unknown> = { id: recordId, [col]: objectKey };
  const result = await adminUpsert(table, patch);
  if (!result.success) {
    await svc.storage.from(DOCUMENTS_BUCKET).remove([objectKey]).catch(() => {});
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function removeStaffLicenseImage(
  table: LicenseTable,
  recordId: string,
  side: "front" | "back"
): Promise<DocResult> {
  const gate = await requireStaff();
  if (!gate.success) return gate;
  if (table !== "background_checks" && table !== "active_customers") {
    return { success: false, error: "Invalid request." };
  }
  if (!recordId || (side !== "front" && side !== "back")) {
    return { success: false, error: "Invalid request." };
  }

  const col = side === "front" ? "drivers_license_front_path" : "drivers_license_back_path";
  const supabase = await createSSRClient();
  const { data: existing } = await supabase.from(table).select(col).eq("id", recordId).maybeSingle();
  const row = existing as Record<string, unknown> | null;
  const path = row?.[col] as string | null;
  if (path) {
    const svc = createServiceRoleClient();
    await svc.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => {});
  }
  const result = await adminUpsert(table, { id: recordId, [col]: null });
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

const mintSchema = z.object({
  table: z.enum(["background_checks", "active_customers"]),
  id: z.string().uuid(),
});

/** Sets a 7-day upload token and returns the public form URL (staff shares manually). */
export async function mintLicenseUploadLink(
  formData: FormData
): Promise<DocResult<{ url: string; expiresAt: string }>> {
  const gate = await requireStaff();
  if (!gate.success) return gate;

  const raw = { table: formData.get("table"), id: formData.get("id") };
  const parsed = mintSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Invalid record." };

  const { table, id } = parsed.data;
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresIso = expires.toISOString();

  const supabase = await createSSRClient();
  const { data: row, error } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  if (error || !row) return { success: false, error: "Record not found." };

  const result = await adminUpsert(table, {
    id,
    license_upload_token: token,
    license_upload_token_expires_at: expiresIso,
  });
  if (!result.success) return { success: false, error: result.error };

  const url = `${siteOrigin()}/forms/license-upload?token=${encodeURIComponent(token)}`;
  return { success: true, data: { url, expiresAt: expiresIso } };
}
