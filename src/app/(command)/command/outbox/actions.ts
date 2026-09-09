"use server";

/**
 * Owner-only entry points for staging VA-task SMS drafts.
 *
 * The queue (`exec_va_tasks`) has been filling daily since the generator went
 * in and nothing has ever read it. These two actions are the read end.
 *
 * Neither one sends. `stageVaTaskMessages` only ever writes drafts to
 * `automation_outbox` with status='queued' — the surface this system already
 * uses for "waiting on the owner to tap send".
 *
 * Owner check follows the credit-dispute desk: verify with the SSR client
 * (which carries the caller's session), then do the work with the service role,
 * because the queue and the outbox are not readable under the caller's RLS.
 * The check must therefore happen HERE — a service-role client would bypass it.
 */

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isOwnerUser } from "@/lib/auth-roles";
import { stageVaTaskMessages, type StageSummary } from "@/lib/ops/va-task-outbox";

export type OutboxResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireOwner(): Promise<boolean> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return isOwnerUser(user);
}

/** Dry run. Computes every gate decision and writes nothing. */
export async function previewVaTaskSms(): Promise<OutboxResult<StageSummary>> {
  if (!(await requireOwner())) return { ok: false, error: "Not authorized." };

  try {
    const summary = await stageVaTaskMessages({ dryRun: true, db: createServiceRoleClient() });
    return { ok: true, data: summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Preview failed." };
  }
}

/**
 * Write the drafts.
 *
 * `ownerApproved` is the ONLY thing that releases the marketing categories
 * (lead_reengagement, waitlist_contact) past the A2P hold. It is a parameter
 * rather than a default precisely so that approving a marketing campaign is an
 * explicit act, recorded in the caller, and never something this code assumes.
 * Transactional categories stage without it.
 *
 * Still sends nothing: the result is queued rows the owner then dispatches.
 */
export async function stageVaTaskSms(
  opts: { ownerApproved?: boolean } = {}
): Promise<OutboxResult<StageSummary>> {
  if (!(await requireOwner())) return { ok: false, error: "Not authorized." };

  try {
    const summary = await stageVaTaskMessages({
      dryRun: false,
      ownerApproved: opts.ownerApproved === true,
      db: createServiceRoleClient(),
    });
    return { ok: true, data: summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Staging failed." };
  }
}
