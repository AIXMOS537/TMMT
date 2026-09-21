import { describe, expect, it } from "vitest";

import { createPendingAction, type GatedAction } from "../../../shared/owner-approval-gate/approval";
import {
  AutomationRefusedError,
  executeAutomation,
  executeAutomationOrThrow,
  planAutomation,
  type AutomationDefinition,
} from "./index";

const approved = (): GatedAction => ({
  ...createPendingAction("customer_message", {}, "test"),
  status: "approved",
  approvedBy: "owner",
  approvedAt: new Date().toISOString(),
});

const allowAll = async () => true;

/** A8 — the waitlist fan-out, modelled from the live automation config. */
function waitlistFanout(recipientCount: number): AutomationDefinition {
  return {
    id: "wflgHokPQOZT0LPF4",
    name: "Notify Customers of Waitlist Position Changes",
    enabled: true,
    maxAffectedRecords: 25,
    actions: [
      {
        kind: "send_customer_message",
        channel: "email",
        recipients: Array.from({ length: recipientCount }, (_, i) => `c${i}@example.test`),
        description: "Your Waitlist Position Update",
      },
    ],
  };
}

describe("planning never executes", () => {
  it("computes blast radius and blockers without sending", () => {
    const plan = planAutomation(waitlistFanout(3), 3);
    expect(plan.affectedRecordCount).toBe(3);
    expect(plan.customerContactCount).toBe(3);
    expect(plan.blockers).toEqual([]);
  });
});

describe("dry run is the default", () => {
  it("previews when the caller forgets the flag entirely", async () => {
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      approval: approved(),
      dncCheck: allowAll,
    });
    // No dryRun passed at all — must NOT send.
    expect(run.status).toBe("dry_run");
    expect(run.executedActions).toEqual([]);
  });

  it("executes only on an explicit dryRun: false", async () => {
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      dryRun: false,
      approval: approved(),
      dncCheck: allowAll,
    });
    expect(run.status).toBe("executed");
    expect(run.executedActions).toHaveLength(1);
  });
});

describe("blast radius — the A8 finding", () => {
  it("refuses a 1000-record fan-out against a declared cap of 25", () => {
    const plan = planAutomation(waitlistFanout(1000), 1000);
    expect(plan.blockers.map((b) => b.code)).toContain("exceeds_max_affected");
    expect(plan.customerContactCount).toBe(1000);
  });

  it("stops a run the caller under-estimated", async () => {
    const def = waitlistFanout(20);
    const run = await executeAutomation(def, planAutomation(def, 20), {
      dryRun: false,
      approval: approved(),
      dncCheck: allowAll,
      acknowledgeAffectedCount: 3, // operator expected 3, plan touches 20
    });
    expect(run.status).toBe("refused");
    expect(run.blockers.map((b) => b.code)).toContain("exceeds_max_affected");
    expect(run.executedActions).toEqual([]);
  });
});

describe("unconfigured recipients — the A5 finding", () => {
  it("treats a customer-facing action with zero recipients as a defect, not a no-op", () => {
    const def: AutomationDefinition = {
      id: "wfldhpJXmBKJDIl6Q",
      name: "New Payment Recorded Automation",
      enabled: true,
      maxAffectedRecords: 10,
      actions: [
        {
          kind: "send_customer_message",
          channel: "email",
          recipients: [],
          description: "Your Payment Receipt",
        },
      ],
    };
    const plan = planAutomation(def, 1);
    expect(plan.blockers.map((b) => b.code)).toContain("no_recipients");
  });
});

describe("un-captured legacy scripts", () => {
  it("refuses to run an action whose behaviour is UNKNOWN", () => {
    const def: AutomationDefinition = {
      id: "wfl6aEZPBOZkd1KE7",
      name: "New Lead Notification and Status Update",
      enabled: true,
      maxAffectedRecords: 100,
      actions: [
        {
          kind: "unported_script",
          sourceAutomation: "New Lead Notification and Status Update",
          sourceNodeKey: "wac9piYYj17HsBAGk",
        },
      ],
    };
    const plan = planAutomation(def, 1);
    const blocker = plan.blockers.find((b) => b.code === "unported_script");
    expect(blocker).toBeDefined();
    expect(blocker!.detail).toMatch(/automation-logic-capture/);
  });
});

describe("disabled by default", () => {
  it("refuses a disabled definition regardless of everything else", async () => {
    const def = { ...waitlistFanout(1), enabled: false };
    const run = await executeAutomation(def, planAutomation(def, 1), {
      dryRun: false,
      approval: approved(),
      dncCheck: allowAll,
    });
    expect(run.status).toBe("refused");
    expect(run.blockers.map((b) => b.code)).toContain("disabled");
  });
});

