"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import {
  getAppRole,
  isOwnerUser,
  isExecutiveVaUser,
  isOperatorUser,
} from "@/lib/auth-roles";
import { refineOwnerDraft, reviewOpsMessage } from "@/lib/ops-ai";

type OpsResult =
  | { success: true; id?: string; review?: Awaited<ReturnType<typeof reviewOpsMessage>>; draft?: string; notes?: string }
  | { success: false; error: string };

async function requireUser() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const messageSchema = z.object({
  thread_id: z.string().uuid().optional(),
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(12000),
  raw_transcript: z.string().max(20000).optional(),
  audience: z.enum(["executives", "operators"]),
  message_kind: z.enum(["command", "relay", "note"]).optional(),
});

/** Owner: refine voice transcript before sending */
export async function ownerRefineTranscript(transcript: string): Promise<OpsResult> {
  const { user } = await requireUser();
  if (!isOwnerUser(user)) return { success: false, error: "Owner access only." };

  const trimmed = transcript.trim();
  if (!trimmed) return { success: false, error: "Nothing to refine." };

  const { draft, notes } = await refineOwnerDraft(trimmed);
  return { success: true, draft, notes };
}

/** Run AI fact-check without publishing */
export async function runOpsAiReview(formData: FormData): Promise<OpsResult> {
  const { user } = await requireUser();
  const role = getAppRole(user);
  if (!isOwnerUser(user) && !isExecutiveVaUser(user)) {
    return { success: false, error: "Not authorized." };
  }

  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "executives");
  const messageKind = String(formData.get("message_kind") ?? "command");

  if (!body) return { success: false, error: "Message body required." };

  const review = await reviewOpsMessage(body, {
    audience,
    messageKind,
    authorRole: role,
  });

  return { success: true, review };
}

/** Create thread + message, run AI review, optionally publish */
export async function submitOpsMessage(formData: FormData): Promise<OpsResult> {
  const { supabase, user } = await requireUser();
  const role = getAppRole(user);

  const parsed = messageSchema.safeParse({
    thread_id: formData.get("thread_id") || undefined,
    title: formData.get("title") || undefined,
    body: formData.get("body"),
    raw_transcript: formData.get("raw_transcript") || undefined,
    audience: formData.get("audience"),
    message_kind: formData.get("message_kind") || undefined,
  });

  if (!parsed.success) return { success: false, error: "Invalid message." };

  const d = parsed.data;
  const publish = formData.get("publish") === "true";
  const skipReview = formData.get("skip_review") === "true" && isOwnerUser(user);

  if (d.audience === "operators" && isOperatorUser(user)) {
    return { success: false, error: "Operators cannot post to operator feed." };
  }

  if (d.audience === "executives" && !isOwnerUser(user) && !isExecutiveVaUser(user)) {
    return { success: false, error: "Not authorized for executive channel." };
  }

  if (d.audience === "operators" && isOwnerUser(user) && d.message_kind !== "relay") {
    // Owner should usually go through executives first
  }

  let threadId = d.thread_id;

  if (!threadId) {
    if (!isOwnerUser(user) && !isExecutiveVaUser(user)) {
      return { success: false, error: "Thread required." };
    }
    const title = d.title || d.body.slice(0, 80);
    const { data: thread, error: threadErr } = await supabase
      .from("ops_threads")
      .insert({ title, created_by: user.id, status: "open" })
      .select("id")
      .single();
    if (threadErr) {
      console.error("[ops_threads]", threadErr.message);
      return { success: false, error: "Failed to create thread." };
    }
    threadId = thread.id;
  }

  const review =
    skipReview && isOwnerUser(user) && d.audience === "executives"
      ? {
          aligned: true,
          score: 1,
          issues: [] as string[],
          suggestedBody: d.body,
          summary: "Owner bypass for executive dispatch.",
        }
      : await reviewOpsMessage(d.body, {
          audience: d.audience,
          messageKind: d.message_kind || (isOwnerUser(user) ? "command" : "relay"),
          authorRole: role,
        });

  const aligned = review.aligned && review.score >= 0.75;
  let status = "ai_review";
  if (aligned && publish) status = "published";
  else if (aligned && !publish) status = "approved";
  else if (!aligned) status = "needs_edit";

  const { data: msg, error: msgErr } = await supabase
    .from("ops_messages")
    .insert({
      thread_id: threadId,
      author_id: user.id,
      body: d.body,
      raw_transcript: d.raw_transcript || null,
      audience: d.audience,
      message_kind: d.message_kind || (isOwnerUser(user) ? "command" : "relay"),
      status,
      ai_aligned: review.aligned,
      ai_score: review.score,
      ai_issues: review.issues,
      ai_suggested_body: review.suggestedBody,
      ai_reviewed_at: new Date().toISOString(),
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (msgErr) {
    console.error("[ops_messages]", msgErr.message);
    return { success: false, error: "Failed to save message." };
  }

  return { success: true, id: msg.id, review };
}

/** Publish an approved message (after review) */
export async function publishOpsMessage(messageId: string): Promise<OpsResult> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("ops_messages")
    .select("id, author_id, status, ai_aligned, ai_score")
    .eq("id", messageId)
    .single();

  if (!existing) return { success: false, error: "Message not found." };

  const canPublish =
    isOwnerUser(user) ||
    (existing.author_id === user.id &&
      (existing.status === "approved" || existing.status === "needs_edit") &&
      (existing.ai_aligned || (existing.ai_score ?? 0) >= 0.75));

  if (!canPublish && !isOwnerUser(user)) {
    return { success: false, error: "AI review must pass before publishing." };
  }

  const { error } = await supabase
    .from("ops_messages")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (error) return { success: false, error: "Publish failed." };
  return { success: true, id: messageId };
}

/** Apply AI suggested body and re-review */
export async function applyAiSuggestion(messageId: string): Promise<OpsResult> {
  const { supabase, user } = await requireUser();

  const { data: msg } = await supabase
    .from("ops_messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (!msg || (msg.author_id !== user.id && !isOwnerUser(user))) {
    return { success: false, error: "Not found." };
  }

  const suggested = (msg.ai_suggested_body as string) || (msg.body as string);
  const review = await reviewOpsMessage(suggested, {
    audience: msg.audience as string,
    messageKind: msg.message_kind as string,
    authorRole: getAppRole(user),
  });

  const aligned = review.aligned && review.score >= 0.75;

  await supabase
    .from("ops_messages")
    .update({
      body: suggested,
      status: aligned ? "approved" : "needs_edit",
      ai_aligned: review.aligned,
      ai_score: review.score,
      ai_issues: review.issues,
      ai_suggested_body: review.suggestedBody,
      ai_reviewed_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  return { success: true, review };
}
