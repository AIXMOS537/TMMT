"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  DOCUMENTS_BUCKET,
  assertLicenseImageFile,
  licenseObjectKey,
} from "@/lib/document-storage";

type FormResult = { success: true } | { success: false; error: string };

const tokenSchema = z.string().uuid();

type LicenseTable = "background_checks" | "active_customers";

async function findRowByLicenseToken(
  token: string
): Promise<{ table: LicenseTable; id: string } | null> {
  const svc = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: bg } = await svc
    .from("background_checks")
    .select("id")
    .eq("license_upload_token", token)
    .gt("license_upload_token_expires_at", now)
    .maybeSingle();
  if (bg?.id) return { table: "background_checks", id: bg.id as string };

  const { data: ac } = await svc
    .from("active_customers")
    .select("id")
    .eq("license_upload_token", token)
    .gt("license_upload_token_expires_at", now)
    .maybeSingle();
  if (ac?.id) return { table: "active_customers", id: ac.id as string };

  return null;
}

/** Anonymous: upload front + back license images using a staff-minted token. */
export async function submitLicenseUpload(formData: FormData): Promise<FormResult> {
  const tokenRaw = String(formData.get("token") ?? "").trim();
  const parsedToken = tokenSchema.safeParse(tokenRaw);
  if (!parsedToken.success) {
    return { success: false, error: "This link is invalid or expired." };
  }
  const token = parsedToken.data;

  const front = formData.get("front");
  const back = formData.get("back");
  if (!(front instanceof File) || front.size === 0) {
    return { success: false, error: "Front of license is required." };
  }
  if (!(back instanceof File) || back.size === 0) {
    return { success: false, error: "Back of license is required." };
  }

  const vf = assertLicenseImageFile(front);
  if (!vf.ok) return { success: false, error: vf.error };
  const vb = assertLicenseImageFile(back);
  if (!vb.ok) return { success: false, error: vb.error };

  const found = await findRowByLicenseToken(token);
  if (!found) {
    return { success: false, error: "This link is invalid or has expired. Ask staff for a new link." };
  }

  const svc = createServiceRoleClient();
  const { data: existing, error: readErr } = await svc
    .from(found.table)
    .select("drivers_license_front_path, drivers_license_back_path")
    .eq("id", found.id)
    .maybeSingle();
  if (readErr || !existing) {
    return { success: false, error: "Could not load record." };
  }

  const oldFront = existing.drivers_license_front_path as string | null;
  const oldBack = existing.drivers_license_back_path as string | null;

  const frontKey = licenseObjectKey(found.table, found.id, "front", front.type);
  const backKey = licenseObjectKey(found.table, found.id, "back", back.type);

  const frontBuf = Buffer.from(await front.arrayBuffer());
  const backBuf = Buffer.from(await back.arrayBuffer());

  const { error: e1 } = await svc.storage.from(DOCUMENTS_BUCKET).upload(frontKey, frontBuf, {
    contentType: front.type,
    upsert: false,
  });
  if (e1) {
    console.error("[submitLicenseUpload] front", e1.message);
    return { success: false, error: "Upload failed. Try again." };
  }
  const { error: e2 } = await svc.storage.from(DOCUMENTS_BUCKET).upload(backKey, backBuf, {
    contentType: back.type,
    upsert: false,
  });
  if (e2) {
    await svc.storage.from(DOCUMENTS_BUCKET).remove([frontKey]).catch(() => {});
    console.error("[submitLicenseUpload] back", e2.message);
    return { success: false, error: "Upload failed. Try again." };
  }

  const toRemove = [oldFront, oldBack].filter(Boolean) as string[];
  if (toRemove.length) await svc.storage.from(DOCUMENTS_BUCKET).remove(toRemove).catch(() => {});

  const { error: upRowErr } = await svc
    .from(found.table)
    .update({
      drivers_license_front_path: frontKey,
      drivers_license_back_path: backKey,
      license_upload_token: null,
      license_upload_token_expires_at: null,
    })
    .eq("id", found.id);

  if (upRowErr) {
    await svc.storage.from(DOCUMENTS_BUCKET).remove([frontKey, backKey]).catch(() => {});
    console.error("[submitLicenseUpload] db", upRowErr.message);
    return { success: false, error: "Could not save. Please try again." };
  }

  return { success: true };
}