describe("owner approval is absolute for customer contact", () => {
  it("refuses without an approval", async () => {
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      dryRun: false,
      dncCheck: allowAll,
    });
    expect(run.status).toBe("refused");
    expect(run.blockers.map((b) => b.code)).toContain("approval_required");
  });

  it("refuses on a pending (un-approved) action", async () => {
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      dryRun: false,
      approval: createPendingAction("customer_message", {}, "test"),
      dncCheck: allowAll,
    });
    expect(run.status).toBe("refused");
    expect(run.blockers.map((b) => b.code)).toContain("approval_not_granted");
  });

  it("does NOT require approval for an internal notification", async () => {
    const def: AutomationDefinition = {
      id: "wflsb6BpLyzuYanom",
      name: "Notify Team on New Fleet Vehicle",
      enabled: true,
      maxAffectedRecords: 10,
      actions: [
        { kind: "internal_notification", channel: "email", description: "New vehicle added" },
      ],
    };
    const run = await executeAutomation(def, planAutomation(def, 1), { dryRun: false });
    expect(run.status).toBe("executed");
  });
});

describe("DNC screening fails closed", () => {
  it("refuses customer contact when no DNC check is supplied", async () => {
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      dryRun: false,
      approval: approved(),
    });
    expect(run.status).toBe("refused");
    expect(run.blockers.map((b) => b.code)).toContain("dnc_check_missing");
  });

  it("suppresses — and records — a blocked recipient rather than dropping it silently", async () => {
    const def = waitlistFanout(3);
    const run = await executeAutomation(def, planAutomation(def, 3), {
      dryRun: false,
      approval: approved(),
      dncCheck: async (r) => r !== "c1@example.test",
    });
    expect(run.status).toBe("executed");
    expect(run.suppressedRecipients).toEqual(["c1@example.test"]);
    const action = run.executedActions[0];
    expect(action.kind === "send_customer_message" && action.recipients).toEqual([
      "c0@example.test",
      "c2@example.test",
    ]);
  });

  it("treats a THROWING dnc check as a block, not as permission", async () => {
    // do_not_contact_numbers has already failed open once in this system's history.
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      dryRun: false,
      approval: approved(),
      dncCheck: async () => {
        throw new Error("db unreachable");
      },
    });
    expect(run.status).toBe("executed");
    expect(run.executedActions).toEqual([]); // everyone suppressed, nothing sent
    expect(run.suppressedRecipients).toHaveLength(2);
  });

  it("sends to nobody when every recipient is suppressed", async () => {
    const def = waitlistFanout(2);
    const run = await executeAutomation(def, planAutomation(def, 2), {
      dryRun: false,
      approval: approved(),
      dncCheck: async () => false,
    });
    expect(run.executedActions).toEqual([]);
    expect(run.suppressedRecipients).toHaveLength(2);
  });
});

describe("run bookkeeping", () => {
  it("honours a caller-supplied idempotency key so a retry cannot double-send", async () => {
    const def = waitlistFanout(1);
    const plan = planAutomation(def, 1);
    const opts = {
      dryRun: false as const,
      approval: approved(),
      dncCheck: allowAll,
      idempotencyKey: "fixed-key-1",
    };
    const a = await executeAutomation(def, plan, opts);
    const b = await executeAutomation(def, plan, opts);
    expect(a.idempotencyKey).toBe("fixed-key-1");
    expect(b.idempotencyKey).toBe(a.idempotencyKey);
  });

  it("refuses all-or-nothing — a blocked run executes no actions at all", async () => {
    const def: AutomationDefinition = {
      ...waitlistFanout(2),
      actions: [
        { kind: "update_record", table: "waitlist", description: "stamp notified_at" },
        ...waitlistFanout(2).actions,
      ],
    };
    // No approval → refused. The harmless update_record must NOT run either.
    const run = await executeAutomation(def, planAutomation(def, 2), { dryRun: false });
    expect(run.status).toBe("refused");
    expect(run.executedActions).toEqual([]);
  });
});

describe("executeAutomationOrThrow", () => {
  it("throws with every blocker named", async () => {
    const def = { ...waitlistFanout(1), enabled: false };
    await expect(
      executeAutomationOrThrow(def, planAutomation(def, 1), { dryRun: false }),
    ).rejects.toThrow(AutomationRefusedError);
  });

  it("returns the run when there is nothing blocking", async () => {
    const def = waitlistFanout(1);
    const run = await executeAutomationOrThrow(def, planAutomation(def, 1), {
      dryRun: false,
      approval: approved(),
      dncCheck: allowAll,
    });
    expect(run.status).toBe("executed");
  });
});
