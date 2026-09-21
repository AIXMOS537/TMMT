/**
 * Automation safety envelope — types.
 *
 * Workstream B, P0 #3 (`TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §4.5, §9.1).
 *
 * WHAT THIS IS FOR
 * The legacy Airtable automations are evidence of real customer-impacting behaviour that could
 * fire by accident. Two findings from the capture pass drive every refusal here:
 *
 *  - **A8 `Notify Customers of Waitlist Position Changes`** does `findRecords` limit **1000** on
 *    Waitlist and emails every match — fanned out from a single status edit.
 *  - **A5 `New Payment Recorded`** carries a customer-facing "Your Payment Receipt" email with
 *    **no `to:` configured**. Whether it would send, and to whom, is UNKNOWN.
 *
 * The requirement (matrix §9.1): *a workflow capable of emailing customers must never
 * unexpectedly fire because someone restored an archive or bulk-edited records.* This module
 * makes that structural rather than procedural.
 *
 * WHAT THIS IS NOT
 * Not a trigger engine and not a scheduler. Those are P1/P2 and there is no evidence yet of
 * what they must support. This is only the envelope a run passes through.
 *
 * REUSES, does not rebuild:
 *  - `shared/owner-approval-gate/approval.ts` for the approval primitive
 *  - `src/lib/outbound-gate.ts` for the DNC / opt-out decision
 */

/** An automation action, classified by blast radius rather than by mechanism. */
export type AutomationAction =
  | {
      /** Writes to TMMT's own data. No external effect. */
      kind: "update_record";
      table: string;
      description: string;
    }
  | {
      /** Reaches a customer. The dangerous class. */
      kind: "send_customer_message";
      channel: "sms" | "email";
      /** Resolved recipients. An empty list is a refusal, never a silent no-op — see A5. */
      recipients: string[];
      description: string;
    }
  | {
      /** Reaches staff/owner only. */
      kind: "internal_notification";
      channel: "email" | "slack" | "telegram";
      description: string;
    }
  | {
      /** Calls a third-party system (CRM, task tracker, payment processor). */
      kind: "external_call";
      service: string;
      description: string;
    }
  | {
      /**
       * Ported legacy `customScript` whose behaviour has not been captured.
       * ALWAYS refuses. See `evidence/automation-logic-capture.md` — 15 bodies are UNKNOWN and
       * must not be executed, approximated, or inferred from neighbouring nodes.
       */
      kind: "unported_script";
      sourceAutomation: string;
      sourceNodeKey: string;
    };

export type AutomationDefinition = {
  id: string;
  name: string;
  /**
   * Disabled by default. An automation must be switched on deliberately — the legacy system's
   * failure mode was automations that were live without anyone deciding they should be.
   */
  enabled: boolean;
  /**
   * The largest number of records this automation may legitimately affect in one run.
   * REQUIRED, with no default: "how many customers could this touch" is a decision, not an
   * implementation detail. A run whose plan exceeds it refuses.
   */
  maxAffectedRecords: number;
  actions: AutomationAction[];
};

/** The result of planning a run. Produced without executing anything. */
export type AutomationPlan = {
  definitionId: string;
  definitionName: string;
  /** How many records the trigger resolved to. The blast radius. */
  affectedRecordCount: number;
  actions: AutomationAction[];
  /** How many distinct customers would be contacted if this executed. */
  customerContactCount: number;
  /** Everything that would stop this run, computed up front. Empty means executable. */
  blockers: AutomationBlocker[];
  plannedAt: string;
};

export type AutomationBlocker = {
  code:
    | "disabled"
    | "exceeds_max_affected"
    | "unported_script"
    | "no_recipients"
    | "approval_required"
    | "approval_not_granted"
    | "dnc_check_missing"
    | "dnc_blocked";
  detail: string;
};

export type AutomationRun = {
  definitionId: string;
  status: "dry_run" | "executed" | "refused";
  plan: AutomationPlan;
  /** Actions that actually ran. Always empty for a dry run or a refusal. */
  executedActions: AutomationAction[];
  /** Recipients withheld by the DNC / opt-out gate. Recorded, never silently dropped. */
  suppressedRecipients: string[];
  blockers: AutomationBlocker[];
  /** Stable key so a retry cannot double-send. */
  idempotencyKey: string;
  ranAt: string;
};

/**
 * Thrown when execution is attempted against a plan that has blockers.
 *
 * Execution refuses loudly rather than partially completing: a half-run automation that emailed
 * 300 of 1000 customers before hitting a limit is worse than one that never started.
 */
export class AutomationRefusedError extends Error {
  readonly blockers: AutomationBlocker[];

  constructor(definitionName: string, blockers: AutomationBlocker[]) {
    super(
      `AUTOMATION REFUSED — "${definitionName}" has ${blockers.length} blocker(s): ` +
        blockers.map((b) => `[${b.code}] ${b.detail}`).join(" | "),
    );
    this.name = "AutomationRefusedError";
    this.blockers = blockers;
  }
}
