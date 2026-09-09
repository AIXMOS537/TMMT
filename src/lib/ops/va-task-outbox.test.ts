import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// The GHL sender must never be reached from this module. Mocked so that any
// import-time or run-time call would be visible rather than silently making a
// network request in CI.
const sendConversationMessage = vi.fn();
vi.mock("@/lib/ghl/client", () => ({ sendConversationMessage }));

import {
  stageVaTaskMessages,
  draftMessage,
  MESSAGEABLE,
  OUTBOX_AUTOMATION,
  type VaTaskRow,
} from "./va-task-outbox";

const TASK = (over: Partial<VaTaskRow> = {}): VaTaskRow => ({
  id: "task-1",
  category: "payment_followup",
  subject_name: "Dominique Hott",
  subject_phone: "+15551112222",
  context: { past_due: "250.00" },
  ...over,
});

/**
 * Fake DB wired for the three tables this module touches. `dnc` and `optedOut`
 * drive the real outbound gate, which is NOT mocked -- the point of these tests
 * is that the gate's verdict is what decides staging.
 */
function db(opts: {
  tasks: VaTaskRow[];
  dnc?: string[];
  optedOut?: boolean;
  alreadyQueued?: boolean;
}): FakeSupabase {
  return makeFakeSupabase((call) => {
    if (call.table === "exec_va_tasks") return { data: opts.tasks };
    if (call.table === "automation_outbox") {
      if (call.op === "insert") return { data: null, error: null };
      return { data: opts.alreadyQueued ? { id: 1 } : null };
    }
    if (call.table === "do_not_contact_numbers") {
      const p10 = call.filters.find((f) => f[0] === "eq" && f[1] === "phone10")?.[2];
      return { data: (opts.dnc ?? []).includes(String(p10)) ? { phone10: p10 } : null };
    }
    if (call.table === "incoming_leads") return { data: { opted_out: opts.optedOut ?? false } };
    return { data: null };
  });
}

const run = (d: FakeSupabase, over = {}) =>
  stageVaTaskMessages({ dryRun: false, db: d as unknown as SupabaseClient, ...over });

beforeEach(() => sendConversationMessage.mockClear());

describe("va-task outbox — it stages, it never sends", () => {
  it("never calls the GHL sender, even on a fully allowed transactional task", async () => {
    const d = db({ tasks: [TASK()] });
    const s = await run(d);
    expect(s.staged).toBe(1);
    expect(sendConversationMessage).not.toHaveBeenCalled();
  });

  it("writes a queued sms row to automation_outbox with the task as its record_id", async () => {
    const d = db({ tasks: [TASK()] });
    await run(d);
    const insert = d.calls.find((c) => c.table === "automation_outbox" && c.op === "insert");
    expect(insert).toBeDefined();
    expect(insert!.payload).toMatchObject({
      automation: OUTBOX_AUTOMATION,
      channel: "sms",
      status: "queued",
      source_table: "exec_va_tasks",
      record_id: "task-1",
      to_address: "+15551112222",
    });
  });

  it("writes nothing at all when dryRun is on, but still reports what it would stage", async () => {
    const d = db({ tasks: [TASK()] });
    const s = await stageVaTaskMessages({ dryRun: true, db: d as unknown as SupabaseClient });
    expect(s.staged).toBe(1);
    expect(s.drafts).toHaveLength(1);
    expect(d.calls.some((c) => c.table === "automation_outbox" && c.op === "insert")).toBe(false);
  });

  it("defaults to dryRun, so an argument-less call cannot write", async () => {
    const d = db({ tasks: [TASK()] });
    await stageVaTaskMessages({ db: d as unknown as SupabaseClient });
    expect(d.calls.some((c) => c.op === "insert")).toBe(false);
  });
});

describe("va-task outbox — the gate decides, and marketing is held", () => {
  it("holds marketing without owner approval and stages nothing", async () => {
    const d = db({ tasks: [TASK({ id: "t2", category: "lead_reengagement", context: {} })] });
    const s = await run(d);
    expect(s.staged).toBe(0);
    expect(s.refusedByGate).toBe(1);
    expect(s.refusedByReason.gate_hold).toBe(1);
    expect(d.calls.some((c) => c.table === "automation_outbox" && c.op === "insert")).toBe(false);
  });

  it("releases that same marketing task only when owner approval is passed", async () => {
    const d = db({ tasks: [TASK({ id: "t2", category: "lead_reengagement", context: {} })] });
    const s = await run(d, { ownerApproved: true });
    expect(s.staged).toBe(1);
    expect(s.refusedByGate).toBe(0);
  });

  it("stages transactional without any owner approval", async () => {
    const d = db({ tasks: [TASK()] });
    expect((await run(d)).staged).toBe(1);
  });

  it("refuses a do-not-contact number even when transactional", async () => {
    const d = db({ tasks: [TASK()], dnc: ["5551112222"] });
    const s = await run(d);
    expect(s.staged).toBe(0);
    expect(s.refusedByReason.dnc).toBe(1);
    expect(d.calls.some((c) => c.table === "automation_outbox" && c.op === "insert")).toBe(false);
  });

  it("refuses an opted-out lead even when transactional", async () => {
    const d = db({ tasks: [TASK()], optedOut: true });
    const s = await run(d);
    expect(s.staged).toBe(0);
    expect(s.refusedByReason.opted_out).toBe(1);
  });
});

describe("va-task outbox — scope and idempotency", () => {
  it("bgcheck_review is not messageable and is never drafted", () => {
    expect(MESSAGEABLE.bgcheck_review).toBeUndefined();
    expect(draftMessage(TASK({ category: "bgcheck_review" }), "Taj")).toBeNull();
  });

  it("skips a task that already has an unsent draft rather than stacking a second", async () => {
    const d = db({ tasks: [TASK()], alreadyQueued: true });
    const s = await run(d);
    expect(s.skippedAlreadyQueued).toBe(1);
    expect(s.staged).toBe(0);
  });

  it("skips a task with no phone", async () => {
    const d = db({ tasks: [TASK({ subject_phone: null })] });
    const s = await run(d);
    expect(s.skippedNoPhone).toBe(1);
    expect(s.staged).toBe(0);
  });
});

describe("va-task outbox — the wording", () => {
  it("carries STOP on every category it will draft, which is what makes opt-out reachable", () => {
    for (const category of Object.keys(MESSAGEABLE)) {
      const body = draftMessage(TASK({ category, context: { past_due: "10", total_owed: "10" } }), "Taj");
      expect(body, category).toContain("STOP");
    }
  });

  it("states the amount and never threatens", () => {
    const body = draftMessage(TASK(), "Taj")!;
    expect(body).toContain("$250.00");
    expect(body).toMatch(/reply here/i);
    expect(body).not.toMatch(/legal|immediately|final notice|seiz|repossess/i);
  });

  it("degrades to a neutral phrase when the amount is missing or unparseable", () => {
    expect(draftMessage(TASK({ context: {} }), "Taj")).toContain("a balance");
    expect(draftMessage(TASK({ context: { past_due: "n/a" } }), "Taj")).toContain("a balance");
  });
});
