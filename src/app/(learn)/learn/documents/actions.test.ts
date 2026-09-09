import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { OWNER, STAFF } from "@/lib/testing/role-users";

/**
 * T-03 for the funding-application documents. Everything here runs on the
 * service role because the applicant may arrive on a token deep link with no
 * session, so authorizeApplicationAccess() (src/lib/program-applications-server.ts,
 * the one shared rule: token, or staff session, or the applicant's own email)
 * is the only gate. These tests pin the contract the actions have with it:
 * it is asked first, with the caller's application id and token; a refusal
 * means no storage call and no row; a token holder is never "staff".
 */
const state = vi.hoisted(() => ({
  svc: null as unknown,
  authorize: vi.fn(),
}));

vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/lib/program-applications-server", () => ({ authorizeApplicationAccess: state.authorize }));

import { listProgramDocuments, removeProgramDocument, uploadProgramDocument, verifyProgramDocument } from "./actions";

const APP_ID = "f1000000-0000-4000-8000-000000000001";
const TOKEN = "tok_synthetic_0000000000000000";

const form = (fields: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "payslip.pdf", { type: "application/pdf" });

function setDb(existingPath: string | null = "programs/old.pdf") {
  state.svc = makeFakeSupabase((call) => {
    if (call.table === "program_documents" && call.op === "select" && call.columns === "storage_path") {
      return { data: existingPath ? { storage_path: existingPath } : null };
    }
    if (call.table === "program_documents" && call.op === "select") {
      return { data: [{ doc_key: "payslip", file_name: "payslip.pdf", size_bytes: 4, created_at: "2026-09-01T00:00:00Z", verified_at: null }] };
    }
    return undefined;
  });
  return state.svc as FakeSupabase;
}

