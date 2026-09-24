import { describe, it, expect } from "vitest";
import {
  ANGLE_LABEL,
  CAPTURE_ANGLES,
  CAPTURE_STAGES,
  MAX_PHOTO_BYTES,
  assertInspectionPhoto,
  inspectionPhotoKey,
  isCaptureAngle,
  isCaptureStage,
  pairSets,
  photoExtension,
  setProgress,
} from "./photos";

describe("vocabulary", () => {
  it("is the eight angles, in walk-around order", () => {
    expect([...CAPTURE_ANGLES]).toEqual([
      "front",
      "rear",
      "driver_side",
      "passenger_side",
      "odometer",
      "fuel_gauge",
      "interior_front",
      "interior_rear",
    ]);
  });

  it("labels every angle and stage — no raw slug ever reaches an operator", () => {
    for (const a of CAPTURE_ANGLES) expect(ANGLE_LABEL[a]).toBeTruthy();
    expect(CAPTURE_STAGES.length).toBe(4);
  });

  it("rejects anything outside the vocabulary", () => {
    expect(isCaptureAngle("bonnet")).toBe(false);
    expect(isCaptureStage("midway")).toBe(false);
    expect(isCaptureAngle("front")).toBe(true);
    expect(isCaptureStage("pickup")).toBe(true);
  });
});

describe("assertInspectionPhoto", () => {
  it("accepts HEIC, because that is what an iPhone actually produces", () => {
    expect(assertInspectionPhoto({ type: "image/heic", size: 2_000_000 })).toEqual({ ok: true });
    expect(assertInspectionPhoto({ type: "image/heif", size: 2_000_000 })).toEqual({ ok: true });
  });

  it("accepts the other formats the bucket allows", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp"]) {
      expect(assertInspectionPhoto({ type: t, size: 1000 }).ok).toBe(true);
    }
  });

  it("refuses a PDF with a sentence, not a format code", () => {
    const r = assertInspectionPhoto({ type: "application/pdf", size: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/photo from your camera/);
  });

  it("refuses an empty file rather than storing a zero-byte 'photo'", () => {
    const r = assertInspectionPhoto({ type: "image/jpeg", size: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/empty/);
  });

  it("refuses over the bucket's own 10 MB cap, so the operator gets a sentence not a 413", () => {
    expect(assertInspectionPhoto({ type: "image/jpeg", size: MAX_PHOTO_BYTES }).ok).toBe(true);
    expect(assertInspectionPhoto({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 }).ok).toBe(false);
  });

  it("is case-insensitive about the mime type", () => {
    expect(photoExtension("IMAGE/JPEG")).toBe("jpg");
  });
});

describe("inspectionPhotoKey", () => {
  it("groups a whole set under one vehicle+stage prefix", () => {
    const k = inspectionPhotoKey({
      vehicleId: "veh-1", stage: "pickup", angle: "odometer", mime: "image/heic", stamp: 1700000000000,
    });
    expect(k).toBe("vehicles/veh-1/pickup/odometer-1700000000000.heic");
  });

  it("is deterministic for the same stamp, so a retry is the same key", () => {
    const args = { vehicleId: "v", stage: "return", angle: "front", mime: "image/jpeg", stamp: 42 } as const;
    expect(inspectionPhotoKey(args)).toBe(inspectionPhotoKey(args));
  });

  it("falls back to jpg rather than producing an extensionless key", () => {
    const k = inspectionPhotoKey({
      vehicleId: "v", stage: "damage", angle: "rear", mime: "image/tiff", stamp: 1,
    });
    expect(k.endsWith(".jpg")).toBe(true);
  });
});

describe("setProgress", () => {
  it("reports an empty set honestly", () => {
    const p = setProgress([]);
    expect(p.complete).toBe(false);
    expect(p.percent).toBe(0);
    expect(p.missing).toHaveLength(8);
  });

  it("counts a partial set and names exactly what is missing", () => {
    const p = setProgress([
      { angle: "front", storage_path: "a" },
      { angle: "rear", storage_path: "b" },
    ]);
    expect(p.percent).toBe(25);
    expect(p.captured).toEqual(["front", "rear"]);
    expect(p.missing).toContain("odometer");
    expect(p.complete).toBe(false);
  });

  it("is complete only when all eight are present", () => {
    const p = setProgress(CAPTURE_ANGLES.map((a) => ({ angle: a, storage_path: a })));
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
  });

  it("a stray upload can NEVER make a set look complete", () => {
    // Seven real angles plus junk must not read as done.
    const seven = CAPTURE_ANGLES.slice(0, 7).map((a) => ({ angle: a, storage_path: a }));
    const p = setProgress([...seven, { angle: "selfie", storage_path: "x" }]);
    expect(p.complete).toBe(false);
    expect(p.missing).toEqual(["interior_rear"]);
  });
});

describe("pairSets — the before/after a claim is argued from", () => {
  it("marks an angle comparable only when BOTH sides exist", () => {
    const pairs = pairSets(
      [{ angle: "front", storage_path: "before/front" }, { angle: "rear", storage_path: "before/rear" }],
      [{ angle: "front", storage_path: "after/front" }]
    );
    const front = pairs.find((p) => p.angle === "front")!;
    const rear = pairs.find((p) => p.angle === "rear")!;
    const odo = pairs.find((p) => p.angle === "odometer")!;

    expect(front.comparable).toBe(true);
    expect(front.before).toBe("before/front");
    expect(front.after).toBe("after/front");

    // Pickup only — a scratch here proves nothing about who caused it.
    expect(rear.comparable).toBe(false);
    expect(rear.after).toBeNull();

    // Neither side.
    expect(odo.comparable).toBe(false);
    expect(odo.before).toBeNull();
  });

  it("always returns all eight angles, so a missing one is visible rather than absent", () => {
    expect(pairSets([], [])).toHaveLength(8);
    expect(pairSets([], []).every((p) => !p.comparable)).toBe(true);
  });

  it("ignores angles outside the vocabulary on both sides", () => {
    const pairs = pairSets(
      [{ angle: "selfie", storage_path: "x" }],
      [{ angle: "selfie", storage_path: "y" }]
    );
    expect(pairs.every((p) => !p.comparable)).toBe(true);
  });
});
