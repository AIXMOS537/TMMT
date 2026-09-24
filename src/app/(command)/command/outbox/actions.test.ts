import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { NON_OWNER_USERS, OWNER, type RoleUser } from "@/lib/testing/role-users";

/**
 * Authz for the outbox desk, plus the one property that matters more than
 * authz: these actions must never send. The GHL sender is mocked so any call
 * would be visible; the service-role client is faked so nothing touches a real
 * database.
 */

const state = vi.hoisted(() => ({ ssr: null as unknown, svc: null as unknown }));
const sendConversationMessage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/lib/ghl/client", () => ({ sendConversationMessage }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import { previewVaTaskSms, stageVaTaskSms } from "./actions";

const TASK = {
  id: "task-1",
  category: "payment_followup",
  subject_name: "Test Customer",
  subject_phone: "+15551112222",
  status: "pending",
  handled_at: null,
  context: { past_due: "250.00" },
};

const MARKETING_TASK = { ...TASK, id: "task-2", category: "lead_reengagement", context: {} };

function setUp(user: RoleUser | null, tasks: unknown[] = [TASK]) {
  state.ssr = makeFakeSupabase(() => undefined, { user });
  state.svc = makeFakeSupabase((call) => {
    if (call.table === "exec_va_tasks") return { data: tasks };
    if (call.table === "automation_outbox") {
      return call.op === "insert" ? { data: null, error: null } : { data: null };
    }
    if (call.table === "do_not_contact_numbers") return { data: null };
    if (call.table === "incoming_leads") return { data: { opted_out: false } };
    return { data: null };
  });
  return state.svc as FakeSupabase;
}

const EVERY_ACTION: Array<[string, () => Promise<{ ok: boolean; error?: string }>]> = [
  ["previewVaTaskSms", () => previewVaTaskSms()],
  ["stageVaTaskSms", () => stageVaTaskSms()],
];

beforeEach(() => sendConversationMessage.mockClear());

describe("outbox desk — authorisation", () => {
  it.each(EVERY_ACTION)("%s redirects an anonymous caller to /login", async (_n, run) => {
    setUp(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  // NON_OWNER_USERS is already [label, user] tuples, which is exactly what
  // it.each wants — every signed-in role that isOwnerUser() rejects.
  const nonOwners = NON_OWNER_USERS;

  it.each(nonOwners)("refuses role=%s on previewVaTaskSms", async (_r, user) => {
    const svc = setUp(user);
    const res = await previewVaTaskSms();
    expect(res.ok).toBe(false);
    expect(svc.calls).toHaveLength(0);
  });

  it.each(nonOwners)("refuses role=%s on stageVaTaskSms, and writes nothing", async (_r, user) => {
    const svc = setUp(user);
    const res = await stageVaTaskSms();
    expect(res.ok).toBe(false);
    expect(svc.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("lets the owner through", async () => {
    setUp(OWNER);
    const res = await previewVaTaskSms();
    expect(res.ok).toBe(true);
  });
});

describe("outbox desk — it never sends", () => {
  it("preview writes nothing and sends nothing", async () => {
    const svc = setUp(OWNER);
    const res = await previewVaTaskSms();
    expect(res.ok).toBe(true);
    expect(svc.calls.some((c) => c.op === "insert")).toBe(false);
    expect(sendConversationMessage).not.toHaveBeenCalled();
  });

  it("staging queues a draft and still sends nothing", async () => {
    const svc = setUp(OWNER);
    const res = await stageVaTaskSms();
    expect(res.ok).toBe(true);
    const insert = svc.calls.find((c) => c.table === "automation_outbox" && c.op === "insert");
    expect(insert?.payload).toMatchObject({ channel: "sms", status: "queued" });
    expect(sendConversationMessage).not.toHaveBeenCalled();
  });
});

describe("outbox desk — marketing stays held unless explicitly approved", () => {
  it("holds a marketing task by default", async () => {
    const svc = setUp(OWNER, [MARKETING_TASK]);
    const res = await stageVaTaskSms();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.staged).toBe(0);
    expect(res.data.refusedByReason.gate_hold).toBe(1);
    expect(svc.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("releases it only when ownerApproved is passed explicitly", async () => {
    setUp(OWNER, [MARKETING_TASK]);
    const res = await stageVaTaskSms({ ownerApproved: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.staged).toBe(1);
  });

  it("a truthy-but-not-true value does not count as approval", async () => {
    setUp(OWNER, [MARKETING_TASK]);
    const res = await stageVaTaskSms({ ownerApproved: "yes" as unknown as boolean });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.staged).toBe(0);
  });
});