const everyAction: Array<[string, () => Promise<unknown>, string]> = [
  ["listProgramDocuments", () => listProgramDocuments(APP_ID, TOKEN), "Not found."],
  ["uploadProgramDocument", () => uploadProgramDocument(form({ applicationId: APP_ID, docKey: "payslip", token: TOKEN, file: pdf() })), "Not found."],
  ["removeProgramDocument", () => removeProgramDocument(APP_ID, "payslip", TOKEN), "Not found."],
  ["verifyProgramDocument", () => verifyProgramDocument(APP_ID, "payslip", true), "Not authorized."],
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("program documents: refused access", () => {
  it.each(everyAction)("%s answers %s with no storage or table access when authorization fails", async (_label, run, error) => {
    const db = setDb();
    state.authorize.mockResolvedValue({ ok: false });
    expect(await run()).toEqual({ ok: false, error });
    expect(db.calls).toHaveLength(0);
    expect(db.storageCalls).toHaveLength(0);
  });

  it("asks the shared rule with the caller's application id and token, before anything else", async () => {
    setDb();
    state.authorize.mockResolvedValue({ ok: false });
    await listProgramDocuments(APP_ID, TOKEN);
    await uploadProgramDocument(form({ applicationId: APP_ID, docKey: "payslip", token: TOKEN, file: pdf() }));
    await removeProgramDocument(APP_ID, "payslip", null);
    await verifyProgramDocument(APP_ID, "payslip", true);
    expect(state.authorize.mock.calls).toEqual([
      [APP_ID, TOKEN],
      [APP_ID, TOKEN],
      [APP_ID, null],
      // verification never honours a token — it is a staff-session decision.
      [APP_ID, null],
    ]);
  });

  it("verifyProgramDocument refuses a non-staff session or a token holder even when access is granted", async () => {
    const db = setDb();
    state.authorize.mockResolvedValueOnce({ ok: true, staff: false, userId: OWNER.id });
    expect(await verifyProgramDocument(APP_ID, "payslip", true)).toEqual({ ok: false, error: "Not authorized." });
    state.authorize.mockResolvedValueOnce({ ok: true, staff: false, userId: null });
    expect(await verifyProgramDocument(APP_ID, "payslip", true)).toEqual({ ok: false, error: "Not authorized." });
    expect(writes(db)).toHaveLength(0);
  });

  it("uploadProgramDocument validates the request shape before consulting authorization", async () => {
    const db = setDb();
    expect(await uploadProgramDocument(form({ docKey: "payslip", file: pdf() }))).toEqual({ ok: false, error: "Missing application or document." });
    expect(await uploadProgramDocument(form({ applicationId: APP_ID, docKey: "payslip" }))).toEqual({ ok: false, error: "Choose a file first." });
    expect(state.authorize).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(0);
  });
});

describe("program documents: token holder (the applicant)", () => {
  const applicant = { ok: true, staff: false, userId: null };

  it("lists only that application's documents", async () => {
    const db = setDb();
    state.authorize.mockResolvedValue(applicant);
    expect(await listProgramDocuments(APP_ID, TOKEN)).toEqual({
      ok: true,
      data: [{ docKey: "payslip", fileName: "payslip.pdf", sizeBytes: 4, createdAt: "2026-09-01T00:00:00Z", verified: false }],
    });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].filters).toContainEqual(["eq", "application_id", APP_ID]);
  });

  it("uploads under the application, records an unverified row, and removes the previous object", async () => {
    const db = setDb("programs/old.pdf");
    state.authorize.mockResolvedValue(applicant);
    const res = await uploadProgramDocument(form({ applicationId: APP_ID, docKey: "payslip", token: TOKEN, file: pdf() }));
    expect(res).toMatchObject({ ok: true, data: { docKey: "payslip", fileName: "payslip.pdf", sizeBytes: 4, verified: false } });

    const [upload, removeOld] = db.storageCalls;
    expect(upload).toMatchObject({ op: "upload" });
    expect(String(upload.args[0])).toContain(APP_ID);
    expect(removeOld).toMatchObject({ op: "remove", args: [["programs/old.pdf"]] });

    const row = writes(db).find((c) => c.table === "program_documents");
    expect(row).toMatchObject({ op: "upsert", options: { onConflict: "application_id,doc_key" } });
    expect(row?.payload).toMatchObject({ application_id: APP_ID, doc_key: "payslip", storage_path: upload.args[0], uploaded_by: null, verified_at: null, verified_by: null });
  });

  it("removes the object again when the row cannot be written", async () => {
    state.authorize.mockResolvedValue(applicant);
    state.svc = makeFakeSupabase((call) => {
      if (call.table === "program_documents" && call.op === "upsert") return { error: { message: "row failed" } };
      return { data: null };
    });
    const db = state.svc as FakeSupabase;
    expect(await uploadProgramDocument(form({ applicationId: APP_ID, docKey: "payslip", token: TOKEN, file: pdf() }))).toEqual({ ok: false, error: "Upload failed. Please try again." });
    expect(db.storageCalls.map((c) => c.op)).toEqual(["upload", "remove"]);
    expect(db.storageCalls[1].args).toEqual([[db.storageCalls[0].args[0]]]);
  });

  it("removes a document scoped to the application and doc key", async () => {
    const db = setDb("programs/old.pdf");
    state.authorize.mockResolvedValue(applicant);
    expect(await removeProgramDocument(APP_ID, "payslip", TOKEN)).toEqual({ ok: true, data: undefined });
    const del = writes(db).find((c) => c.op === "delete");
    expect(del?.table).toBe("program_documents");
    expect(del?.filters).toEqual(expect.arrayContaining([["eq", "application_id", APP_ID], ["eq", "doc_key", "payslip"]]));
    expect(db.storageCalls).toEqual([expect.objectContaining({ op: "remove", args: [["programs/old.pdf"]] })]);
  });

  it("removing a document that is not there is a no-op", async () => {
    const db = setDb(null);
    state.authorize.mockResolvedValue(applicant);
    expect(await removeProgramDocument(APP_ID, "payslip", TOKEN)).toEqual({ ok: true, data: undefined });
    expect(writes(db)).toHaveLength(0);
    expect(db.storageCalls).toHaveLength(0);
  });
});

describe("program documents: staff", () => {
  it("verifies and un-verifies a document, stamping the staff user", async () => {
    const db = setDb();
    state.authorize.mockResolvedValue({ ok: true, staff: true, userId: STAFF.id });
    expect(await verifyProgramDocument(APP_ID, "payslip", true)).toEqual({ ok: true, data: undefined });
    expect(await verifyProgramDocument(APP_ID, "payslip", false)).toEqual({ ok: true, data: undefined });
    const [on, off] = writes(db);
    expect(on).toMatchObject({ table: "program_documents", op: "update" });
    expect((on.payload as { verified_by: string; verified_at: string }).verified_by).toBe(STAFF.id);
    expect((on.payload as { verified_at: string }).verified_at).toMatch(/^\d{4}-/);
    expect(on.filters).toEqual(expect.arrayContaining([["eq", "application_id", APP_ID], ["eq", "doc_key", "payslip"]]));
    expect(off.payload).toEqual({ verified_at: null, verified_by: null });
  });
});
