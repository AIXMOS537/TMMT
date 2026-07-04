"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isOwnerUser } from "@/lib/auth-roles";
import {
  listGatedActions,
  decideGatedAction,
  type DbGatedAction,
  type Decision,
} from "@/lib/approvals";

type ListResult =
  | { success: true; actions: DbGatedAction[] }
  | { success: false; error: string };

type DecideResult = { success: true } | { success: false; error: string };

/** Owner-only: the pending approval queue for the console. */
export async function listPendingApprovals(): Promise<ListResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerUser(user)) return { success: false, error: "Owner only." };

  try {
    const actions = await listGatedActions("pending");
    return { success: true, actions };
  } catch {
    return { success: false, error: "Failed to load pending approvals." };
  }
}

/** Owner-only: record an approve/reject decision on a pending action. */
export async function decideApproval(
  id: string,
  decision: Decision,
  reason?: string
): Promise<DecideResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isOwnerUser(user)) return { success: false, error: "Owner only." };

  try {
    await decideGatedAction(id, decision, user.email ?? user.id, reason);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to record decision.",
    };
  }
}
