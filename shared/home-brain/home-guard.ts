/**
 * shared/home-brain/home-guard.ts
 *
 * THE single chokepoint every home-brain agent (M1 + Windows) calls before ANY
 * action. It composes the whole safety layer in the correct order and records
 * every decision to the tamper-evident NAS audit chain:
 *
 *   1. Kill switch   — halted? stop everything (phone-reachable).
 *   2. PII firewall  — cloud send with personal/family data? block.
 *   3. Spend cap     — would this step breach today's local cap? block.
 *   4. Owner gate    — irreversible action (send/pay/sign/ship/dispute)?
 *                      require an APPROVED owner action (CLAUDE.md §2).
 *
 * This is what lets the owner go "autonomous": the brain does everything up to
 * the irreversible edge on its own, and only that edge waits for one-tap approval.
 */
import { assertNotHalted, type HaltOptions } from "./kill-switch";
import {
  assertUnderCap,
  recordSpend,
  type LedgerOptions,
} from "./spend-ledger";
import { assertLocalOnlyForPII, type Destination } from "./pii-firewall";
import { appendAudit, type AuditOptions } from "./audit-log";
import {
  assertApproved,
  type GatedAction,
  type GatedActionType,
} from "../owner-approval-gate/approval";

/** Action types that may never auto-execute without owner approval. */
const IRREVERSIBLE: ReadonlySet<GatedActionType> = new Set<GatedActionType>([
  "customer_message",
  "dispute_letter",
  "charge_fee",
  "pay_commission",
  "submit_funding_app",
  "move_money",
  "production_automation_edit",
]);

export class HomeApprovalRequiredError extends Error {
  constructor(public gatedType: GatedActionType) {
    super(
      `OWNER APPROVAL REQUIRED: "${gatedType}" is irreversible and needs an approved owner action; none was supplied.`,
    );
    this.name = "HomeApprovalRequiredError";
  }
}

export interface HomeActionRequest {
  /** Which brain/agent is acting, e.g. "brainiac-mac/follow-up-agent". */
  actor: string;
  /** Human-readable action label for the audit log. */
  action: string;
  /** If this is an owner-gated irreversible action, its type + approval record. */
  gatedType?: GatedActionType;
  approval?: GatedAction;
  /** Estimated cost (USD) of this step, charged against the daily cap. */
  costUsd?: number;
  /** Daily cap (USD). Omit/<=0 to rely on the cloud-side cap only. */
  capUsd?: number;
  /** Content + destination for the PII firewall (only checked when cloud). */
  content?: string;
  destination?: Destination;
  /** Extra structured context for the audit record. */
  detail?: Record<string, unknown>;
}

export interface HomeGuardEnv {
  halt?: HaltOptions;
  ledger?: LedgerOptions;
  audit?: AuditOptions;
}

/**
 * Run all guards. Throws (and records a `blocked` audit entry) on the first
 * failure; on success records spend and an `allowed` audit entry.
 */
export function guardHomeAction(
  req: HomeActionRequest,
  env: HomeGuardEnv = {},
): void {
  try {
    assertNotHalted(env.halt);

    if (req.destination && req.content !== undefined) {
      assertLocalOnlyForPII(req.content, req.destination);
    }

    if (typeof req.capUsd === "number") {
      assertUnderCap(req.capUsd, req.costUsd ?? 0, env.ledger);
    }

    if (req.gatedType && IRREVERSIBLE.has(req.gatedType)) {
      if (!req.approval) throw new HomeApprovalRequiredError(req.gatedType);
      assertApproved(req.approval);
    }
  } catch (e) {
    appendAudit(
      {
        actor: req.actor,
        action: req.action,
        detail: {
          ...req.detail,
          blocked: true,
          reason: e instanceof Error ? e.message : String(e),
        },
      },
      env.audit,
    );
    throw e;
  }

  if (typeof req.costUsd === "number" && req.costUsd > 0) {
    recordSpend(req.costUsd, env.ledger);
  }
  appendAudit(
    {
      actor: req.actor,
      action: req.action,
      detail: {
        ...req.detail,
        blocked: false,
        costUsd: req.costUsd ?? 0,
        gatedType: req.gatedType ?? null,
      },
    },
    env.audit,
  );
}
