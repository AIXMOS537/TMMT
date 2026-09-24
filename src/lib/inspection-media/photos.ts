import "server-only";

/**
 * Inspection photo capture — the vocabulary and the rules.
 *
 * WHY THIS EXISTS (2026-09-19)
 * The whole rail was already built and never used. Verified in production:
 * a private `vehicle-media` storage bucket (10 MB cap, accepts HEIC), storage
 * policies for staff write and client read, a `vehicle_media` table with RLS,
 * and `vehicle_damage_reports` beside it. Row count on both: ZERO. No code
 * touched either.
 *
 * Meanwhile the habit had collapsed: 1 handover record, 1 customer inspection
 * photo, 0 onboarding inspections, against 27 vehicles on the board. Every
 * damage argument TMMT loses starts there — you cannot win a dispute about a
 * scratch you never photographed.
 *
 * THE DESIGN DECISION THAT MATTERS
 * Photos are captured against a fixed ANGLE LIST at a named STAGE. That pairing
 * is the entire point: a return photo is only evidence if there is a pickup
 * photo of the same angle to compare it to. Free-form uploads produce a pile of
 * pictures; an angle-and-stage set produces a before/after. It is also what
 * makes an automated damage diff possible later — the hard part of that feature
 * is not the vision model, it is having comparable pairs to feed it.
 */

/** The moment in a rental a photo set belongs to. */
export const CAPTURE_STAGES = ["onboarding", "pickup", "return", "damage"] as const;
export type CaptureStage = (typeof CAPTURE_STAGES)[number];

export const STAGE_LABEL: Record<CaptureStage, string> = {
  onboarding: "Vehicle onboarding",
  pickup: "Handover to renter",
  return: "Return from renter",
  damage: "Damage report",
};

/**
 * The eight angles. Fixed, ordered, and deliberately small.
 *
 * Every commercial rental inspection tool shoots a fixed walk-around for the
 * same reason: a set that varies cannot be compared. Eight is the number that
 * covers the body panels plus the two readings that get disputed most often
 * (odometer and fuel), while still being quick enough that a busy operator
 * actually completes it. A checklist nobody finishes is worse than none,
 * because it looks like evidence and isn't.
 */
export const CAPTURE_ANGLES = [
  "front",
  "rear",
  "driver_side",
  "passenger_side",
  "odometer",
  "fuel_gauge",
  "interior_front",
  "interior_rear",
] as const;
export type CaptureAngle = (typeof CAPTURE_ANGLES)[number];

export const ANGLE_LABEL: Record<CaptureAngle, string> = {
  front: "Front",
  rear: "Rear",
  driver_side: "Driver side",
  passenger_side: "Passenger side",
  odometer: "Odometer",
  fuel_gauge: "Fuel gauge",
  interior_front: "Interior — front",
  interior_rear: "Interior — rear",
};

/** What the operator should actually point the camera at. */
export const ANGLE_HINT: Record<CaptureAngle, string> = {
  front: "Whole front, straight on, both headlights and the bumper in frame.",
  rear: "Whole rear, straight on, plate and bumper in frame.",
  driver_side: "Full length of the driver side, both wheels in frame.",
  passenger_side: "Full length of the passenger side, both wheels in frame.",
  odometer: "Dash lit, mileage readable. This is the number overage is billed from.",
  fuel_gauge: "Dash lit, needle clearly above or below the marks.",
  interior_front: "Front seats and dash, doors open, footwells visible.",
  interior_rear: "Rear seats and floor, and the boot if it opens separately.",
};

export function isCaptureStage(v: unknown): v is CaptureStage {
  return typeof v === "string" && (CAPTURE_STAGES as readonly string[]).includes(v);
}

export function isCaptureAngle(v: unknown): v is CaptureAngle {
  return typeof v === "string" && (CAPTURE_ANGLES as readonly string[]).includes(v);
}

export const VEHICLE_MEDIA_BUCKET = "vehicle-media";

/** Matches the bucket's own limit in production. Checked here so the operator gets a sentence, not a 413. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Mirrors the bucket's allowed_mime_types exactly, HEIC included — an iPhone
 * shooting in its default format produces HEIC, and rejecting it would mean
 * rejecting most photos an operator actually takes.
 */
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export function photoExtension(mime: string): string | null {
  return PHOTO_TYPES[mime.toLowerCase()] ?? null;
}

export type PhotoCheck = { ok: true } | { ok: false; error: string };

export function assertInspectionPhoto(file: { type: string; size: number }): PhotoCheck {
  if (!photoExtension(file.type)) {
    return { ok: false, error: "Use a photo from your camera — JPEG, PNG, HEIC or WebP." };
  }
  if (file.size === 0) {
    return { ok: false, error: "That file is empty. Take the photo again." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Each photo must be 10 MB or smaller." };
  }
  return { ok: true };
}

/**
 * Storage key. Vehicle first, then stage, so a whole set is one prefix listing
 * and a vehicle's entire history is one folder.
 *
 * `stamp` is passed in rather than read from the clock so this stays pure and
 * testable, and so a retry of the same upload is not silently a different key.
 */
export function inspectionPhotoKey(args: {
  vehicleId: string;
  stage: CaptureStage;
  angle: CaptureAngle;
  mime: string;
  stamp: number;
}): string {
  const ext = photoExtension(args.mime) ?? "jpg";
  return `vehicles/${args.vehicleId}/${args.stage}/${args.angle}-${args.stamp}.${ext}`;
}

export type CapturedPhoto = { angle: string; storage_path: string };

export type SetProgress = {
  captured: CaptureAngle[];
  missing: CaptureAngle[];
  complete: boolean;
  /** 0-100, for a progress bar. */
  percent: number;
};

/**
 * What is shot and what is still missing for one stage.
 *
 * An unknown angle in the data is IGNORED rather than counted: a stray upload
 * must never make a set look complete when a required angle is absent. The
 * checklist is the contract, not whatever happens to be in the folder.
 */
export function setProgress(photos: readonly CapturedPhoto[]): SetProgress {
  const have = new Set(photos.map((p) => p.angle).filter(isCaptureAngle));
  const captured = CAPTURE_ANGLES.filter((a) => have.has(a));
  const missing = CAPTURE_ANGLES.filter((a) => !have.has(a));
  return {
    captured,
    missing,
    complete: missing.length === 0,
    percent: Math.round((captured.length / CAPTURE_ANGLES.length) * 100),
  };
}

/**
 * Pair a return set against its pickup set, angle by angle.
 *
 * This is the before/after a damage claim is actually argued from, and the
 * shape an automated diff would consume. `comparable` is the honest field: an
 * angle with only one side is not evidence of anything, and must never be
 * presented as if it were.
 */
export type AnglePair = {
  angle: CaptureAngle;
  label: string;
  before: string | null;
  after: string | null;
  comparable: boolean;
};

export function pairSets(
  before: readonly CapturedPhoto[],
  after: readonly CapturedPhoto[]
): AnglePair[] {
  const b = new Map(before.filter((p) => isCaptureAngle(p.angle)).map((p) => [p.angle, p.storage_path]));
  const a = new Map(after.filter((p) => isCaptureAngle(p.angle)).map((p) => [p.angle, p.storage_path]));
  return CAPTURE_ANGLES.map((angle) => {
    const bp = b.get(angle) ?? null;
    const ap = a.get(angle) ?? null;
    return { angle, label: ANGLE_LABEL[angle], before: bp, after: ap, comparable: bp !== null && ap !== null };
  });
}
