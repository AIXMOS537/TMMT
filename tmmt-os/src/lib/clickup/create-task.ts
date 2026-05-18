import { resolveClickUpUserIds } from "./resolve-user";

export type CreateClickUpTaskInput = {
  listId: string;
  name: string;
  description?: string;
  priority?: number;
  tags?: string[];
  assigneeEmail?: string;
  assigneeEmails?: string[];
};

export type CreateClickUpTaskResult = {
  taskId: string;
  url: string;
};

/**
 * Create a ClickUp task in the given list. Returns null when API is not configured.
 */
export async function createClickUpTask(
  input: CreateClickUpTaskInput
): Promise<CreateClickUpTaskResult | null> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token?.trim()) return null;

  const emails = [
    ...(input.assigneeEmails ?? []),
    ...(input.assigneeEmail ? [input.assigneeEmail] : []),
  ].filter(Boolean);
  const assignees = await resolveClickUpUserIds(emails);

  const priority = input.priority ?? 3;
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? "",
    priority,
    tags: input.tags ?? [],
    status: "to do",
  };
  if (assignees.length > 0) body.assignees = assignees;

  const res = await fetch(`https://api.clickup.com/api/v2/list/${input.listId}/task`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ClickUp create failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string; url?: string };
  if (!data.id) {
    throw new Error("ClickUp response missing task id");
  }

  const teamId = process.env.CLICKUP_TEAM_ID;
  const url =
    data.url ??
    (teamId
      ? `https://app.clickup.com/t/${teamId}/task/${data.id}`
      : `https://app.clickup.com/t/task/${data.id}`);

  return { taskId: data.id, url };
}
