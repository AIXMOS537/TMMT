/**
 * Automation safety envelope — plan and execute.
 *
 * Two entry points, and the separation is the whole point:
 *
 *   planAutomation()     resolves the blast radius and every blocker. Executes NOTHING.
 *   executeAutomation()  runs only a plan with zero blockers, and only when the caller
 *                        explicitly opts out of dry-run.
 *
 * `dryRun` defaults to TRUE. A caller that forgets the flag previews; it does not send.
 * That default is deliberate: the legacy failure mode was an automation firing because
 * something incidental happened to records, not because anyone decided to run it.
 */

import { assertApproved, type GatedAction } from "../../../shared/owner-approval-gate/approval";
import {
  AutomationRefusedError,
  type AutomationAction,
  type AutomationBlocker,
  type AutomationDefinition,
  type AutomationPlan,
  type AutomationRun,
} from "./types";

/** Resolves whether a single recipient may be contacted. Must fail CLOSED on error. */
export type DncCheck = (recipient: string) => Promise<boolean>;

export type ExecuteOptions = {
  /**
   * Defaults to true. Execution requires an explicit `false` — forgetting it previews.
   */
  dryRun?: boolean;
  /** Required when the plan contains a customer-facing action. */
  approval?: GatedAction;
  /**
   * Required when the plan contains a customer-facing action. Must fail closed: return false
   * when the check itself errors. `src/lib/outbound-gate.ts` already implements this behaviour
   * against `do_not_contact_numbers` — wrap it rather than writing a second check.
   */
  dncCheck?: DncCheck;
  /**
   * The caller's acknowledged blast radius. When the plan affects more records than this, the
   * run refuses even if the definition's own cap would allow it. Lets a caller say "I expected
   * to touch 3 records" and be stopped at 300.
   */
  acknowledgeAffectedCount?: number;
  /** Stable key so a retry cannot double-send. Generated when omitted. */
  idempotencyKey?: string;
};

/** Type predicate so narrowing works at the call sites that read `recipients`/`channel`. */
type CustomerMessageAction = Extract<AutomationAction, { kind: "send_customer_message" }>;

function isCustomerFacing(action: AutomationAction): action is CustomerMessageAction {
  return action.kind === "send_customer_message";
}

/**
 * Compute the blast radius and every reason this run would be stopped.
 *
 * Pure with respect to the outside world — it reads the definition and the resolved record
 * count and returns a plan. It sends nothing, writes nothing and calls nothing.
 */
export function planAutomation(
  definition: AutomationDefinition,
  affectedRecordCount: number,
): AutomationPlan {
  const blockers: AutomationBlocker[] = [];

  if (!definition.enabled) {
    blockers.push({
      code: "disabled",
      detail: `"${definition.name}" is disabled. Automations are off until switched on deliberately.`,
    });
  }

  if (affectedRecordCount > definition.maxAffectedRecords) {
    blockers.push({
      code: "exceeds_max_affected",
      detail:
        `Plan affects ${affectedRecordCount} records but "${definition.name}" declares a maximum ` +
        `of ${definition.maxAffectedRecords}. Raising the cap is a decision, not a retry.`,
    });
  }

  for (const action of definition.actions) {
    if (action.kind === "unported_script") {
      blockers.push({
        code: "unported_script",
        detail:
          `Action references un-captured legacy script ${action.sourceNodeKey} from ` +
          `"${action.sourceAutomation}". Its behaviour is UNKNOWN and must not be executed or ` +
          `approximated. Capture it first — evidence/automation-logic-capture.md.`,
      });
    }

    // The A5 case: a customer-facing email with no recipient configured. Treated as a refusal
    // rather than a no-op, because "it probably would not have sent" is not a safety property.
    if (isCustomerFacing(action) && action.recipients.length === 0) {
      blockers.push({
        code: "no_recipients",
        detail:
          `Customer-facing ${action.channel} action "${action.description}" resolved zero ` +
          `recipients. An unconfigured recipient list is a defect, not an empty send.`,
      });
    }
  }

  const customerContactCount = definition.actions
    .filter(isCustomerFacing)
    .reduce((n, a) => n + a.recipients.length, 0);

  return {
    definitionId: definition.id,
    definitionName: definition.name,
    affectedRecordCount,
    actions: definition.actions,
    customerContactCount,
    blockers,
    plannedAt: new Date().toISOString(),
  };
}

