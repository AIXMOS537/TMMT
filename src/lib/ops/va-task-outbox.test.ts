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
  status: "pending",
  handled_at: null,
  ...over,
});

/**
 * Evaluate the filters the module actually put on the exec_va_tasks query
 * against in-memory rows, so the tests exercise the real selection rather than
 * a fake that returns every row regardless of what was asked.
 */
function selectLikePostgrest(rows: VaTaskRow[], filters: Array<[string, unknown, unknown]>): VaTaskRow[] {
  return rows.filter((row) =>
    filters.every(([method, column, value]) => {
      const cell = (row as unknown as Record<string, unknown>)[String(column)] ?? null;
      if (method === "eq") return cell === value;
      if (method === "is") return cell === value;
      if (method === "in") return (value as unknown[]).includes(cell);
      return true; // order / limit do not change membership
    })
  );
}

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
  /** Return every task regardless of the query, to prove the in-loop guard. */
  ignoreFilters?: boolean;
}): FakeSupabase {
  return makeFakeSupabase((call) => {
    if (call.table === "exec_va_tasks") {
      return { data: opts.ignoreFilters ? opts.tasks : selectLikePostgrest(opts.tasks, call.filters) };
    }
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

describe("va-task outbox — closed tasks are never actionable (G-01)", () => {
  const HANDLED = "2026-09-08T20:18:05.948Z";

  it("asks the database for open tasks only: status pending AND handled_at null", async () => {
    const d = db({ tasks: [] });
    await run(d);
    const read = d.calls.find((c) => c.table === "exec_va_tasks")!;
    expect(read.filters).toContainEqual(["eq", "status", "pending"]);
    expect(read.filters).toContainEqual(["is", "handled_at", null]);
  });

  it("open + pending + otherwise eligible is considered and staged", async () => {
    const d = db({ tasks: [TASK()] });
    const s = await run(d);
    expect(s.considered).toBe(1);
    expect(s.staged).toBe(1);
  });

  it("handled + pending is never staged, even with owner approval", async () => {
    const d = db({ tasks: [TASK({ handled_at: HANDLED })] });
    const s = await run(d, { ownerApproved: true });
    expect(s.considered).toBe(0);
    expect(s.staged).toBe(0);
    expect(d.calls.some((c) => c.table === "automation_outbox" && c.op === "insert")).toBe(false);
  });

  it("dismissed re-engagement + pending is never staged, even with owner approval", async () => {
    const d = db({
      tasks: [TASK({ id: "t-dismissed", category: "lead_reengagement", context: {}, handled_at: HANDLED })],
    });
    const s = await run(d, { ownerApproved: true });
    expect(s.staged).toBe(0);
    expect(s.drafts).toHaveLength(0);
  });

  it("blocked_dnc is never staged", async () => {
    const d = db({ tasks: [TASK({ status: "blocked_dnc", handled_at: HANDLED })] });
    expect((await run(d)).staged).toBe(0);
  });

  it("open + DNC + otherwise eligible is refused by the gate", async () => {
    const d = db({ tasks: [TASK()], dnc: ["5551112222"] });
    const s = await run(d);
    expect(s.staged).toBe(0);
    expect(s.refusedByReason.dnc).toBe(1);
  });

  it("closed + DNC is never staged and never even reaches the gate", async () => {
    const d = db({ tasks: [TASK({ handled_at: HANDLED })], dnc: ["5551112222"] });
    const s = await run(d, { ownerApproved: true });
    expect(s.staged).toBe(0);
    expect(d.calls.some((c) => c.table === "do_not_contact_numbers")).toBe(false);
  });

  it("only the open task of a mixed batch is staged; transactional work is unaffected", async () => {
    const d = db({
      tasks: [
        TASK({ id: "open-pay" }),
        TASK({ id: "closed-pay", handled_at: HANDLED }),
        TASK({ id: "closed-lead", category: "lead_reengagement", context: {}, handled_at: HANDLED }),
      ],
    });
    const s = await run(d, { ownerApproved: true });
    expect(s.staged).toBe(1);
    expect(s.drafts.map((x) => x.taskId)).toEqual(["open-pay"]);
  });

  it("if the query filter ever regresses, the in-loop guard still skips closed rows", async () => {
    const d = db({
      tasks: [TASK({ id: "open" }), TASK({ id: "closed", handled_at: HANDLED })],
      ignoreFilters: true,
    });
    const s = await run(d, { ownerApproved: true });
    expect(s.skippedClosed).toBe(1);
    expect(s.drafts.map((x) => x.taskId)).toEqual(["open"]);
  });
});
