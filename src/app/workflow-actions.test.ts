import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { NON_STAFF_USERS, NON_VENDOR_USERS, OWNER, STAFF, STAFF_USERS, VENDOR, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03 for the workflow actions. Three audiences:
 *   - submitCustomerIntake is PUBLIC by design (the intake form) — it runs on
 *     the request-scoped client through the submit_customer_intake RPC, so RLS
 *     and the RPC decide what an anonymous caller may create.
 *   - staff* actions gate on isStaffUser() and redirect everyone else.
 *   - vendor* actions gate on isVendorUser() — the owner is refused too, which
 *     is the point: vendor rows are scoped by current_vendor_id() in RLS, and
 *     vendorUploadJobFile re-reads ownership through that client before the
 *     service-role storage write (the pattern PROJECT_AUDIT.md §7 says to keep).
 */
const state = vi.hoisted(() => ({
  ssr: null as unknown,
  svc: null as unknown,
  syncCaseToClickUp: vi.fn(),
  notifyClickUpVendorAssignment: vi.fn(),
  linkFormToPerson: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/lib/clickup/client", () => ({ isClickUpEnabled: () => false }));
vi.mock("@/lib/clickup/sync-case", () => ({
  syncCaseToClickUp: state.syncCaseToClickUp,
  notifyClickUpVendorAssignment: state.notifyClickUpVendorAssignment,
}));
vi.mock("@/lib/people/upsert", () => ({ linkFormToPerson: state.linkFormToPerson }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import {
  staffAssignVendorJob,
  staffSyncCaseToClickUp,
  staffUpdateCase,
  submitCustomerIntake,
  vendorUpdateJobStatus,
  vendorUploadJobFile,
} from "./workflow-actions";

const CASE_ID = "e1000000-0000-4000-8000-000000000001";
const VENDOR_ID = "e2000000-0000-4000-8000-000000000002";
const JOB_ID = "e3000000-0000-4000-8000-000000000003";
const OTHER_VENDORS_JOB = "e4000000-0000-4000-8000-000000000004";

const form = (fields: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "before.png", { type: "image/png" });

function signIn(user: RoleUser | null) {
  state.ssr = makeFakeSupabase((call) => {
    const id = call.filters.find((f) => f[0] === "eq" && f[1] === "id")?.[2];
    if (call.table === "rpc:submit_customer_intake") return { data: CASE_ID };
    if (call.table === "cases" && call.op === "select") return { data: { metadata: { source: "web" }, clickup_task_id: null } };
    if (call.table === "vendor_jobs" && call.op === "insert") return { data: { id: JOB_ID } };
    // RLS: a vendor only sees their own job.
    if (call.table === "vendor_jobs" && call.op === "select") return { data: id === JOB_ID ? { id: JOB_ID, case_id: CASE_ID } : null };
    if (call.table === "vendors") return { data: { name: "Example Detailing" } };
    return undefined;
  }, { user });
  state.svc = makeFakeSupabase(() => undefined);
  return { ssr: state.ssr as FakeSupabase, svc: state.svc as FakeSupabase };
}

const staffActions: Array<[string, () => Promise<unknown>]> = [
  ["staffUpdateCase", () => staffUpdateCase(form({ id: CASE_ID, status: "initial_contact_needed", internal_notes: "called" }))],
  ["staffSyncCaseToClickUp", () => staffSyncCaseToClickUp(form({ id: CASE_ID }))],
  ["staffAssignVendorJob", () => staffAssignVendorJob(form({ case_id: CASE_ID, vendor_id: VENDOR_ID, title: "Detail the unit" }))],
];

const vendorActions: Array<[string, () => Promise<unknown>]> = [
  ["vendorUpdateJobStatus", () => vendorUpdateJobStatus(form({ vendor_job_id: JOB_ID, status: "accepted" }))],
  ["vendorUploadJobFile", () => vendorUploadJobFile(form({ vendor_job_id: JOB_ID, file: png() }))],
];

beforeEach(() => {
  vi.resetAllMocks();
  state.linkFormToPerson.mockResolvedValue(undefined);
});

describe("staff workflow actions", () => {
  it.each(staffActions)("%s redirects an anonymous caller before reading or writing", async (_label, run) => {
    const { ssr, svc } = signIn(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ssr.calls).toHaveLength(0);
    expect(svc.calls).toHaveLength(0);
  });

  const nonStaffCases = NON_STAFF_USERS.flatMap(([role, user]) => staffActions.map(([action, run]) => [role, action, user, run] as const));
  it.each(nonStaffCases)("%s calling %s is redirected with no reads or writes", async (_role, _action, user, run) => {
    const { ssr, svc } = signIn(user);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ssr.calls).toHaveLength(0);
    expect(svc.calls).toHaveLength(0);
    expect(state.syncCaseToClickUp).not.toHaveBeenCalled();
  });

  it.each(STAFF_USERS)("%s updates a case: status, notes merged into metadata, keyed by id", async (_label, user) => {
    const { ssr } = signIn(user);
    expect(await staffUpdateCase(form({ id: CASE_ID, status: "initial_contact_needed", internal_notes: "called", clickup_url: "" }))).toEqual({ success: true });
    const w = writes(ssr);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ table: "cases", op: "update", payload: { status: "initial_contact_needed", clickup_task_id: null, clickup_task_url: null, metadata: { source: "web", internal_notes: "called" } } });
    expect(w[0].filters).toContainEqual(["eq", "id", CASE_ID]);
  });

  it("staffUpdateCase rejects an unknown status or a non-uuid id before writing", async () => {
    const { ssr } = signIn(OWNER);
    expect(await staffUpdateCase(form({ id: CASE_ID, status: "done" }))).toEqual({ success: false, error: "Invalid case data." });
    expect(await staffUpdateCase(form({ id: "1", status: "intake_submitted" }))).toEqual({ success: false, error: "Invalid case data." });
    expect(ssr.calls).toHaveLength(0);
  });

  it("staffAssignVendorJob creates the offer, advances the case, and logs the update as the caller", async () => {
    const { ssr } = signIn(STAFF);
    expect(await staffAssignVendorJob(form({ case_id: CASE_ID, vendor_id: VENDOR_ID, title: "Detail the unit", description: "Full interior" }))).toEqual({ success: true, id: JOB_ID });
    const w = writes(ssr);
    expect(w.map((c) => [c.table, c.op])).toEqual([
      ["vendor_jobs", "insert"],
      ["cases", "update"],
      ["vendor_job_updates", "insert"],
    ]);
    expect(w[0].payload).toEqual({ case_id: CASE_ID, vendor_id: VENDOR_ID, title: "Detail the unit", description: "Full interior", status: "offered" });
    expect(w[1]).toMatchObject({ payload: { status: "vendor_assigned" } });
    expect(w[1].filters).toContainEqual(["eq", "id", CASE_ID]);
    expect(w[2].payload).toMatchObject({ vendor_job_id: JOB_ID, status: "offered", created_by: STAFF.id });
  });

  it("staffSyncCaseToClickUp reports a missing integration without touching the service client", async () => {
    const { svc } = signIn(OWNER);
    expect(await staffSyncCaseToClickUp(form({ id: CASE_ID }))).toEqual({ success: false, error: "CLICKUP_API_TOKEN not configured in Vercel." });
    expect(await staffSyncCaseToClickUp(form({}))).toEqual({ success: false, error: "Missing case id." });
    expect(svc.calls).toHaveLength(0);
    expect(state.syncCaseToClickUp).not.toHaveBeenCalled();
  });
});

describe("vendor workflow actions", () => {
  it.each(vendorActions)("%s redirects an anonymous caller before reading or writing", async (_label, run) => {
    const { ssr, svc } = signIn(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
  });

  const nonVendorCases = NON_VENDOR_USERS.flatMap(([role, user]) => vendorActions.map(([action, run]) => [role, action, user, run] as const));
  it.each(nonVendorCases)("%s calling %s is redirected (vendor surfaces are vendor-only, owner included)", async (_role, _action, user, run) => {
    const { ssr, svc } = signIn(user);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
  });

  it("vendorUploadJobFile re-reads ownership through RLS before the service-role upload", async () => {
    const { ssr, svc } = signIn(VENDOR);
    expect(await vendorUploadJobFile(form({ vendor_job_id: JOB_ID, file: png() }))).toEqual({ success: true });

    // Ownership read happened first, on the RLS-scoped client, keyed by the job id.
    expect(ssr.calls[0]).toMatchObject({ table: "vendor_jobs", op: "select" });
    expect(ssr.calls[0].filters).toContainEqual(["eq", "id", JOB_ID]);

    expect(svc.storageCalls).toHaveLength(1);
    expect(svc.storageCalls[0]).toMatchObject({ bucket: "vendor-files", op: "upload" });
    expect(String(svc.storageCalls[0].args[0])).toMatch(new RegExp(`^jobs/${JOB_ID}/\\d+-before\\.png\\.png$`));

    const row = writes(ssr).find((c) => c.table === "vendor_files");
    expect(row?.payload).toMatchObject({ vendor_job_id: JOB_ID, storage_path: svc.storageCalls[0].args[0], file_name: "before.png", mime_type: "image/png", uploaded_by: VENDOR.id });
  });

  it("a vendor naming another vendor's job gets Job not found. and nothing reaches storage", async () => {
    const { ssr, svc } = signIn(VENDOR);
    expect(await vendorUploadJobFile(form({ vendor_job_id: OTHER_VENDORS_JOB, file: png() }))).toEqual({ success: false, error: "Job not found." });
    expect(svc.storageCalls).toHaveLength(0);
    expect(writes(ssr)).toHaveLength(0);
  });

  it("vendorUploadJobFile refuses a disallowed file type before the ownership read", async () => {
    const { ssr, svc } = signIn(VENDOR);
    const exe = new File([new Uint8Array([0x4d, 0x5a])], "tool.exe", { type: "application/x-msdownload" });
    expect(await vendorUploadJobFile(form({ vendor_job_id: JOB_ID, file: exe }))).toEqual({ success: false, error: "Upload JPEG, PNG, WebP, or PDF only." });
    expect(await vendorUploadJobFile(form({ vendor_job_id: JOB_ID }))).toEqual({ success: false, error: "Missing file or job." });
    expect(ssr.calls).toHaveLength(0);
    expect(svc.storageCalls).toHaveLength(0);
  });

  it("vendorUpdateJobStatus writes through the RLS-scoped client and logs the update as the vendor", async () => {
    const { ssr } = signIn(VENDOR);
    expect(await vendorUpdateJobStatus(form({ vendor_job_id: JOB_ID, status: "completed", note: "done" }))).toEqual({ success: true });
    const w = writes(ssr);
    expect(w.map((c) => [c.table, c.op])).toEqual([
      ["vendor_jobs", "update"],
      ["vendor_job_updates", "insert"],
      ["cases", "update"],
    ]);
    expect(w[0].payload).toMatchObject({ status: "completed" });
    expect(w[0].filters).toContainEqual(["eq", "id", JOB_ID]);
    expect(w[1].payload).toMatchObject({ vendor_job_id: JOB_ID, status: "completed", note: "done", created_by: VENDOR.id });
    expect(w[2]).toMatchObject({ payload: { status: "vendor_completed" } });
    expect(w[2].filters).toContainEqual(["eq", "id", CASE_ID]);
  });

  it("vendorUpdateJobStatus rejects an unknown status before writing", async () => {
    const { ssr } = signIn(VENDOR);
    expect(await vendorUpdateJobStatus(form({ vendor_job_id: JOB_ID, status: "not_a_status" }))).toEqual({ success: false, error: "Invalid status update." });
    expect(await vendorUpdateJobStatus(form({ vendor_job_id: "1", status: "accepted" }))).toEqual({ success: false, error: "Invalid status update." });
    expect(ssr.calls).toHaveLength(0);
  });
});

describe("submitCustomerIntake (public by design)", () => {
  it("an anonymous visitor reaches the intake RPC with sanitised fields", async () => {
    const { ssr, svc } = signIn(null);
    const res = await submitCustomerIntake(form({ contact_name: " Test Person ", phone: "555-0100", email: "", request_type: "rental_inquiry", priority: "Standard" }));
    expect(res).toEqual({ success: true, id: CASE_ID });
    expect(ssr.calls).toEqual([
      expect.objectContaining({
        table: "rpc:submit_customer_intake",
        payload: { p_contact_name: "Test Person", p_phone: "555-0100", p_email: null, p_request_type: "rental_inquiry", p_description: null, p_priority: "Standard" },
      }),
    ]);
    // ClickUp is off in this test, so the service-role client is never built.
    expect(svc.calls).toHaveLength(0);
    expect(state.linkFormToPerson).toHaveBeenCalledWith(expect.objectContaining({ formSlug: "customer-intake", destinationId: CASE_ID }));
  });

  it("invalid intake never reaches the RPC", async () => {
    const { ssr } = signIn(null);
    expect(await submitCustomerIntake(form({ contact_name: "", request_type: "rental_inquiry" }))).toEqual({ success: false, error: "Please check your entries and try again." });
    expect(await submitCustomerIntake(form({ contact_name: "X", request_type: "rental_inquiry", email: "not-an-email" }))).toMatchObject({ success: false });
    expect(ssr.calls).toHaveLength(0);
  });
});