/**
 * Execute a plan — or refuse.
 *
 * Refuses when: the plan already carries blockers · `dryRun` was not explicitly disabled ·
 * the caller's acknowledged count is exceeded · a customer-facing action lacks owner approval
 * or a DNC check.
 *
 * Suppressed recipients are recorded on the run rather than dropped, so "who did we not
 * contact, and why" is answerable afterwards.
 */
export async function executeAutomation(
  definition: AutomationDefinition,
  plan: AutomationPlan,
  options: ExecuteOptions = {},
): Promise<AutomationRun> {
  const dryRun = options.dryRun ?? true;
  const blockers: AutomationBlocker[] = [...plan.blockers];
  const suppressedRecipients: string[] = [];

  const hasCustomerFacing = plan.actions.some(isCustomerFacing);

  if (hasCustomerFacing) {
    // Owner approval, per CLAUDE.md §2 — customer-facing messages are gated absolutely.
    if (!options.approval) {
      blockers.push({
        code: "approval_required",
        detail:
          `"${definition.name}" would contact ${plan.customerContactCount} customer(s). ` +
          `No customer-facing message executes without explicit owner approval.`,
      });
    } else {
      try {
        assertApproved(options.approval);
      } catch (err) {
        blockers.push({
          code: "approval_not_granted",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // A DNC check is mandatory, not optional, for customer contact.
    if (!options.dncCheck) {
      blockers.push({
        code: "dnc_check_missing",
        detail:
          `A customer-facing action requires a do-not-contact check that fails closed. ` +
          `Wrap src/lib/outbound-gate.ts rather than writing a second one.`,
      });
    }
  }

  if (
    options.acknowledgeAffectedCount !== undefined &&
    plan.affectedRecordCount > options.acknowledgeAffectedCount
  ) {
    blockers.push({
      code: "exceeds_max_affected",
      detail:
        `Caller acknowledged ${options.acknowledgeAffectedCount} affected record(s) but the plan ` +
        `affects ${plan.affectedRecordCount}.`,
    });
  }

  const idempotencyKey =
    options.idempotencyKey ?? `${definition.id}:${plan.affectedRecordCount}:${plan.plannedAt}`;

  const base = {
    definitionId: definition.id,
    plan,
    suppressedRecipients,
    idempotencyKey,
    ranAt: new Date().toISOString(),
  };

  if (blockers.length > 0) {
    return { ...base, status: "refused", executedActions: [], blockers };
  }

  if (dryRun) {
    return { ...base, status: "dry_run", executedActions: [], blockers: [] };
  }

  // --- past this point the run is authorised; still screen every recipient individually ---
  const executedActions: AutomationAction[] = [];

  for (const action of plan.actions) {
    if (isCustomerFacing(action)) {
      const allowed: string[] = [];
      for (const recipient of action.recipients) {
        // dncCheck presence is guaranteed above, but a throwing check must still fail closed.
        let ok = false;
        try {
          ok = await options.dncCheck!(recipient);
        } catch {
          ok = false;
        }
        if (ok) allowed.push(recipient);
        else suppressedRecipients.push(recipient);
      }

      if (allowed.length === 0) {
        // Everyone was suppressed. Nothing to send; record it rather than reporting success.
        continue;
      }
      executedActions.push({ ...action, recipients: allowed });
      continue;
    }

    executedActions.push(action);
  }

  return {
    ...base,
    status: "executed",
    executedActions,
    suppressedRecipients,
    blockers: [],
  };
}

/**
 * Convenience for call sites that should never proceed on a refusal.
 * Throws `AutomationRefusedError` instead of returning a refused run.
 */
export async function executeAutomationOrThrow(
  definition: AutomationDefinition,
  plan: AutomationPlan,
  options: ExecuteOptions = {},
): Promise<AutomationRun> {
  const run = await executeAutomation(definition, plan, options);
  if (run.status === "refused") {
    throw new AutomationRefusedError(definition.name, run.blockers);
  }
  return run;
}
