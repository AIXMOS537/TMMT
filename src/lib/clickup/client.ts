import { clickupConfigured } from "@/lib/clickup/config";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const API = "https://api.clickup.com/api/v2";

export class ClickUpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ClickUpError";
  }
}

async function clickupFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  if (!token) throw new ClickUpError("CLICKUP_API_TOKEN not configured", 503);

  const res = await fetchWithTimeout(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ClickUpError(text.slice(0, 400) || res.statusText, res.status);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export type ClickUpCreateTaskInput = {
  listId: string;
  name: string;
  description?: string;
  priority?: 1 | 2 | 3 | 4;
  tags?: string[];
  status?: string;
};

export type ClickUpTask = {
  id: string;
  url: string;
  name: string;
};

export async function createClickUpTask(
  input: ClickUpCreateTaskInput
): Promise<ClickUpTask> {
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? "",
    tags: input.tags ?? [],
    status: input.status ?? "to do",
  };
  if (input.priority) body.priority = input.priority;

  const data = await clickupFetch<{ id: string; url: string; name: string }>(
    `/list/${input.listId}/task`,
    { method: "POST", body: JSON.stringify(body) }
  );

  return { id: data.id, url: data.url, name: data.name };
}

export async function addClickUpComment(
  taskId: string,
  comment: string
): Promise<void> {
  await clickupFetch(`/task/${taskId}/comment`, {
    method: "POST",
    body: JSON.stringify({ comment_text: comment }),
  });
}

export function isClickUpEnabled(): boolean {
  return clickupConfigured();
}
