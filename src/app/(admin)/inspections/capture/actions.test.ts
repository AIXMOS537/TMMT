import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authz and refusal behaviour for inspection capture.
 *
 * `touched` records every table and storage bucket the action reached, so an
 * empty list proves a rejected request never got near the data.
 */

const db = vi.hoisted(() => ({
  getUser: vi.fn(),
  touched: [] as string[],
  rows: {} as Record<string, unknown[]>,
  uploadError: null as { message: string } | null,
  insertError: null as { message: string } | null,
}));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    auth: { getUser: db.getUser },
    from: (table: string) => {
      db.touched.push(table);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: (db.rows[table] ?? [])[0] ?? null, error: null });
      b.insert = async () => ({ error: db.insertError });
      b.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(res({ data: db.rows[table] ?? [], error: null }));
      return b;
    },
    storage: {
      from: (bucket: string) => {
        db.touched.push(`storage:${bucket}`);
        return {
          upload: async () => ({ error: db.uploadError }),
          createSignedUrls: async () => ({ data: [] }),
        };
      },
    },
  }),
}));

import { listVehiclesForCapture, loadCaptureBoard, uploadInspectionPhoto } from "./actions";

function photo(type = "image/jpeg", size = 1000, name = "front.jpg") {
  return new File([new Uint8Array(size)], name, { type });
}

function form(over: Record<string, string | File> = {}) {
  const fd = new FormData();
  fd.set("vehicle_id", "veh-1");
  fd.set("stage", "pickup");
  fd.set("angle", "front");
  fd.set("photo", photo());
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.resetAllMocks();
  db.touched = [];
  db.rows = { vehicles: [{ id: "veh-1", org_id: "org-1" }] };
  db.uploadError = null;
  db.insertError = null;
  db.getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "admin" } } } });
});

describe("authz — a rejected caller never reaches the data", () => {
  it("refuses anonymous on every entry point", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } });
    expect((await listVehiclesForCapture()).ok).toBe(false);
    expect((await loadCaptureBoard("veh-1", "pickup")).ok).toBe(false);
    expect(await uploadInspectionPhoto(form())).toEqual({ ok: false, error: "Sign in first." });
    expect(db.touched).toEqual([]);
  });

  it("refuses a signed-in non-staff user on every entry point", async () => {
    db.getUser.mockResolvedValue({ data: { user: { id: "u2", app_metadata: { role: "customer" } } } });
    expect((await listVehiclesForCapture()).ok).toBe(false);
    expect((await uploadInspectionPhoto(form())).ok).toBe(false);
    expect(db.touched).toEqual([]);
  });
});

describe("upload — refuses before it stores anything", () => {
  it("refuses an unknown stage or angle rather than filing the photo loosely", async () => {
    expect((await uploadInspectionPhoto(form({ stage: "midway" }))).ok).toBe(false);
    expect((await uploadInspectionPhoto(form({ angle: "selfie" }))).ok).toBe(false);
    expect(db.touched.filter((t) => t.startsWith("storage:"))).toEqual([]);
  });

  it("refuses a PDF and an oversized file", async () => {
    const pdf = await uploadInspectionPhoto(form({ photo: photo("application/pdf") }));
    expect(pdf.ok).toBe(false);
    const big = await uploadInspectionPhoto(form({ photo: photo("image/jpeg", 10 * 1024 * 1024 + 1) }));
    expect(big.ok).toBe(false);
    expect(db.touched.filter((t) => t.startsWith("storage:"))).toEqual([]);
  });

  it("accepts HEIC, which is what an iPhone actually shoots", async () => {
    const res = await uploadInspectionPhoto(form({ photo: photo("image/heic", 2000, "IMG_0001.HEIC") }));
    expect(res).toEqual({ ok: true, angle: "front" });
  });

  it("refuses a vehicle that is not on the board, without uploading", async () => {
    db.rows = { vehicles: [] };
    const res = await uploadInspectionPhoto(form());
    expect(res.ok).toBe(false);
    expect(db.touched.filter((t) => t.startsWith("storage:"))).toEqual([]);
  });
});

describe("upload — the honest failure that matters most", () => {
  it("does NOT report success when the file stored but the row did not", async () => {
    // A row-less file is invisible; worse, a file-less row would read as proof
    // in a dispute. The operator must be told to retake it.
    db.insertError = { message: "insert blew up" };
    const res = await uploadInspectionPhoto(form());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/uploaded but not recorded[\s\S]*[Tt]ake it again/);
  });

  it("surfaces a storage failure instead of recording a photo that is not there", async () => {
    db.uploadError = { message: "bucket full" };
    const res = await uploadInspectionPhoto(form());
    expect(res.ok).toBe(false);
    // Nothing was written to vehicle_media.
    expect(db.touched).not.toContain("vehicle_media");
  });
});

describe("loadCaptureBoard", () => {
  it("refuses an unknown stage", async () => {
    const r = await loadCaptureBoard("veh-1", "whenever");
    expect(r).toEqual({ ok: false, error: "Unknown inspection stage." });
  });

  it("always returns all eight angles, so a gap is visible rather than absent", async () => {
    const r = await loadCaptureBoard("veh-1", "pickup");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.board.angles).toHaveLength(8);
    expect(r.board.progress.complete).toBe(false);
    expect(r.board.pairs).toBeNull(); // pairing is only meaningful on a return
  });

  it("reads the pickup set too when the stage is a return", async () => {
    const r = await loadCaptureBoard("veh-1", "return");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.board.pairs).toHaveLength(8);
  });
});
