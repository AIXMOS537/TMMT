"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import {
  ANGLE_HINT,
  ANGLE_LABEL,
  CAPTURE_ANGLES,
  VEHICLE_MEDIA_BUCKET,
  assertInspectionPhoto,
  inspectionPhotoKey,
  isCaptureAngle,
  isCaptureStage,
  pairSets,
  setProgress,
  type AnglePair,
  type CaptureAngle,
  type CaptureStage,
  type SetProgress,
} from "@/lib/inspection-media/photos";

/**
 * Inspection photo capture — server side.
 *
 * The storage bucket, its policies, the `vehicle_media` table and its RLS were
 * all provisioned long ago and had never been written to: 0 rows, 0 callers.
 * This is the first code that uses any of it.
 *
 * OWNER-APPROVAL GATE: not required, and the boundary is deliberate. Taking a
 * photo of a car sends nothing, charges nothing and commits nobody. It records
 * evidence. Raising a damage CLAIM against a renter — money, and an accusation
 * in Taha's name — is a different action and routes through
 * shared/owner-approval-gate/. Do not add it here.
 */

export type VehicleOption = { id: string; label: string; plate: string | null };

export type CaptureAngleView = {
  angle: CaptureAngle;
  label: string;
  hint: string;
  /** Signed URL for the shot already taken at this stage, or null. */
  url: string | null;
  /** Signed URL of the same angle at pickup, when reviewing a return. */
  beforeUrl: string | null;
};

export type CaptureBoard = {
  vehicleId: string;
  stage: CaptureStage;
  angles: CaptureAngleView[];
  progress: SetProgress;
  /** Only populated for the `return` stage. */
  pairs: AnglePair[] | null;
};

/** Signed URLs expire; an inspection screen is read in minutes, not days. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

async function requireStaff() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in first.", supabase, user: null };
  if (!isStaffUser(user)) return { ok: false as const, error: "Staff only.", supabase, user: null };
  return { ok: true as const, supabase, user };
}

export async function listVehiclesForCapture() {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const { data, error } = await gate.supabase
    .from("vehicles")
    .select("id, label, plate")
    .eq("active", true)
    .order("label");
  if (error) return { ok: false as const, error: `Could not read vehicles: ${error.message}` };

  return {
    ok: true as const,
    vehicles: (data ?? []).map((v) => ({
      id: String(v.id),
      label: (v.label as string) ?? "Unnamed vehicle",
      plate: (v.plate as string) ?? null,
    })) as VehicleOption[],
  };
}

type MediaRow = { storage_path: string; metadata: Record<string, unknown> | null };

async function readStage(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  vehicleId: string,
  stage: CaptureStage
): Promise<{ angle: string; storage_path: string }[]> {
  const { data } = await supabase
    .from("vehicle_media")
    .select("storage_path, metadata")
    .eq("vehicle_id", vehicleId)
    .eq("metadata->>stage", stage)
    .order("created_at", { ascending: false });

  // Newest wins per angle: a re-shot photo replaces the earlier one on screen
  // without deleting the original, so the history stays intact.
  const seen = new Map<string, string>();
  for (const row of (data ?? []) as MediaRow[]) {
    const angle = String(row.metadata?.angle ?? "");
    if (!angle || seen.has(angle)) continue;
    seen.set(angle, row.storage_path);
  }
  return [...seen].map(([angle, storage_path]) => ({ angle, storage_path }));
}

async function sign(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await supabase.storage
    .from(VEHICLE_MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl);
  }
  return out;
}

export async function loadCaptureBoard(vehicleId: string, stageRaw: string) {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!isCaptureStage(stageRaw)) return { ok: false as const, error: "Unknown inspection stage." };
  const stage = stageRaw;

  const current = await readStage(gate.supabase, vehicleId, stage);
  // A return is only meaningful against the pickup it is being compared to.
  const before = stage === "return" ? await readStage(gate.supabase, vehicleId, "pickup") : [];

  const urls = await sign(gate.supabase, [
    ...current.map((p) => p.storage_path),
    ...before.map((p) => p.storage_path),
  ]);

  const currentByAngle = new Map(current.map((p) => [p.angle, p.storage_path]));
  const beforeByAngle = new Map(before.map((p) => [p.angle, p.storage_path]));

  const angles: CaptureAngleView[] = CAPTURE_ANGLES.map((angle) => {
    const path = currentByAngle.get(angle);
    const beforePath = beforeByAngle.get(angle);
    return {
      angle,
      label: ANGLE_LABEL[angle],
      hint: ANGLE_HINT[angle],
      url: path ? (urls.get(path) ?? null) : null,
      beforeUrl: beforePath ? (urls.get(beforePath) ?? null) : null,
    };
  });

  return {
    ok: true as const,
    board: {
      vehicleId,
      stage,
      angles,
      progress: setProgress(current),
      pairs: stage === "return" ? pairSets(before, current) : null,
    } as CaptureBoard,
  };
}

export type UploadResult = { ok: true; angle: CaptureAngle } | { ok: false; error: string };

/**
 * Store one photo and record it.
 *
 * Order matters: the file goes to storage FIRST, and only a confirmed upload
 * gets a row. The reverse would leave `vehicle_media` claiming evidence that is
 * not there — a row pointing at nothing is worse than no row, because it reads
 * as proof in a dispute.
 */
export async function uploadInspectionPhoto(form: FormData): Promise<UploadResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const vehicleId = String(form.get("vehicle_id") ?? "");
  const stage = String(form.get("stage") ?? "");
  const angle = String(form.get("angle") ?? "");
  const file = form.get("photo");

  if (!vehicleId) return { ok: false, error: "Pick a vehicle first." };
  if (!isCaptureStage(stage)) return { ok: false, error: "Unknown inspection stage." };
  if (!isCaptureAngle(angle)) return { ok: false, error: "Unknown angle." };
  if (!(file instanceof File)) return { ok: false, error: "No photo was attached." };

  const check = assertInspectionPhoto(file);
  if (!check.ok) return { ok: false, error: check.error };

  const { data: vehicle } = await gate.supabase
    .from("vehicles")
    .select("id, org_id")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!vehicle) return { ok: false, error: "That vehicle is no longer on the board." };

  const key = inspectionPhotoKey({
    vehicleId,
    stage,
    angle,
    mime: file.type,
    stamp: Date.now(),
  });

  const { error: upErr } = await gate.supabase.storage
    .from(VEHICLE_MEDIA_BUCKET)
    .upload(key, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };

  const { error: rowErr } = await gate.supabase.from("vehicle_media").insert({
    vehicle_id: vehicleId,
    org_id: vehicle.org_id ?? null,
    storage_path: key,
    file_name: file.name || `${angle}.jpg`,
    caption: `${ANGLE_LABEL[angle]} — ${stage}`,
    media_type: file.type,
    // The renter does not see inspection photos by default. Showing them is a
    // deliberate act, not a side effect of taking one.
    visible_to_client: false,
    uploaded_by: gate.user.id,
    metadata: { stage, angle, captured_at: new Date().toISOString() },
  });
  if (rowErr) {
    // The file is stored but unrecorded. Say so plainly rather than reporting
    // success — an operator who believes this shot was saved will not retake it.
    return {
      ok: false,
      error: `Photo uploaded but not recorded (${rowErr.message}). Take it again.`,
    };
  }

  return { ok: true, angle };
}
