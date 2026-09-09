import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { NON_STAFF_USERS, OWNER, STAFF, STAFF_USERS, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03 for the document actions. Storage writes run on the service role (the
 * bucket has no RLS to lean on), so the app-side gate is the whole defence:
 * requireStaff() redirects anonymous callers and refuses every non-staff tier
 * before a byte moves. Row lookups go through the SSR (RLS-scoped) client, so
 * a record the caller cannot see is "not found" and nothing is uploaded.
 * Table writes go through adminUpsert(), which carries its own gate (tested in
 * admin-actions.test.ts); here it is a recorder.
 */
const state = vi.hoisted(() => ({
  ssr: null as unknown,
  svc: null as unknown,
  adminUpsert: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/app/(admin)/admin-actions", () => ({ adminUpsert: state.adminUpsert }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import {
  getSignedDocumentUrl,
  mintLicenseUploadLink,
  removeContractPdf,
  removeStaffLicenseImage,
  uploadContractPdf,
  uploadStaffLicenseImage,
} from "./document-actions";

const CONTRACT = "d1000000-0000-4000-8000-000000000001";
const CUSTOMER_ROW = "d2000000-0000-4000-8000-000000000002";
const BG_ROW = "d3000000-0000-4000-8000-000000000003";

const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "contract.pdf", { type: "application/pdf" });
const jpg = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "front.jpg", { type: "image/jpeg" });

const form = (fields: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

/** Rows the SSR client can see. background_checks is admin-only under RLS, so it is empty for staff. */
function signIn(user: RoleUser | null, visible: Record<string, string[]> = { contracts: [CONTRACT], active_customers: [CUSTOMER_ROW] }) {
  state.ssr = makeFakeSupabase((call) => {
    const id = call.filters.find((f) => f[0] === "eq" && f[1] === "id")?.[2] as string | undefined;
    if (!id || !(visible[call.table] ?? []).includes(id)) return { data: null };
    return { data: { id, contract_pdf_storage_path: "contracts/old.pdf", drivers_license_front_path: "licenses/old-front.jpg", drivers_license_back_path: null } };
  }, { user });
  state.svc = makeFakeSupabase(() => undefined);
  return { ssr: state.ssr as FakeSupabase, svc: state.svc as FakeSupabase };
}

const everyAction: Array<[string, () => Promise<unknown>]> = [
  ["getSignedDocumentUrl", () => getSignedDocumentUrl("contracts/x/contract.pdf")],
  ["uploadContractPdf", () => uploadContractPdf(form({ contractId: CONTRACT, file: pdf() }))],
  ["removeContractPdf", () => removeContractPdf(CONTRACT)],
  ["uploadStaffLicenseImage", () => uploadStaffLicenseImage(form({ table: "active_customers", recordId: CUSTOMER_ROW, side: "front", file: jpg() }))],
  ["removeStaffLicenseImage", () => removeStaffLicenseImage("active_customers", CUSTOMER_ROW, "front")],
  ["mintLicenseUploadLink", () => mintLicenseUploadLink(form({ table: "active_customers", id: CUSTOMER_ROW }))],
];

beforeEach(() => {
  vi.resetAllMocks();
  state.adminUpsert.mockResolvedValue({ success: true });
});

describe("document actions: anonymous", () => {
  it.each(everyAction)("%s redirects to login and touches neither storage nor a table", async (_label, run) => {
    const { ssr, svc } = signIn(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
    expect(state.adminUpsert).not.toHaveBeenCalled();
  });
});

describe("document actions: signed-in non-staff", () => {
  const cases = NON_STAFF_USERS.flatMap(([role, user]) => everyAction.map(([action, run]) => [role, action, user, run] as const));

  it.each(cases)("%s calling %s is Not authorized. with no storage or table access", async (_role, _action, user, run) => {
    const { ssr, svc } = signIn(user);
    expect(await run()).toEqual({ success: false, error: "Not authorized." });
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
    expect(state.adminUpsert).not.toHaveBeenCalled();
  });
});

describe("getSignedDocumentUrl", () => {
  it.each(STAFF_USERS)("%s can mint a link for a contract PDF", async (_label, user) => {
    const { svc } = signIn(user);
    expect(await getSignedDocumentUrl("contracts/x/contract.pdf")).toEqual({ success: true, data: { url: "https://storage.example.com/staff-documents/signed" } });
    expect(svc.storageCalls).toEqual([{ bucket: "staff-documents", op: "createSignedUrl", args: ["contracts/x/contract.pdf", 3600] }]);
  });

  it("background-check licence images are owner-only, even for staff who know the path", async () => {
    const { svc } = signIn(STAFF);
    expect(await getSignedDocumentUrl(`licenses/background_checks/${BG_ROW}/front.jpg`)).toEqual({ success: false, error: "Not authorized." });
    expect(svc.storageCalls).toHaveLength(0);

    signIn(OWNER);
    expect(await getSignedDocumentUrl(`licenses/background_checks/${BG_ROW}/front.jpg`)).toMatchObject({ success: true });
  });

  it("refuses path traversal and empty paths", async () => {
    const { svc } = signIn(OWNER);
    expect(await getSignedDocumentUrl("contracts/../secrets")).toEqual({ success: false, error: "Invalid path." });
    expect(await getSignedDocumentUrl("")).toEqual({ success: false, error: "Invalid path." });
    expect(svc.storageCalls).toHaveLength(0);
  });
});

describe("uploadContractPdf / removeContractPdf", () => {
  it("staff upload: looks the contract up through RLS, uploads, drops the old object, and records the path", async () => {
    const { ssr, svc } = signIn(STAFF);
    expect(await uploadContractPdf(form({ contractId: CONTRACT, file: pdf() }))).toEqual({ success: true });

    expect(ssr.calls[0]).toMatchObject({ table: "contracts", op: "select" });
    expect(ssr.calls[0].filters).toContainEqual(["eq", "id", CONTRACT]);
    expect(writes(ssr)).toHaveLength(0);

    expect(svc.storageCalls[0]).toMatchObject({ bucket: "staff-documents", op: "upload" });
    expect(String(svc.storageCalls[0].args[0])).toMatch(new RegExp(`^contracts/${CONTRACT}/contract-\\d+\\.pdf$`));
    expect(svc.storageCalls[0].args[2]).toEqual({ contentType: "application/pdf", upsert: false });
    expect(svc.storageCalls[1]).toEqual({ bucket: "staff-documents", op: "remove", args: [["contracts/old.pdf"]] });

    expect(state.adminUpsert).toHaveBeenCalledWith("contracts", expect.objectContaining({ id: CONTRACT, contract_pdf_storage_path: svc.storageCalls[0].args[0] }));
  });

  it("a contract the caller cannot see is not found, and nothing is uploaded", async () => {
    const { svc } = signIn(STAFF, { contracts: [] });
    expect(await uploadContractPdf(form({ contractId: CONTRACT, file: pdf() }))).toEqual({ success: false, error: "Contract not found." });
    expect(svc.storageCalls).toHaveLength(0);
    expect(state.adminUpsert).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF and a missing file before any lookup", async () => {
    const { ssr, svc } = signIn(OWNER);
    expect(await uploadContractPdf(form({ contractId: CONTRACT, file: jpg() }))).toEqual({ success: false, error: "Please upload a PDF file." });
    expect(await uploadContractPdf(form({ contractId: CONTRACT }))).toEqual({ success: false, error: "Contract and PDF file are required." });
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
  });

  it("removes the uploaded object again when the table write fails", async () => {
    const { svc } = signIn(OWNER);
    state.adminUpsert.mockResolvedValueOnce({ success: false, error: "Not authorized." });
    expect(await uploadContractPdf(form({ contractId: CONTRACT, file: pdf() }))).toEqual({ success: false, error: "Not authorized." });
    const removed = svc.storageCalls.filter((c) => c.op === "remove");
    expect(removed.at(-1)?.args).toEqual([[svc.storageCalls[0].args[0]]]);
  });

  it("removeContractPdf clears the object and the path", async () => {
    const { svc } = signIn(STAFF);
    expect(await removeContractPdf(CONTRACT)).toEqual({ success: true });
    expect(svc.storageCalls).toEqual([{ bucket: "staff-documents", op: "remove", args: [["contracts/old.pdf"]] }]);
    expect(state.adminUpsert).toHaveBeenCalledWith("contracts", { id: CONTRACT, contract_pdf_storage_path: null, contract_pdf_uploaded_at: null });
    expect(await removeContractPdf("")).toEqual({ success: false, error: "Missing contract id." });
  });
});

describe("uploadStaffLicenseImage / removeStaffLicenseImage", () => {
  it("staff upload for an active customer: RLS lookup, upload under the table prefix, record the column", async () => {
    const { ssr, svc } = signIn(STAFF);
    expect(await uploadStaffLicenseImage(form({ table: "active_customers", recordId: CUSTOMER_ROW, side: "front", file: jpg() }))).toEqual({ success: true });
    expect(ssr.calls[0]).toMatchObject({ table: "active_customers", op: "select" });
    expect(String(svc.storageCalls[0].args[0])).toMatch(new RegExp(`^licenses/active_customers/${CUSTOMER_ROW}/front-\\d+\\.jpg$`));
    expect(svc.storageCalls[1]).toEqual({ bucket: "staff-documents", op: "remove", args: [["licenses/old-front.jpg"]] });
    expect(state.adminUpsert).toHaveBeenCalledWith("active_customers", { id: CUSTOMER_ROW, drivers_license_front_path: svc.storageCalls[0].args[0] });
  });

  it("staff cannot upload against a background_checks row RLS hides from them", async () => {
    const { svc } = signIn(STAFF);
    expect(await uploadStaffLicenseImage(form({ table: "background_checks", recordId: BG_ROW, side: "back", file: jpg() }))).toEqual({ success: false, error: "Record not found." });
    expect(svc.storageCalls).toHaveLength(0);
    expect(state.adminUpsert).not.toHaveBeenCalled();
  });

  it("owner can upload against a background_checks row they can see", async () => {
    const { svc } = signIn(OWNER, { background_checks: [BG_ROW] });
    expect(await uploadStaffLicenseImage(form({ table: "background_checks", recordId: BG_ROW, side: "back", file: jpg() }))).toEqual({ success: true });
    expect(String(svc.storageCalls[0].args[0])).toMatch(new RegExp(`^licenses/background_checks/${BG_ROW}/back-\\d+\\.jpg$`));
    expect(state.adminUpsert).toHaveBeenCalledWith("background_checks", { id: BG_ROW, drivers_license_back_path: svc.storageCalls[0].args[0] });
  });

  it("rejects an unknown table, side, or non-image before any lookup", async () => {
    const { ssr, svc } = signIn(OWNER);
    expect(await uploadStaffLicenseImage(form({ table: "profiles", recordId: CUSTOMER_ROW, side: "front", file: jpg() }))).toEqual({ success: false, error: "Invalid request." });
    expect(await uploadStaffLicenseImage(form({ table: "active_customers", recordId: CUSTOMER_ROW, side: "left", file: jpg() }))).toEqual({ success: false, error: "Invalid request." });
    expect(await uploadStaffLicenseImage(form({ table: "active_customers", recordId: CUSTOMER_ROW, side: "front", file: pdf() }))).toEqual({ success: false, error: "Use JPEG, PNG, or WebP for license photos." });
    expect(await removeStaffLicenseImage("profiles" as never, CUSTOMER_ROW, "front")).toEqual({ success: false, error: "Invalid request." });
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
    expect(state.adminUpsert).not.toHaveBeenCalled();
  });

  it("removeStaffLicenseImage clears the object and the column", async () => {
    const { svc } = signIn(STAFF);
    expect(await removeStaffLicenseImage("active_customers", CUSTOMER_ROW, "front")).toEqual({ success: true });
    expect(svc.storageCalls).toEqual([{ bucket: "staff-documents", op: "remove", args: [["licenses/old-front.jpg"]] }]);
    expect(state.adminUpsert).toHaveBeenCalledWith("active_customers", { id: CUSTOMER_ROW, drivers_license_front_path: null });
  });
});

describe("mintLicenseUploadLink", () => {
  it("staff mint a 7-day token for a row they can see", async () => {
    signIn(STAFF);
    const res = await mintLicenseUploadLink(form({ table: "active_customers", id: CUSTOMER_ROW }));
    expect(res.success).toBe(true);
    if (!res.success) throw new Error("expected success");
    const [table, patch] = state.adminUpsert.mock.calls[0] as [string, Record<string, string>];
    expect(table).toBe("active_customers");
    expect(patch.id).toBe(CUSTOMER_ROW);
    expect(patch.license_upload_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.data?.url).toContain(`/forms/license-upload?token=${patch.license_upload_token}`);
    expect(new Date(patch.license_upload_token_expires_at).getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
  });

  it("refuses a malformed id or an unknown table before any lookup, and a hidden row after", async () => {
    const { ssr } = signIn(STAFF);
    expect(await mintLicenseUploadLink(form({ table: "active_customers", id: "1" }))).toEqual({ success: false, error: "Invalid record." });
    expect(await mintLicenseUploadLink(form({ table: "contracts", id: CUSTOMER_ROW }))).toEqual({ success: false, error: "Invalid record." });
    expect(ssr.calls).toHaveLength(0);
    expect(await mintLicenseUploadLink(form({ table: "background_checks", id: BG_ROW }))).toEqual({ success: false, error: "Record not found." });
    expect(state.adminUpsert).not.toHaveBeenCalled();
  });
});
