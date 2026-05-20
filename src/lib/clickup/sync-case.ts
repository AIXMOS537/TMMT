import type { SupabaseClient } from "@supabase/supabase-js";
import { addClickUpComment, createClickUpTask } from "@/lib/clickup/client";
import {
  listIdForRequestType,
  listNameForId,
} from "@/lib/clickup/config";

export type CaseRecord = {
  id: string;
  case_number: string;
  title: string;
  request_type: string;
  status: string;
  priority?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  internal_notes?: string | null;
  clickup_task_id?: string | null;
  clickup_url?: string | null;
};

function priorityToClickUp(priority?: string | null): 1 | 2 | 3 | 4 | undefined {
  if (!priority) return undefined;
  const p = priority.toLowerCase();
  if (p === "urgent") return 1;
  if (p === "moderate") return 2;
  return 3;
}

function buildDescription(c: CaseRecord, extra?: string): string {
  const lines = [
    `TMMT case: ${c.case_number}`,
    `Status: ${c.status}`,
    `Type: ${c.request_type}`,
    c.customer_name ? `Customer: ${c.customer_name}` : "",
    c.customer_phone ? `Phone: ${c.customer_phone}` : "",
    c.customer_email ? `Email: ${c.customer_email}` : "",
    c.internal_notes ? `\nNotes:\n${c.internal_notes}` : "",
    extra ?? "",
    `\nSource: TMMT OS (/cases)`,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function syncCaseToClickUp(
  supabase: SupabaseClient,
  caseId: string,
  options?: { force?: boolean }
): Promise<{ taskId: string; url: string; skipped?: boolean }> {
  const { data: row, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Case not found");
  }

  const c = row as CaseRecord;
  if (c.clickup_task_id && !options?.force) {
    return {
      taskId: c.clickup_task_id,
      url: c.clickup_url ?? "",
      skipped: true,
    };
  }

  const listId = listIdForRequestType(c.request_type);
  const listName = listNameForId(listId);
  const tags = ["tmmt-os", c.request_type.replace(/_/g, "-")];

  const task = await createClickUpTask({
    listId,
    name: `[${c.case_number}] ${c.title}`,
    description: buildDescription(c),
    priority: priorityToClickUp(c.priority),
    tags,
  });

  await supabase
    .from("cases")
    .update({
      clickup_task_id: task.id,
      clickup_url: task.url,
    })
    .eq("id", caseId);

  await supabase.from("clickup_tasks").insert({
    case_id: caseId,
    clickup_task_id: task.id,
    clickup_url: task.url,
    list_name: listName,
  });

  return { taskId: task.id, url: task.url };
}

export async function notifyClickUpVendorAssignment(input: {
  clickupTaskId: string;
  vendorName: string;
  jobTitle: string;
  description?: string | null;
}): Promise<void> {
  const text = [
    "Vendor job offered via TMMT OS",
    `Vendor: ${input.vendorName}`,
    `Job: ${input.jobTitle}`,
    input.description ? `Instructions: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await addClickUpComment(input.clickupTaskId, text);
}

export async function syncGhlEventToClickUp(input: {
  email: string;
  event: string;
  tags: string[];
  contactId?: string;
}): Promise<{ taskId: string; url: string } | null> {
  const fleetTags = ["maintenance", "repo", "repossession", "flat-tire", "fleet"];
  const opsTags = ["tmmt-customer", "rental-completed", "ready-for-aixmos", "ticket"];

  const isFleet = input.tags.some((t) =>
    fleetTags.some((f) => t.toLowerCase().includes(f))
  );
  const isOps = input.tags.some((t) =>
    opsTags.some((o) => t.toLowerCase().includes(o))
  );

  if (!isFleet && !isOps && !input.event.toLowerCase().includes("maintenance")) {
    return null;
  }

  const requestType = isFleet ? "maintenance" : "general";
  const listId = listIdForRequestType(requestType);

  const task = await createClickUpTask({
    listId,
    name: `GHL: ${input.event} — ${input.email}`,
    description: [
      `Event: ${input.event}`,
      input.tags.length ? `Tags: ${input.tags.join(", ")}` : "",
      input.contactId ? `GHL contact: ${input.contactId}` : "",
      `Email: ${input.email}`,
      "\nSource: GHL webhook → TMMT OS",
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["ghl", "tmmt-os", ...input.tags.slice(0, 5)],
  });

  return { taskId: task.id, url: task.url };
}
