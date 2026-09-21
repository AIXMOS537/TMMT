/**
 * Automation safety envelope.
 *
 * Workstream B, P0 #3. The guarantee: **a workflow capable of contacting customers cannot fire
 * because something incidental happened to records.**
 *
 * Every refusal here traces to a finding in `evidence/automation-logic-capture.md`:
 *
 * | Refusal | Finding it prevents |
 * |---|---|
 * | `disabled` | 8 of 51 legacy automations were live without a deliberate decision |
 * | `exceeds_max_affected` | A8 fans out email to up to 1000 waitlist records from one status edit |
 * | `no_recipients` | A5 has a customer-facing receipt email with no `to:` configured |
 * | `unported_script` | 15 `customScript` bodies are UNKNOWN and must never be approximated |
 * | `approval_required` | CLAUDE.md §2 — customer messages are gated absolutely |
 * | `dnc_check_missing` | `do_not_contact_numbers` has already failed open once |
 *
 * Usage — plan first, always:
 *
 * ```ts
 * const plan = planAutomation(definition, affectedRecordCount);
 * if (plan.blockers.length > 0) return plan;          // show the operator why
 * const run = await executeAutomation(definition, plan, {
 *   dryRun: false,                                    // explicit; the default previews
 *   approval,                                          // owner-approved GatedAction
 *   dncCheck,                                          // wraps src/lib/outbound-gate.ts
 *   acknowledgeAffectedCount: 3,
 * });
 * ```
 */

export {
  executeAutomation,
  executeAutomationOrThrow,
  planAutomation,
  type DncCheck,
  type ExecuteOptions,
} from "./envelope";

export {
  AutomationRefusedError,
  type AutomationAction,
  type AutomationBlocker,
  type AutomationDefinition,
  type AutomationPlan,
  type AutomationRun,
} from "./types";
