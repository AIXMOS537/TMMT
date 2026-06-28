/**
 * shared/home-brain/guarded-agent.ts
 *
 * The bolt that turns the safety layer from a library into live enforcement.
 * A home-brain autonomous loop (M1 / Windows) does NOT call its executors
 * directly — it routes every step through runGuarded(), which runs
 * guardHomeAction() FIRST. If any guard blocks (halt, PII→cloud, cap, missing
 * approval), the executor never runs and the block is recorded to the NAS audit.
 *
 * Usage in a loop:
 *   for (const step of plan) {
 *     await runGuarded(step.request, () => step.execute(), env)
 *   }
 */
import { guardHomeAction, type HomeActionRequest, type HomeGuardEnv } from './home-guard'

export interface GuardedResult<T> {
  ran: boolean
  result?: T
  blockedReason?: string
}

/**
 * Guard, then execute. The executor is invoked ONLY if every guard passes.
 * Re-throws the guard error so the loop can decide to stop/skip; the block is
 * already audited by guardHomeAction.
 */
export async function runGuarded<T>(
  request: HomeActionRequest,
  execute: () => T | Promise<T>,
  env: HomeGuardEnv = {},
): Promise<GuardedResult<T>> {
  guardHomeAction(request, env) // throws (and audits) on any block
  const result = await execute()
  return { ran: true, result }
}

/**
 * Non-throwing variant for loops that should keep going past a blocked step.
 * Returns { ran: false, blockedReason } instead of throwing.
 */
export async function tryGuarded<T>(
  request: HomeActionRequest,
  execute: () => T | Promise<T>,
  env: HomeGuardEnv = {},
): Promise<GuardedResult<T>> {
  try {
    return await runGuarded(request, execute, env)
  } catch (e) {
    return { ran: false, blockedReason: e instanceof Error ? e.message : String(e) }
  }
}
